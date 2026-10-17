import re
import smtplib
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from database import SessionLocal
from main import app
from models import EmailVerification, User

PASSWORD = "Test-Flow-Pass1!"


class FakeSMTP:
    """Stands in for smtplib.SMTP and records what would be sent."""

    sent: list = []
    fail_with: Exception | None = None

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def starttls(self, context=None):
        self.tls = True

    def login(self, username, password):
        self.logged_in = True

    def send_message(self, message):
        if FakeSMTP.fail_with:
            raise FakeSMTP.fail_with
        FakeSMTP.sent.append({"to": message["To"], "from": message["From"], "body": message.get_content(),
                              "host": self.host, "port": self.port, "tls": getattr(self, "tls", False),
                              "logged_in": getattr(self, "logged_in", False)})
        return {}


def last_code() -> str:
    return re.search(r"\b(\d{6})\b", FakeSMTP.sent[-1]["body"]).group(1)


@pytest.fixture(autouse=True)
def smtp(monkeypatch):
    FakeSMTP.sent, FakeSMTP.fail_with = [], None
    for key, value in {"SMTP_HOST": "smtp.gmail.com", "SMTP_PORT": "587", "SMTP_USE_TLS": "true",
                       "SMTP_USERNAME": "sender@example.test", "SMTP_PASSWORD": "x" * 16,
                       "SMTP_FROM_EMAIL": "sender@example.test"}.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setattr("services.email_service.smtplib.SMTP", FakeSMTP)


@pytest.fixture
def client():
    created: list[str] = []
    with TestClient(app) as test_client:
        test_client.created = created
        yield test_client
    with SessionLocal() as db:
        for email in created:
            user = db.scalar(select(User).where(User.email == email))
            if user:
                db.delete(user)
        db.commit()


def register(client, email=None):
    email = email or f"flow-{uuid4().hex}@example.test"
    client.created.append(email)
    response = client.post("/auth/register", json={"name": "Flow Test", "email": email, "password": PASSWORD})
    return email, response


def age_record(email, *, created_seconds_ago=0, expires_in_seconds=600):
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        row = db.get(EmailVerification, user.id)
        now = datetime.now(timezone.utc)
        row.created_at = now - timedelta(seconds=created_seconds_ago)
        row.expires_at = now + timedelta(seconds=expires_in_seconds)
        db.commit()


def test_registration_sends_code_to_registered_address_over_gmail_starttls(client):
    email, response = register(client)
    assert response.status_code == 201 and response.json()["email_sent"] is True
    assert len(FakeSMTP.sent) == 1
    mail = FakeSMTP.sent[0]
    assert mail["to"] == email and mail["to"] != "sender@example.test"
    assert (mail["host"], mail["port"], mail["tls"], mail["logged_in"]) == ("smtp.gmail.com", 587, True, True)
    assert re.fullmatch(r"\d{6}", last_code())
    assert last_code() not in response.text


def test_code_stored_hashed_and_linked_to_the_right_user(client):
    email, _ = register(client)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        row = db.get(EmailVerification, user.id)
        assert not user.is_email_verified
        assert row.code_hash != last_code() and len(row.code_hash) == 64


def test_login_blocked_before_verification(client):
    email, _ = register(client)
    response = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 403 and "access_token" not in response.text


def test_registration_survives_smtp_failure_without_granting_access(client):
    FakeSMTP.fail_with = smtplib.SMTPAuthenticationError(535, b"bad credentials")
    email, response = register(client)
    assert response.status_code == 201 and response.json()["email_sent"] is False
    assert client.post("/auth/login", json={"email": email, "password": PASSWORD}).status_code == 403


def test_resend_sends_new_code_to_unverified_account_after_cooldown(client):
    email, _ = register(client)
    first = last_code()
    age_record(email, created_seconds_ago=61)
    response = client.post("/auth/resend-verification", json={"email": email})
    assert response.status_code == 202
    assert len(FakeSMTP.sent) == 2 and FakeSMTP.sent[1]["to"] == email
    second = last_code()
    assert client.post("/auth/verify-email", json={"email": email, "code": first}).status_code == (
        400 if first != second else 200
    )


def test_resend_respects_cooldown_and_does_not_send(client):
    email, _ = register(client)
    assert client.post("/auth/resend-verification", json={"email": email}).status_code == 202
    assert len(FakeSMTP.sent) == 1


def test_resend_response_identical_for_unknown_and_known_accounts(client):
    email, _ = register(client)
    known = client.post("/auth/resend-verification", json={"email": email})
    unknown = client.post("/auth/resend-verification", json={"email": f"nobody-{uuid4().hex}@example.test"})
    assert known.status_code == unknown.status_code == 202 and known.json() == unknown.json()


def test_failed_resend_send_keeps_generic_response_and_previous_state(client):
    email, _ = register(client)
    age_record(email, created_seconds_ago=61)
    FakeSMTP.fail_with = smtplib.SMTPServerDisconnected("gone")
    response = client.post("/auth/resend-verification", json={"email": email})
    assert response.status_code == 202 and "sent" in response.json()["message"].lower()


def test_invalid_code_rejected_and_counted(client):
    email, _ = register(client)
    wrong = f"{(int(last_code()) + 1) % 1_000_000:06d}"
    assert client.post("/auth/verify-email", json={"email": email, "code": wrong}).status_code == 400
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert db.get(EmailVerification, user.id).failed_attempts == 1


def test_malformed_code_rejected(client):
    email, _ = register(client)
    assert client.post("/auth/verify-email", json={"email": email, "code": "12ab56"}).status_code == 422


def test_five_wrong_attempts_lock_the_code(client):
    email, _ = register(client)
    wrong = f"{(int(last_code()) + 1) % 1_000_000:06d}"
    statuses = [client.post("/auth/verify-email", json={"email": email, "code": wrong}).status_code for _ in range(5)]
    assert statuses == [400, 400, 400, 400, 429]
    assert client.post("/auth/verify-email", json={"email": email, "code": last_code()}).status_code == 429


def test_expired_code_rejected(client):
    email, _ = register(client)
    age_record(email, expires_in_seconds=-1)
    assert client.post("/auth/verify-email", json={"email": email, "code": last_code()}).status_code == 400


def test_successful_verification_enables_login_and_invalidates_code(client):
    email, _ = register(client)
    code = last_code()
    assert client.post("/auth/verify-email", json={"email": email, "code": code}).status_code == 200
    assert client.post("/auth/verify-email", json={"email": email, "code": code}).status_code == 400
    login = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200 and login.json()["access_token"]
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user.is_email_verified and user.email_verified_at is not None
        assert db.get(EmailVerification, user.id) is None


def test_logs_never_contain_code_password_or_email(client, caplog):
    caplog.set_level("INFO", logger="jaypilot.email")
    import logging
    logging.getLogger("jaypilot.email").propagate = True
    email, _ = register(client)
    FakeSMTP.fail_with = smtplib.SMTPAuthenticationError(535, b"bad credentials")
    age_record(email, created_seconds_ago=61)
    client.post("/auth/resend-verification", json={"email": email})
    text = caplog.text
    assert "result=attempting" in text and "result=accepted_by_smtp_server" in text
    assert "result=failed category=auth_failed" in text
    assert last_code() not in text and email not in text and "x" * 16 not in text

import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import EmailVerification, User
from services.auth_service import (
    MAX_PASSWORD_BYTES,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from services.email_service import (
    EmailDeliveryError,
    email_delivery_configured,
    logger as email_logger,
    send_verification_email,
)
from services.email_verification import generate_code, hash_code, verify_code

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 254 or not EMAIL_PATTERN.match(email):
        raise ValueError("Enter a valid email address.")
    return email


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str
    password: str = Field(min_length=8)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name is required.")
        return value

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        if len(value.encode()) > MAX_PASSWORD_BYTES:
            raise ValueError("Password is too long (72 bytes maximum).")
        return value


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=200)


class EmailRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        return _normalize_email(value)


class VerifyEmailRequest(EmailRequest):
    code: str = Field(pattern=r"^\d{6}$")


class EmailActionOut(BaseModel):
    message: str
    email: str | None = None
    email_sent: bool | None = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    created_at: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, name=user.name, email=user.email, created_at=user.created_at.isoformat())


@router.post("/register", response_model=EmailActionOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> EmailActionOut:
    if db.scalar(select(User.id).where(User.email == payload.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_email_verified=False,
    )
    db.add(user)
    try:
        db.flush()
        code = generate_code()
        db.add(
            EmailVerification(
                user_id=user.id,
                code_hash=hash_code(user.id, code),
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
                failed_attempts=0,
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    try:
        send_verification_email(user.email, code, purpose="registration", user_id=user.id)
    except EmailDeliveryError:
        return EmailActionOut(
            message="Account created, but we could not send the verification email. Use Resend Code to try again.",
            email=user.email,
            email_sent=False,
        )
    return EmailActionOut(
        message="Account created. Check your email for a verification code.",
        email=user.email,
        email_sent=True,
    )


@router.post("/verify-email", response_model=EmailActionOut)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> EmailActionOut:
    user = db.scalar(select(User).where(User.email == payload.email))
    verification = (
        db.scalar(
            select(EmailVerification)
            .where(EmailVerification.user_id == user.id)
            .with_for_update()
        )
        if user is not None
        else None
    )
    if user is None or verification is None or user.is_email_verified:
        verify_code(0, payload.code, "0" * 64)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The code is invalid or expired.")
    if verification.failed_attempts >= 5:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Request a new code.")
    if verification.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The code is invalid or expired.")
    if not verify_code(user.id, payload.code, verification.code_hash):
        verification.failed_attempts += 1
        db.commit()
        if verification.failed_attempts >= 5:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Request a new code.")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The code is invalid or expired.")

    user.is_email_verified = True
    user.email_verified_at = datetime.now(timezone.utc)
    db.delete(verification)
    db.commit()
    return EmailActionOut(message="Email verified. You can now sign in.")


RESEND_COOLDOWN = timedelta(seconds=60)
RESEND_MESSAGE = "If this email is eligible, a verification code has been sent."


@router.post("/resend-verification", response_model=EmailActionOut, status_code=202)
def resend_verification(payload: EmailRequest, db: Session = Depends(get_db)) -> EmailActionOut:
    if not email_delivery_configured():
        email_logger.error("purpose=resend user_id=unknown result=not_configured")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Email delivery is not configured. Please try again later.",
        )
    user = db.scalar(select(User).where(User.email == payload.email).with_for_update())
    if user is None or user.is_email_verified:
        email_logger.info("purpose=resend user_id=none result=skipped reason=not_eligible")
        return EmailActionOut(message=RESEND_MESSAGE)

    current = db.scalar(
        select(EmailVerification)
        .where(EmailVerification.user_id == user.id)
        .with_for_update()
    )
    now = datetime.now(timezone.utc)
    if current is not None:
        created_at = current.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if now - created_at < RESEND_COOLDOWN:
            email_logger.info("purpose=resend user_id=%s result=skipped reason=cooldown", user.id)
            return EmailActionOut(message=RESEND_MESSAGE)

    code = generate_code()
    if current is not None:
        db.delete(current)
        db.flush()
    db.add(
        EmailVerification(
            user_id=user.id,
            code_hash=hash_code(user.id, code),
            expires_at=now + timedelta(minutes=10),
            failed_attempts=0,
            created_at=now,
        )
    )
    try:
        send_verification_email(user.email, code, purpose="resend", user_id=user.id)
        db.commit()
    except EmailDeliveryError:
        db.rollback()
    except IntegrityError:
        db.rollback()
        email_logger.error("purpose=resend user_id=%s result=failed category=db_conflict", user.id)
    return EmailActionOut(message=RESEND_MESSAGE)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not verify_password(payload.password, user.password_hash if user else None):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not user.is_email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Please verify your email before signing in.",
            headers={"X-Auth-Reason": "email_not_verified"},
        )
    return TokenOut(access_token=create_access_token(user), user=_user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return _user_out(user)

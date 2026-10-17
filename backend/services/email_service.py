import logging
import os
import smtplib
import socket
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

logger = logging.getLogger("jaypilot.email")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     [email] %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


class EmailDeliveryError(Exception):
    def __init__(self, category: str = "unknown"):
        super().__init__(category)
        self.category = category


def email_delivery_configured() -> bool:
    host = os.getenv("SMTP_HOST")
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM_EMAIL")
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        return False
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower()
    return bool(
        host
        and username
        and password
        and sender
        and 1 <= port <= 65535
        and use_tls in {"true", "false"}
    )


def _categorize(error: Exception) -> str:
    if isinstance(error, smtplib.SMTPAuthenticationError):
        return "auth_failed"
    if isinstance(error, smtplib.SMTPRecipientsRefused):
        return "recipient_refused"
    if isinstance(error, smtplib.SMTPSenderRefused):
        return "sender_refused"
    if isinstance(error, (TimeoutError, socket.timeout)):
        return "timeout"
    if isinstance(error, (ssl.SSLError, smtplib.SMTPNotSupportedError)):
        return "tls_failed"
    if isinstance(error, (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, OSError)):
        return "connection_failed"
    if isinstance(error, smtplib.SMTPResponseException):
        return f"smtp_error_{error.smtp_code}"
    return "smtp_error"


def send_verification_email(
    recipient: str, code: str, *, purpose: str = "verification", user_id: int | None = None
) -> None:
    """Send the code to `recipient`. Logs only the outcome category, never the code or credentials."""
    who = f"user_id={user_id}" if user_id is not None else "user_id=unknown"
    if not email_delivery_configured():
        logger.error("purpose=%s %s result=not_configured", purpose, who)
        raise EmailDeliveryError("not_configured")

    host = os.environ["SMTP_HOST"]
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]
    sender = os.environ["SMTP_FROM_EMAIL"]
    port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() == "true"

    message = EmailMessage()
    message["Subject"] = "Your JayPilot AI verification code"
    message["From"] = formataddr(("JayPilot AI", sender))
    message["To"] = recipient
    message["Date"] = formatdate(localtime=False)
    message["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1])
    message["Auto-Submitted"] = "auto-generated"
    message.set_content(
        f"Your JayPilot AI verification code is {code}.\n\n"
        "This code expires in 10 minutes. If you did not create this account, "
        "you can ignore this message."
    )

    logger.info("purpose=%s %s result=attempting", purpose, who)
    try:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            if use_tls:
                smtp.starttls(context=ssl.create_default_context())
            smtp.login(username, password)
            refused = smtp.send_message(message)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
    except (OSError, smtplib.SMTPException) as error:
        category = _categorize(error)
        logger.error("purpose=%s %s result=failed category=%s", purpose, who, category)
        raise EmailDeliveryError(category) from None
    logger.info("purpose=%s %s result=accepted_by_smtp_server", purpose, who)

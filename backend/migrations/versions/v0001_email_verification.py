from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

REVISION = "0001_email_verification"


def upgrade(connection: Connection) -> None:
    from models import EmailVerification

    EmailVerification.__table__.create(connection, checkfirst=True)
    columns = {column["name"] for column in inspect(connection).get_columns("users")}
    legacy_schema = "is_email_verified" not in columns

    if legacy_schema:
        connection.execute(
            text(
                "ALTER TABLE users ADD COLUMN is_email_verified "
                "BOOLEAN NOT NULL DEFAULT TRUE"
            )
        )
    if "email_verified_at" not in columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ"))

    connection.execute(
        text(
            "UPDATE users SET email_verified_at = COALESCE(created_at, CURRENT_TIMESTAMP) "
            "WHERE is_email_verified = TRUE AND email_verified_at IS NULL"
        )
    )
    if legacy_schema:
        connection.execute(
            text("ALTER TABLE users ALTER COLUMN is_email_verified DROP DEFAULT")
        )

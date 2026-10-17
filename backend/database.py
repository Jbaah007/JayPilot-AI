import os
from collections.abc import Iterator
from pathlib import Path
from urllib.parse import unquote

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy import text

load_dotenv(Path(__file__).resolve().parent / ".env")


class Base(DeclarativeBase):
    pass


def _build_url() -> URL:
    """Build a SQLAlchemy URL safely from either discrete settings or DATABASE_URL."""
    db_host = os.getenv("DB_HOST")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")
    if all((db_host, db_user, db_password, db_name)):
        return URL.create(
            drivername="postgresql+psycopg2",
            username=db_user,
            password=db_password,
            host=db_host,
            port=int(os.getenv("DB_PORT", "5432")),
            database=db_name,
        )

    raw = os.getenv("DATABASE_URL")
    if not raw:
        raise RuntimeError("DATABASE_URL is not set in backend/.env")

    scheme, _, rest = raw.partition("://")
    credentials, _, location = rest.rpartition("@")
    username, _, password = credentials.partition(":")
    hostport, _, database = location.partition("/")
    host, _, port = hostport.partition(":")

    drivername = scheme if "+" in scheme else "postgresql+psycopg2"
    return URL.create(
        drivername=drivername,
        username=unquote(username),
        password=unquote(password) if password else None,
        host=host or "localhost",
        port=int(port) if port else 5432,
        database=database.split("?")[0] or None,
    )


engine = create_engine(_build_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    import models  # noqa: F401  registers tables on Base

    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                "version VARCHAR(64) PRIMARY KEY, "
                "applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        from migrations.versions.v0001_email_verification import REVISION, upgrade

        applied = connection.scalar(
            text("SELECT 1 FROM schema_migrations WHERE version = :version"),
            {"version": REVISION},
        )
        if applied is None:
            upgrade(connection)
            connection.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:version)"),
                {"version": REVISION},
            )

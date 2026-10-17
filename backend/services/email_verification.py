import hashlib
import hmac
import os
import secrets


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(user_id: int, code: str) -> str:
    secret = os.getenv("JWT_SECRET_KEY")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY is not configured")
    message = f"jaypilot-email-verification:{user_id}:{code}".encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_code(user_id: int, code: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_code(user_id, code), stored_hash)

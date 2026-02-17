# backend/src/auth/otp_service.py
import secrets
from datetime import datetime, timedelta

import pyotp
from sqlalchemy.orm import Session

from .models import TwoFactorCode, User

# Keep a small shim to not crash if email service missing — we won't email TOTP codes anyway.
try:
    from .email_service import send_email as _send_email
    def send_email(to_email: str, subject: str, html: str):
        try:
            _send_email(to_email, subject, html)
        except Exception:
            # non-fatal
            pass
except Exception:
    def send_email(to_email: str, subject: str, html: str):
        # noop in fallback
        pass

def _gen_ticket() -> str:
    return secrets.token_urlsafe(24)   # ~32-char token

def _now_plus(minutes: int):
    return datetime.utcnow() + timedelta(minutes=minutes)

def generate_totp_secret() -> str:
    """Return a new base32 secret for TOTP (to be stored on the User)."""
    return pyotp.random_base32()

def get_otpauth_uri(secret: str, user_email: str, issuer: str = "CreditAI") -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=user_email, issuer_name=issuer)

def create_and_send_login_otp(db: Session, user: User) -> str:
    """
    For compatibility with existing imports we keep the function name.
    Now: create a short-lived 'ticket' record tied to user, used to verify TOTP.
    We DO NOT email anything — TOTP is provided via user's authenticator app.
    """
    ticket = _gen_ticket()
    record = TwoFactorCode(
        user_id=user.id,
        purpose="login",
        ticket=ticket,
        code=None,
        expires_at=_now_plus(5),  # ticket valid for 5 minutes
        used=False,
    )
    db.add(record)
    db.commit()
    return ticket

def resend_login_otp(db: Session, ticket: str) -> str:
    """
    For authenticator flow, 'resend' isn't applicable (user's app generates codes).
    We'll issue a fresh ticket (short-lived) so frontend can continue.
    """
    rec = db.query(TwoFactorCode).filter(
        TwoFactorCode.ticket == ticket,
        TwoFactorCode.purpose == "login",
    ).order_by(TwoFactorCode.id.desc()).first()
    if not rec:
        raise ValueError("Invalid ticket")
    # mark old one used to avoid reuse
    rec.used = True
    db.add(rec)
    db.commit()
    return create_and_send_login_otp(db, db.get(User, rec.user_id))

def verify_login_otp(db: Session, ticket: str, code: str) -> int:
    """
    Verify a TOTP 6-digit code using user's stored TOTP secret.
    Returns user_id if OK, raises ValueError otherwise.
    """
    rec = db.query(TwoFactorCode).filter(
        TwoFactorCode.ticket == ticket,
        TwoFactorCode.purpose == "login",
        TwoFactorCode.used == False,
    ).order_by(TwoFactorCode.id.desc()).first()
    if not rec:
        raise ValueError("Invalid ticket")

    if rec.expires_at < datetime.utcnow():
        raise ValueError("Ticket expired")

    user = db.get(User, rec.user_id)
    if not user:
        raise ValueError("Invalid user")

    if not getattr(user, "totp_secret", None):
        raise ValueError("User has no TOTP setup")

    # accept 6-digit numeric TOTP codes
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code, valid_window=1):  # allow 1 window drift (30s)
        raise ValueError("Invalid code")

    # success
    rec.used = True
    db.add(rec)
    db.commit()
    return rec.user_id

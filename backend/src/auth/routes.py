# backend/src/auth/routes.py
import os
from datetime import datetime, timedelta
from typing import Optional

import pyotp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, model_validator, AliasChoices, ConfigDict
from sqlalchemy.orm import Session

from ..db import SessionLocal
from .models import User, RoleEnum
from .utils import (
    hash_password,
    verify_password,
    create_access_token,
    generate_reset_token,
    generate_verification_token,
    get_current_user,   
)

# -------------------------------------------------------------------
# Config / helpers
# -------------------------------------------------------------------
SEED_BYPASS = {
    e.strip().lower()
    for e in os.getenv("AUTH_SEED_BYPASS_EMAILS", "").split(",")
    if e.strip()
}

def mask_email(email: str) -> str:
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        masked = name[0] + "***"
    else:
        masked = name[0] + "***" + name[-1]
    return f"{masked}@{domain}"

def get_otpauth_uri(secret: str, email: str, issuer: str = "CreditAI") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)

def generate_totp_secret() -> str:
    return pyotp.random_base32()

# Real email service if configured; otherwise simulate in console
try:
    from .email_service import send_email
except Exception:
    def send_email(to_email: str, subject: str, html_body: str):
        print(f"[SIMULATED EMAIL to {to_email}] {subject}\n{html_body}\n")

router = APIRouter(prefix="/auth", tags=["auth"])

# -------------------------------------------------------------------
# DB dependency
# -------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------------------------------------------------------
# Schemas
# -------------------------------------------------------------------
class RegisterIn(BaseModel):
    # accept both "full_name" and "fullName"
    full_name: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("full_name", "fullName"),
        serialization_alias="full_name",
    )
    email: EmailStr
    password: str
    confirm_password: str

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

class RegisterOut(BaseModel):
    message: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class LoginOut(BaseModel):
    # Handles both seed-bypass (token) and TOTP prompt
    twofa_required: bool
    ticket: Optional[str] = None
    masked_email: Optional[str] = None
    message: Optional[str] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"

class TwoFAVerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ProvisionIn(BaseModel):
    email: EmailStr

class ProvisionOut(BaseModel):
    email: EmailStr
    totp_secret: str
    otpauth_uri: str

# ---- Password reset schemas
class RequestResetIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

# Optional: change password (authenticated)
class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

# -------------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------------

def build_signup_pending_email(display_name: str, login_url: str) -> str:
    """Return a clean HTML email for 'pending admin approval'."""
    return f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Segoe UI, Roboto, Arial, sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;background:#0f172a;color:#ffffff;">
                <div style="font-weight:800;font-size:18px;letter-spacing:.2px;">CreditAI</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 8px 0;font-size:20px;color:#0f172a;">Welcome to CreditAI, {display_name} 👋</h1>
                <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#334155;">
                  Your account has been created and is currently <b>pending administrator approval</b>.
                  You’ll receive another email as soon as your access is activated.
                </p>

                <div style="margin:18px 0 8px 0;font-weight:700;color:#0f172a;">What happens next?</div>
                <ol style="margin:8px 0 16px 18px;padding:0;color:#334155;font-size:14px;line-height:1.6;">
                  <li>Admin reviews and approves your account.</li>
                  <li>You’ll then be able to sign in and complete <b>Two-Factor Authentication (2FA)</b>.</li>
                  <li>Access your dashboard and start using CreditAI.</li>
                </ol>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 6px 0;">
                  <tr>
                    <td>
                      <a href="{login_url}"
                         style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;
                                padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;">
                        Go to Login
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;">
                  If the button doesn’t work, copy and paste this link into your browser:<br>
                  <span style="color:#334155;">{login_url}</span>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;">
                Need help? Reply to this email or contact support.
                <br>© {datetime.utcnow().year} CreditAI. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    """
    Create account in PENDING state:
      - role = CUSTOMER (temporary)
      - is_active = False
    Admin must later approve/assign role.
    """
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=RoleEnum.CUSTOMER,   # NOT NULL column; safe default
        is_active=False,          # not active until admin approval
        is_verified=False,        # optional email verification
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Notify User via email on pending approval
    try:
        display_name = (user.full_name or user.email.split("@")[0]).strip().title()
        login_url = f"http://localhost:5173/login?email={user.email}"
        html_body = build_signup_pending_email(display_name, login_url)
        send_email(user.email, "Welcome to CreditAI — Account Pending Approval", html_body)
    except Exception:
        pass

    return {"message": "Account created. Pending admin approval."}

@router.post(
    "/login",
    response_model=LoginOut,
    responses={403: {"description": "Account pending approval"}},
)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    """
    Step A: Verify credentials only.
    If approved & active -> ask for TOTP (6 digits from authenticator app).
    No email/SMS code is sent and no JWT is returned here (unless seed bypass).
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.role is None or not user.is_active:
        raise HTTPException(status_code=403, detail="Account pending admin approval")

    # Optional: seed bypass (dev)
    if user.email.lower() in SEED_BYPASS:
        token = create_access_token(
            subject=str(user.id),
            data={"role": (user.role.value if hasattr(user.role, "value") else user.role),
                  "email": user.email},
        )
        return {
            "twofa_required": False,
            "ticket": "",
            "masked_email": mask_email(user.email),
            "message": "Seed bypass: logged in",
            "access_token": token,
            "token_type": "bearer",
        }

    # Normal TOTP flow
    return {
        "twofa_required": True,
        "ticket": None,  # not used for TOTP
        "masked_email": mask_email(user.email),
        "message": "Enter the 6-digit code from your Authenticator app",
    }

@router.post("/2fa/provision", response_model=ProvisionOut)
def provision_2fa(payload: ProvisionIn, db: Session = Depends(get_db)):
    """
    Generate (or return existing) TOTP secret for a user and return an otpauth:// URI.
    Frontend will show this as a QR for Google Authenticator / Authy / Microsoft Authenticator.
    (In production, protect this route to the logged-in user only.)
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User not active")

    if not getattr(user, "totp_secret", None):
        user.totp_secret = generate_totp_secret()
        db.add(user)
        db.commit()
        db.refresh(user)

    uri = get_otpauth_uri(user.totp_secret, user.email, issuer="CreditAI")
    return {"email": user.email, "totp_secret": user.totp_secret, "otpauth_uri": uri}

# ---------------- Password Reset (fixed: DateTime expiries) ----------------

@router.post("/request-reset")
def request_reset(payload: RequestResetIn, db: Session = Depends(get_db)):
    """
    Generate a reset token + DateTime expiry, email the reset URL.
    Response is identical whether or not the email exists (no enumeration).
    """
    user = db.query(User).filter(User.email == payload.email).first()

    if user:
        token = generate_reset_token()
        user.reset_token = token
        user.reset_token_expires = datetime.utcnow() + timedelta(minutes=20)  # DateTime (correct type)
        db.add(user)
        db.commit()

        reset_url = f"http://localhost:5173/reset-password?token={token}"
        try:
            send_email(
                user.email,
                "Password reset",
                (
                    "<p>Reset your password using the link below (valid 20 min):</p>"
                    f"<p><a href='{reset_url}'>{reset_url}</a></p>"
                ),
            )
        except Exception:
            # non-fatal for API
            pass

    # Always the same response
    return {"msg": "If that email exists, a reset link was sent."}

@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    """
    Validate token + expiry, set new password, clear token fields.
    """
    user = db.query(User).filter(User.reset_token == payload.token).first()
    if not user or not user.reset_token_expires or datetime.utcnow() > user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user.hashed_password = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.add(user)
    db.commit()
    return {"msg": "Password reset successful"}

# ---------------- Email Verification (optional) ----------------

class RequestVerifyIn(BaseModel):
    email: EmailStr

class VerifyEmailIn(BaseModel):
    token: str

@router.post("/request-verification")
def request_verification(payload: RequestVerifyIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        token = generate_verification_token()
        user.verification_token = token
        user.verification_expires = datetime.utcnow() + timedelta(minutes=30)
        db.add(user)
        db.commit()

        verify_url = f"http://localhost:5173/verify-email?token={token}"
        try:
            send_email(
                user.email,
                "Verify your email",
                (
                    "<p>Click the link to verify (valid 30 min):</p>"
                    f"<p><a href='{verify_url}'>{verify_url}</a></p>"
                ),
            )
        except Exception:
            pass

    return {"msg": "If that email exists, a verification link was sent."}

@router.post("/verify-email")
def verify_email(payload: VerifyEmailIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == payload.token).first()
    if not user or not user.verification_expires or datetime.utcnow() > user.verification_expires:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user.is_verified = True
    user.verification_token = None
    user.verification_expires = None
    db.add(user)
    db.commit()
    return {"msg": "Email verified successfully", "email": user.email, "is_verified": user.is_verified}

@router.post("/2fa/verify", response_model=TokenOut)
def twofa_verify(payload: TwoFAVerifyIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA not provisioned")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(payload.code, valid_window=1):  # allow +/- 30s drift
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    token = create_access_token(
        subject=str(user.id),
        data={"role": (user.role.value if hasattr(user.role, "value") else user.role),
              "email": user.email},
    )
    return {"access_token": token, "token_type": "bearer"}

# ---------------- Optional: Change Password (authenticated) ----------------

@router.post("/change-password")
def change_password(payload: ChangePasswordIn,
                    current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """
    Authenticated users can change their password by providing the current one.
    """
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
    return {"msg": "Password changed successfully"}

# backend/src/auth/email_service.py
import os, smtplib, ssl
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("EMAIL_PORT", "587"))
SMTP_USER = os.getenv("EMAIL_USER")
SMTP_PASS = os.getenv("EMAIL_PASS")
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER or "")
USE_TLS   = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"   # STARTTLS on 587
USE_SSL   = os.getenv("EMAIL_USE_SSL", "false").lower() == "true"  # SMTPS on 465

def send_email(to_email: str, subject: str, html_body: str):
    if not SMTP_USER or not SMTP_PASS:
        raise RuntimeError(
            "EMAIL_USER/EMAIL_PASS are not set. "
            "Use a Gmail App Password (16 chars, no spaces)."
        )

    msg = MIMEText(html_body, "html", "utf-8")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM or SMTP_USER
    msg["To"] = to_email

    try:
        if USE_SSL:
            # e.g., Gmail on 465
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, 465, context=context) as server:
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(msg["From"], [to_email], msg.as_string())
        else:
            # Default: STARTTLS on 587
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.ehlo()
                if USE_TLS:
                    server.starttls(context=ssl.create_default_context())
                    server.ehlo()
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(msg["From"], [to_email], msg.as_string())
    except smtplib.SMTPAuthenticationError as e:
        # Most common Gmail failure
        raise RuntimeError(
            "SMTP auth failed (535). "
            "Double-check EMAIL_USER and your **16-char app password** in EMAIL_PASS. "
            "Ensure 2-Step Verification is ON and this app password belongs to that Gmail."
        ) from e
    except Exception as e:
        # Bubble up with context
        raise RuntimeError(f"SMTP send failed: {e}") from e

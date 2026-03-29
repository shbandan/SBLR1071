import smtplib
from email.mime.text import MIMEText
import os
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

AZ_TZ = ZoneInfo("America/Phoenix")


def _az_now(fmt: str = "%m/%d/%Y %I:%M %p MST") -> str:
    """Return the current Arizona (Phoenix, MST) time as a formatted string."""
    return datetime.now(tz=AZ_TZ).strftime(fmt)


def send_collection_email(recipient_email: str, form_url: str, borrower_name: str = "Borrower") -> None:
    """Send a plain-text CFPB 1071 data-collection request email to a borrower."""
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    #sender_email = os.getenv("SENDER_EMAIL", "s.bandanatham@gmail.com")
    #sender_password = os.getenv("SENDER_PASSWORD", "bsuc cfdr jenu vxkj")
    sender_email = os.getenv("SENDER_EMAIL", "jyotishna935@gmail.com")
    sender_password = os.getenv("SENDER_PASSWORD", "ktwa izwq kain uhim")
    # ASCII-only display name — non-ASCII characters (e.g. em dashes) in the
    # From header are encoded via RFC-2047 but some spam filters penalise them.
    sender_name = os.getenv("SENDER_NAME", "Shashi System 1071 Compliance")

    # Avoid common spam-trigger phrases ("Action Required", "Urgent", etc.)
    subject = "Your CFPB 1071 Compliance Form - Shashi System"
    sent_at = _az_now()

    # Plain-text only email body with a direct link to the collection form.
    text_content = f"""\
CFPB 1071 Data Collection Request
===================================

Dear {borrower_name},

Shashi System is required to collect small business lending data under
the Consumer Financial Protection Bureau (CFPB) Regulation B, Section 1071.

Please complete your secure 1071 form using the link below:

  {form_url}

If you did not expect this request, please contact us directly.

Request sent: {sent_at}

--
Shashi System, Member FDIC
This is an automated message - please do not reply to this email.
"""

    # ── Dev / mock mode ───────────────────────────────────────────────────────
    if smtp_server == "smtp.example.com":
        print(f"\n{'='*60}")
        print(f"[MOCK] EMAIL TO: {recipient_email}")
        print(f"[MOCK] BORROWER: {borrower_name}")
        print(f"[MOCK] SUBJECT:  {subject}")
        print(f"[MOCK] URL:      {form_url}")
        print(f"{'='*60}\n")
        return

    # Send
    try:
        msg = MIMEText(text_content, "plain", "utf-8")
        msg["MIME-Version"] = "1.0"
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{sender_email}>"
        msg["To"] = recipient_email
        msg["Reply-To"] = sender_email
        msg["Message-ID"] = f"<{uuid.uuid4()}@sblr1071.compliance.local>"
        msg["Date"] = datetime.now(tz=AZ_TZ).strftime("%a, %d %b %Y %H:%M:%S %z")
        # List-Unsubscribe makes the email look legitimate to Gmail/Outlook
        msg["List-Unsubscribe"] = f"<mailto:{sender_email}?subject=Unsubscribe>"
        msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            if sender_password:
                server.login(sender_email, sender_password)
            server.send_message(msg)
            print(f"[email] Sent successfully to {recipient_email}")

    except Exception as e:
        print(f"[email] Failed to send to {recipient_email}: {e}")
        raise

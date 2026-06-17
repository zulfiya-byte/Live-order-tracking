import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST  = os.getenv("SMTP_HOST", "")
SMTP_PORT  = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER  = os.getenv("SMTP_USER", "")
SMTP_PASS  = os.getenv("SMTP_PASS", "")
SMTP_FROM  = os.getenv("SMTP_FROM", "noreply@pxpsolutions.com")
PORTAL_URL = os.getenv("PORTAL_URL", "http://localhost:5173")


def send_invite_email(to_email: str, company_name: str, token: str):
    invite_url = f"{PORTAL_URL}/set-password?token={token}"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F9FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F9FC;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0D6F94,#1A9ED4);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">ORDER PORTAL ACCESS</p>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">You've been invited to<br>PXP Solutions</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px;">
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
              Hi there,
            </p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              PXP Solutions has created an order portal account for <strong style="color:#0F172A;">{company_name}</strong>.
              You can now track all your orders in real time — production status, shipment tracking, and more.
            </p>

            <!-- CTA button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#0369A1;border-radius:12px;padding:14px 32px;">
                  <a href="{invite_url}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;display:block;">
                    Create Your Password &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#94A3B8;font-size:12px;">
              Or copy this link into your browser:
            </p>
            <p style="margin:0 0 28px;word-break:break-all;">
              <a href="{invite_url}" style="color:#0369A1;font-size:12px;font-family:monospace;">{invite_url}</a>
            </p>

            <!-- Divider -->
            <hr style="border:none;border-top:1px solid #E2E8F0;margin:0 0 24px;">

            <p style="margin:0 0 8px;color:#64748B;font-size:13px;line-height:1.6;">
              <strong style="color:#0F172A;">Your login email:</strong> {to_email}
            </p>
            <p style="margin:0;color:#94A3B8;font-size:12px;line-height:1.6;">
              This invite link expires in <strong>72 hours</strong>. If it expires, contact your PXP representative for a new one.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;border-radius:0 0 16px 16px;padding:20px 40px;border-top:1px solid #E2E8F0;">
            <p style="margin:0;color:#94A3B8;font-size:11px;text-align:center;">
              &copy; 2025 PXP Solutions &mdash; This email was sent to {to_email}.<br>
              If you didn't expect this, you can safely ignore it.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your PXP Solutions Order Portal Invitation"
    msg["From"]    = f"PXP Solutions <{SMTP_FROM}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls(context=context)
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())

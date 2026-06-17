import os
import json
import urllib.request
import urllib.parse
import urllib.error

GRAPH_TENANT_ID     = os.getenv("GRAPH_TENANT_ID", "")
GRAPH_CLIENT_ID     = os.getenv("GRAPH_CLIENT_ID", "")
GRAPH_CLIENT_SECRET = os.getenv("GRAPH_CLIENT_SECRET", "")
SMTP_FROM           = os.getenv("SMTP_FROM", "no-reply@pxpsolutions.com")
PORTAL_URL          = os.getenv("PORTAL_URL", "http://localhost:5173")


def _get_graph_token() -> str:
    if not (GRAPH_TENANT_ID and GRAPH_CLIENT_ID and GRAPH_CLIENT_SECRET):
        raise RuntimeError("Microsoft Graph credentials are not configured.")

    data = urllib.parse.urlencode({
        "grant_type":    "client_credentials",
        "client_id":     GRAPH_CLIENT_ID,
        "client_secret": GRAPH_CLIENT_SECRET,
        "scope":         "https://graph.microsoft.com/.default",
    }).encode()

    req = urllib.request.Request(
        f"https://login.microsoftonline.com/{GRAPH_TENANT_ID}/oauth2/v2.0/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"Graph token error {e.code}: {body}")

    if "access_token" not in result:
        raise RuntimeError(f"Graph token failed: {result.get('error_description', result)}")

    return result["access_token"]


def _send(to_email: str, subject: str, html: str):
    token = _get_graph_token()

    payload = json.dumps({
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": html},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
            "from": {"emailAddress": {"address": SMTP_FROM}},
        },
        "saveToSentItems": False,
    }).encode()

    req = urllib.request.Request(
        f"https://graph.microsoft.com/v1.0/users/{SMTP_FROM}/sendMail",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"Graph sendMail error {e.code}: {body}")


def send_invite_email(to_email: str, company_name: str, token: str):
    invite_url = f"{PORTAL_URL}/set-password?token={token}"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F9FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F9FC;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0D6F94,#1A9ED4);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">ORDER PORTAL ACCESS</p>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">You've been invited to<br>PXP Solutions</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 40px;">
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">Hi there,</p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              PXP Solutions has created an order portal account for <strong style="color:#0F172A;">{company_name}</strong>.
              You can now track all your orders in real time.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#0369A1;border-radius:12px;padding:14px 32px;">
                  <a href="{invite_url}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;display:block;">
                    Create Your Password &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#94A3B8;font-size:12px;">Or copy this link into your browser:</p>
            <p style="margin:0 0 28px;word-break:break-all;">
              <a href="{invite_url}" style="color:#0369A1;font-size:12px;font-family:monospace;">{invite_url}</a>
            </p>
            <hr style="border:none;border-top:1px solid #E2E8F0;margin:0 0 24px;">
            <p style="margin:0 0 8px;color:#64748B;font-size:13px;">
              <strong style="color:#0F172A;">Your login email:</strong> {to_email}
            </p>
            <p style="margin:0;color:#94A3B8;font-size:12px;">
              This invite link expires in <strong>72 hours</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border-radius:0 0 16px 16px;padding:20px 40px;border-top:1px solid #E2E8F0;">
            <p style="margin:0;color:#94A3B8;font-size:11px;text-align:center;">
              &copy; 2026 PXP Solutions. Sent to {to_email}.<br>
              If you didn't expect this, you can safely ignore it.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    _send(to_email, "Your PXP Solutions Order Portal Invitation", html)


def send_reset_email(to_email: str, company_name: str, token: str):
    reset_url = f"{PORTAL_URL}/set-password?token={token}"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F9FC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F9FC;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0D6F94,#1A9ED4);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">PASSWORD RESET</p>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">Reset your<br>PXP Portal password</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 40px;">
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              We received a request to reset the password for <strong style="color:#0F172A;">{to_email}</strong>.
              Click the button below to choose a new password.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#0369A1;border-radius:12px;padding:14px 32px;">
                  <a href="{reset_url}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;display:block;">
                    Reset My Password &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#94A3B8;font-size:12px;">Or copy this link into your browser:</p>
            <p style="margin:0 0 28px;word-break:break-all;">
              <a href="{reset_url}" style="color:#0369A1;font-size:12px;font-family:monospace;">{reset_url}</a>
            </p>
            <hr style="border:none;border-top:1px solid #E2E8F0;margin:0 0 24px;">
            <p style="margin:0;color:#94A3B8;font-size:12px;">
              This link expires in <strong>72 hours</strong>. If you didn't request a reset, ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border-radius:0 0 16px 16px;padding:20px 40px;border-top:1px solid #E2E8F0;">
            <p style="margin:0;color:#94A3B8;font-size:11px;text-align:center;">
              &copy; 2026 PXP Solutions. Sent to {to_email}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    _send(to_email, "Reset your PXP Solutions portal password", html)

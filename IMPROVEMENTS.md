# PXP Order Portal — Known Improvements Backlog

> Created: June 2026. Work through these incrementally — sorted by priority.

---

## PRIORITY 1 — Do This Week (free or near-free, high impact)

- [ ] **UptimeRobot monitoring** — 15 min setup, free. Sends text/email if portal goes down. Sign up at uptimerobot.com, point it at the portal URL.
- [ ] **DigitalOcean daily snapshots** — $2/month. If the server dies, restore from last night's snapshot. Enable in the droplet settings.
- [ ] **Forgot password / email reset** — Clients will ask for this on day one. Add a reset link flow via email.
- [ ] **Login rate limiting** — Lock account after 10 failed attempts. Prevents brute force attacks.

---

## PRIORITY 2 — Next Month

- [ ] **Auto-refresh orders every 5 minutes** — Data goes stale while the tab is open. Silently re-fetch in the background.
- [ ] **"Last updated" timestamp** — Show "Last updated: 2 minutes ago" below the header so clients know how fresh the data is.
- [ ] **Email notification when order ships** — Automatic email to the client when `shipped` flips to true.
- [ ] **Pagination** — Load orders in pages of 100 instead of all at once. Needed for clients with large order histories.
- [ ] **Admin audit log** — Log every login and order fetch to a table. Know who accessed what and when.
- [ ] **Save filter preferences** — Remember last-used filters in localStorage so they persist across sessions.

---

## PRIORITY 3 — Future Roadmap

- [ ] **Two-factor authentication (2FA)** — Optional email code or authenticator app for high-value clients.
- [ ] **JWT token blacklist on logout** — Currently a stolen token is valid for up to 8 hours after logout. Requires Redis.
- [ ] **Order detail page** — Tap/click an order to see full history, all fields, and a timeline of status changes.
- [ ] **"Send message to PXP" per order** — Simple way for clients to ask a question about a specific order without calling.
- [ ] **Bulk client CSV import** — Upload a spreadsheet to create many client accounts at once instead of one by one.
- [ ] **Admin "View as client"** — Let an admin impersonate a client account to troubleshoot what they're seeing.
- [ ] **Artwork/document attachments** — Let clients download their art files. Requires file storage (S3 or similar).
- [ ] **Database index on company name** — As ShopWorks grows, queries slow down. One index fixes it. Needs DB access.
- [ ] **Query caching (60 seconds)** — Cache results per company so repeated page loads are instant.
- [ ] **Password complexity rules** — Enforce minimum length, 1 number, 1 special character at account creation.
- [ ] **Friendly maintenance page** — If ShopWorks goes down, show a proper "We'll be right back" page instead of an error.
- [ ] **Dark mode** — Optional toggle using Tailwind dark mode classes.

---

## Technical Debt Notes

- SSH tunnel to ShopWorks can drop silently — add auto-reconnect + health check endpoint
- No error logging currently — add Sentry (free tier) to capture and report runtime errors
- No HTTPS verification confirmed — verify Caddy SSL certificate is active and auto-renewing on the droplet

---

## Effort Reference

| Label | Meaning |
|---|---|
| Low | Half a day or less |
| Medium | 1-3 days |
| High | 1 week+ |

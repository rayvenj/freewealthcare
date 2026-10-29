# Security

## Threat model (v0.1)

FreeWealthCare is a static web app. All data is stored in the browser's
IndexedDB on the user's device. There is no backend, no user accounts, and no
network calls after the page loads.

| Threat | Mitigation |
| --- | --- |
| Server breach leaks users' finances | There is no server holding user data. |
| Injected script exfiltrates data (XSS, compromised dependency) | First line: keep hostile script from ever running. Only same-origin scripts may load (`script-src 'self'`), React escapes all rendered text, and `dangerouslySetInnerHTML`, `eval` and implied eval are lint errors. Second line: CSP sets `connect-src 'none'` and `form-action 'none'`, blocking fetch, XHR, WebSockets, beacons and form posts. **This does not stop every channel.** Script already running in the page could still read local data and navigate the whole page to an outside URL, which CSP cannot block. Hence the emphasis on preventing script injection and keeping dependencies few. |
| Malicious backup or CSV file | Backups are schema-validated with Zod (types, lengths, integer cents, referential integrity) before anything is written. Unknown fields are dropped. CSV and backup imports have size and row caps. |
| Restore half-applies and corrupts data | Restore runs in a single IndexedDB transaction: all or nothing. |
| Money math errors | All amounts are integer cents. A test enforces the budget balancing invariant. |
| Referrer or analytics leakage | `referrer: no-referrer`. No analytics, no third-party scripts, no fonts from CDNs. |

## Known limitations (be honest about these)

- **Data at rest is not encrypted.** Anyone with access to the unlocked device
  and browser profile can read it. Optional passphrase encryption is on the
  roadmap.
- **Backups are plain JSON.** Treat a backup file like a bank statement.
- **Clearing browser data deletes the budget.** Export backups regularly.
- **CSP is delivered as a `<meta>` tag**, which cannot set `frame-ancestors`.
  When a host is chosen, send the same policy as an HTTP header and add
  `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, and
  `Strict-Transport-Security`.

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private
vulnerability reporting ("Report a vulnerability" under the Security tab).
Expect an acknowledgement within 72 hours.

# Roadmap

Ship small, ship often. Each milestone should be usable on its own.

| Milestone | Scope | Status |
| --- | --- | --- |
| **v0.1 Foundation** | Accounts, categories, manual transactions, zero-based monthly budget with rollover, bank CSV import with dedupe, JSON backup/restore, strict CSP, CI | Done |
| **v0.2 Daily driver** | Transfers between accounts; credit card handling (payments are not spending); edit a transaction in place; search and filter; rename/archive categories; hosted deploy with security headers | Next |
| **v0.3 Trust** | Optional passphrase encryption at rest (WebCrypto, AES-GCM, PBKDF2/Argon2); encrypted backups; installable PWA that works fully offline | Planned |
| **v0.4 Insight** | Spending by category over time; age of money; goal targets per category ("$600 by December") | Planned |
| **v0.5 Automation** | Payee rules (auto-categorize on import); recurring transactions; CSV column mapper for unusual bank formats | Planned |
| **Later, maybe** | Optional end-to-end encrypted sync between your own devices. Bank connections only if they can be done without us ever seeing credentials or data. | Research |

## Explicit non-goals

- Selling, sharing or analyzing user data. Ever.
- Investment advice.
- Ads.

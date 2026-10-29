# Deploying to Cloudflare Pages

FreeWealthCare is a static site. There is no server, database or secret to
configure.

## Project settings

| Setting | Value |
| --- | --- |
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Production branch | `master` |
| Node.js | 22, pinned by `.node-version` |
| Environment variables | None |

The build runs the TypeScript check before bundling, so a type error fails
the deploy instead of shipping.

## Security headers

`npm run build` writes `dist/_headers`, which Cloudflare applies to every
response (and does not serve as a file). It is generated in `vite.config.ts`
from the same CSP as the `<meta>` tag, so the two never drift. Edit the CSP
there, never in `dist/`.

| Header | Why |
| --- | --- |
| `Content-Security-Policy` | Only our own scripts and styles; no network connections; no framing |
| `X-Frame-Options: DENY` | Clickjacking protection for older browsers |
| `X-Content-Type-Options: nosniff` | No MIME sniffing |
| `Referrer-Policy: no-referrer` | Outbound links reveal nothing |
| `Permissions-Policy` | Camera, mic, location, payment and USB off |
| `Cross-Origin-Opener-Policy: same-origin` | Isolates the window from pages it opens or is opened by |
| `Strict-Transport-Security` | HTTPS only, one year |
| `Cache-Control: immutable` on `/assets/*` | Fingerprinted files cached forever; `index.html` is not |
| `X-Robots-Tag: noindex` on preview URLs | Branch and commit previews stay out of search results |

## Dashboard settings to leave off

These inject third-party or inline scripts, which the CSP will block (by
design) and which would undercut the "no tracking" promise:

- Web Analytics (automatic setup) for this project
- Zaraz
- Rocket Loader, Email Address Obfuscation and other script-injecting
  features on a custom domain's zone

## Verify a deploy

Replace the URL with your production or preview URL:

```bash
curl -sI https://freewealthcare.pages.dev/ | grep -iE "content-security-policy|x-frame-options|strict-transport|permissions-policy"
```

Expect `frame-ancestors 'none'` and `connect-src 'none'` in the CSP line.
Then open the site, press F12, and confirm the Console shows no CSP errors and
the Network tab shows no requests to any other domain.

The template download should also work:

```bash
curl -s https://freewealthcare.pages.dev/templates/1099-contractor.json | head -3
```

## Roll back

Cloudflare dashboard, then **Workers & Pages**, then the project, then
**Deployments**. On the last good deployment, choose **Rollback to this
deployment**. Nothing to migrate: all user data lives in each user's browser.

# Using Vercel to Improve `moorehospitality.xyz`

This guide focuses on practical ways to use Vercel for a marketing/landing page.

## 1) Host on Vercel for speed and reliability

- Connect your GitHub/GitLab repo to Vercel and enable automatic deployments.
- Every push to `main` ships to production, and PRs get Preview Deployments.
- Benefit: safer design/content iterations because each PR has a shareable preview URL.

## 2) Improve Core Web Vitals (LCP, INP, CLS)

- If you use Next.js, use `next/image` with explicit width/height and modern formats (WebP/AVIF).
- Load only critical above-the-fold assets first; defer non-critical scripts.
- Self-host fonts via `next/font` and avoid large CSS/JS bundles.
- Benefit: faster first impression and better SEO ranking potential.

## 3) Add Edge caching + smart revalidation

- Use static generation for mostly-static sections (hero, testimonials, FAQs).
- For semi-dynamic content (offers/events), use ISR (`revalidate`) so pages stay fast but refresh automatically.
- Add cache headers for assets (`Cache-Control: public, max-age=31536000, immutable`).

## 4) Use Vercel Analytics + Speed Insights

- Enable Vercel Analytics to understand actual visitor behavior.
- Enable Speed Insights to monitor real-user performance and track regressions.
- Watch bounce-prone pages and optimize hero content, CTA placement, and load speed.

## 5) Use Preview Deployments for conversion-focused workflows

- Create dedicated preview URLs for experiments:
  - Different hero headlines
  - Different CTA text ("Book a Consultation" vs "Request Proposal")
  - Alternate section order (social proof earlier)
- Share preview URLs with stakeholders before merging.

## 6) Forms and lead capture with Serverless/Edge Functions

- Route form submissions through Vercel Functions instead of exposing raw third-party endpoints.
- Add spam protection (Turnstile/reCAPTCHA), validation, and rate limiting.
- Forward validated leads to your CRM/email provider (HubSpot, Mailchimp, Resend, etc.).

## 7) Add SEO and social metadata correctly

- Ensure each page has:
  - Unique title + meta description
  - Open Graph image and Twitter card metadata
  - Canonical URL
  - Structured data (Organization, LocalBusiness, FAQ where relevant)
- Benefit: better search snippets and improved share previews.

## 8) Add security and operational guardrails

- Set custom domain and SSL via Vercel project settings.
- Add security headers (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- Store secrets in Vercel Environment Variables (never in repo).

## 9) Suggested quick-win roadmap (1 week)

1. Connect repo to Vercel + set domain.
2. Enable Analytics + Speed Insights.
3. Compress/optimize hero images and preload only critical assets.
4. Add proper metadata + OG image.
5. Move forms to a serverless handler with anti-spam.
6. Use Preview Deployments for at least one CTA/headline experiment.

## 10) Minimal starter stack recommendation

- Framework: Next.js on Vercel
- Styling: Tailwind CSS
- Forms: Vercel Function + Resend/HubSpot API
- Analytics: Vercel Analytics + optional GA4
- Monitoring: Speed Insights

## 11) Fixing broken property routes (like `/properties/arbor-studio`)

If a property URL loads the homepage content, shows blank content, or 404s, check routing first.

### Common root causes

- A catch-all rewrite sends every request to `/`.
- Missing dynamic route/page for `/properties/[slug]`.
- Static export generated only the homepage.
- Client-side router works locally but no server-side fallback is configured in production.

### Vercel checks

1. In Vercel project settings, review `vercel.json` rewrites and redirects.
2. Ensure there is no broad rewrite like `/(.*) -> /` unless you explicitly want a single-page fallback.
3. Confirm your framework output includes property pages (or dynamic route support).
4. Open deployment logs and request logs for `/properties/arbor-studio` to confirm which file/function handled the request.

### Example `vercel.json` patterns

Use a SPA fallback only if intended:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

For multi-page/SSR apps, avoid forcing all routes to `/` and let framework routing handle dynamic pages.

### Quick validation checklist

- Test `https://www.moorehospitality.xyz/` and at least one property route directly in an incognito window.
- Confirm route-specific title, heading, and canonical URL are unique per property.
- Verify no redirect loop or unexpected 200-with-homepage response on property paths.
- Re-run after a production redeploy and compare with the Vercel Preview URL.

If you want, I can turn this into a concrete implementation checklist for your current codebase (including exact files and snippets).

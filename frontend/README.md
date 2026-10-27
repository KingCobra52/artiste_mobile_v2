# Focused upgrade

Current email authentication, onboarding, pricing, portfolio and local integration setup are documented in [the focused upgrade guide](../docs/focused-upgrade.md). Trading starts in shadow mode. Production email delivery requires configured SMTP.

# Artiste web app

This directory is the Next.js web app. It uses Supabase Auth for sessions and calls the FastAPI service for all artist, quote, portfolio, and trade data.

## Requirements

- Node.js 20.9 or newer
- npm
- Supabase for authentication and project data
- The FastAPI service from the repository root

## Local setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

Copy `.env.example` to `.env.local`. Use the local Supabase API URL and publishable key for the public values, set `ARTISTE_API_URL` to the FastAPI service URL, and keep all server secrets out of frontend configuration.

Start the app:

```bash
npm run dev
```

Without the public Supabase values, the app renders a setup message instead of crashing. Production builds also work without an environment file.

## Authentication

Accounts use email and password for signup and login. New accounts verify their email before accessing the product; password recovery sends a time-limited email link. Existing account UUIDs and their portfolios, trades, and history remain intact. Configure production SMTP, the site URL, and callback allowlist before rollout. Product routes verify confirmed email claims; FastAPI independently verifies access tokens.

## Market and paper trading

Market quotes use matched Last.fm track and YouTube channel observations. The external anchor blends independently normalized growth, accounts for elapsed days and caps daily growth at ±5%. Completed paper trades add a bounded inventory adjustment. Orders follow the entire pricing curve and include a 0.10% fee. Execution starts disabled in shadow mode; stale, unpublished and unsupported quotes cannot be traded. Trusted database transactions own cash, holdings, quote versions and retry handling. See the focused upgrade guide for rollout and valuation rules.

## Deployment

Deploy the Next.js app from `frontend/` on Vercel. Deploy the FastAPI app from the repository root on Render using `render.yaml`. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and `ARTISTE_API_URL` in Vercel. Configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Render. The service-role key is server-only.

Apply the versioned Supabase migrations before deploying the API, configure the production auth redirect URL, and configure SMTP for production email verification. Do not use the Supabase secret key in Vercel's public environment variables or browser code.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Browser tests

Install Chromium once:

```bash
npm run playwright:install
```

Create a dedicated account in the local or test Supabase project. Add its credentials to the uncommitted `frontend/.env.local` file:

```bash
PLAYWRIGHT_TEST_EMAIL=tester@example.com
PLAYWRIGHT_TEST_PASSWORD=your-test-password
```

Start the existing root Supabase project, then run:

```bash
npm run test:e2e
```

Playwright signs in through the real login page and saves the session under the ignored `test-results/` directory. It does not create users and does not use an auth bypass or service-role key.

The missing-configuration suite can run by itself without Supabase credentials:

```bash
npm run test:e2e:config
```

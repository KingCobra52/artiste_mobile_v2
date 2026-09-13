# Artiste frontend

This directory is an independent Next.js application. It does not use the root npm project or the Python backend.

## Requirements

- Node.js 20.9 or newer
- npm
- The existing root Supabase CLI project for authenticated browser tests

## Local setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

Run `npx supabase status` from the repository root and copy the local API URL and publishable key into `frontend/.env.local`. Only these public values use the `NEXT_PUBLIC_` prefix. Never put a secret or service-role key in frontend configuration.

Start the app:

```bash
npm run dev
```

Without the public Supabase values, the app renders a setup message instead of crashing. Production builds also work without an environment file.

## Authentication

The beta supports email-and-password sign-in for accounts that already exist. It does not offer signup or password reset. Product routes verify the Supabase claims in their protected layout. Proxy refreshes the session cookies and provides an early redirect, but it is not the final authorization boundary.

## Placeholder data and trading

Market and portfolio content is local preview data until the live database audit identifies the real tables. The trade server action validates authentication and client intent, then returns `not_connected` without reading or writing data. It never accepts a user ID, quote, cash balance, or position from the browser.

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

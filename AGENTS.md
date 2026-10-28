# AGENTS.md

This file gives Codex project-wide guidance for this repository. Read
`frontend/AGENTS.md` as well before changing the Next.js application.

## Project state

Artiste is a web-first paper-trading beta. Requests flow from Next.js to
FastAPI to Supabase. The repository contains:

- a Next.js frontend in `frontend/`;
- a FastAPI service in `backend/app/`;
- versioned Supabase migrations and SQL tests in `supabase/`; and
- YouTube and Last.fm ingestion pipelines in `pipelines/`.

There is no native mobile client yet. A React Native, Expo, or Flutter app may
be added later, but the framework and schedule are not decided. Do not create
mobile structure unless the task explicitly calls for it.

The frontend has onboarding, email-and-password signup and login, password
recovery, Market, artist detail with history charts, portfolio, account, and
trade UI. It loads real artists, quotes, holdings, and history from FastAPI.

Quotes are derived from snapshot data. The live model is
`performance-index-v2`; `audience-inventory-v2` is the fallback. A shadow
series is kept for auditing. See `docs/pricing-model.md`.

Paper trading is implemented in the database and API, but it stays in shadow
mode. Trades only execute when `pricing_controls.enabled` is true. Keep it
false until the trade, concurrency, rounding, and pricing checks pass in the
intended environment. The rollout steps are in `docs/focused-upgrade.md`.

The main branch is `main`. CI files live in `.github/workflows/`.

## Repository structure

- `frontend/` — independent Next.js 16 application using React 19, TypeScript,
  Tailwind CSS, Supabase SSR, Vitest, and Playwright. It has its own
  `package.json`, lockfile, README, and agent instructions.
  - `app/` — App Router pages. `(app)/` holds Market, artist, portfolio, and
    account pages. `(auth)/` holds login, signup, recover, and reset-password.
    `onboarding/` and `auth/` hold onboarding and the auth callback.
  - `actions/` — server actions for auth, onboarding, and trades. They call
    FastAPI.
  - `components/` — auth, onboarding, navigation, market, artist, portfolio,
    trade, and shared UI components.
  - `lib/api.ts` — server-side FastAPI client. It uses `ARTISTE_API_URL`.
  - `lib/supabase/` — browser and server clients, configuration checks,
    session refresh, and verified-user checks.
  - `lib/placeholder-data.ts` — old sample data. Nothing imports it. Do not use
    it as a source of truth.
  - `tests/unit/` — Vitest unit tests.
  - `tests/e2e/` — Playwright tests for public, authenticated, auth handoff, and
    missing-config behavior. This is the canonical browser-test location.
  - `docs/` — design system and history chart notes.
- `backend/app/` — FastAPI service. It is a regular package with
  `__init__.py` files. `main.py` builds the app and exposes `/health` and
  `/ready`.
  - `api/v1/` — routes under `/api/v1` for `artists`, `market`, `portfolio`,
    `trades` (including `/trades/preview`), history, and `onboarding`.
  - `services/` — market, portfolio, trading, history, and pricing logic
    (`pricing.py`, `legacy_pricing.py`, `shadow_pricing.py`).
  - `repositories/`, `schemas/`, `core/`, `db/` — data access, models,
    config, errors, logging, and the Supabase client.
  - `supabase_client.py` — lazy sync client used by the pipelines.
- `pipelines/` — standalone ingestion. It reuses backend pricing services.
  - `pipeline.py` — the cron entry point. It runs YouTube first because that
    API has a daily quota, then Last.fm. It reports per-artist failures and
    exits non-zero only when a pipeline crashes or fails every artist.
  - `yt_pipeline.py` — collects channel and recent-video statistics and upserts
    `youtube_snapshots` and `recent_youtube_video_snapshots`. Same-day reruns
    overwrite the running counters.
  - `last_fm_pipeline.py` — collects top-track data, removes collisions on
    `(artist_id, track_key, date)`, and upserts `lastfm_track_snapshots`.
  - `portfolio_snapshots.py` — publishes quote anchors and records account
    valuations after ingestion.
  - `reporting.py` — stores source runs and per-artist outcomes and builds
    ingestion reports.
  - `artists.py` — the hardcoded artist list shared by both pipelines.
  - `http_errors.py` — turns request failures into safe summaries without
    leaking API keys embedded in request URLs.
- `supabase/` — Supabase CLI configuration, `migrations/`, `seed.sql`, and
  SQL checks in `tests/`.
- `tests/test_backend/` — FastAPI, auth, config, history, pricing, shadow
  pricing, and trading tests.
- `tests/test_pipelines/` — tests for the pipeline runner, reporting, YouTube,
  and Last.fm. API calls are stubbed with `responses`.
- `tests/experiments/dev.py` — old disconnected scratch code, not a real test.
- `scripts/` — `test-db.mjs` replays migrations in PGlite. The Python scripts
  set up and run local Supabase, API, browser, and auth-flow checks.
- `docs/` — pricing model, rollout plan, and design refresh notes.
- `render.yaml` — Render deployment for the FastAPI service.
- root `package.json` — repository-level tooling: the Supabase CLI and PGlite
  for `npm run test:db`. It also lists Playwright from the old scaffold below.
  The frontend does not consume it.

A root `playwright.config.ts` is committed from an early generated scaffold.
It points at a missing `e2e/` folder and is not the canonical test setup. Do
not extend it. Use `frontend/playwright.config.ts` and `frontend/tests/e2e/`.

## Frontend rules

Run frontend commands from `frontend/`, not the repository root:

```bash
cd frontend
npm install
npm run dev
```

Next.js 16 differs from older versions. Before editing framework code, read
the relevant local guide under `frontend/node_modules/next/dist/docs/`, as
required by `frontend/AGENTS.md`. Follow current deprecation notices and match
the existing App Router structure.

Protected layouts verify Supabase claims. Proxy-based session refresh and
early redirects improve navigation, but they are not the final authorization
boundary.

The frontend must access application data through FastAPI using server-to-server
requests. FastAPI is the authoritative boundary for artists, market quotes,
portfolios, holdings, trades, and onboarding state, and is responsible for
communicating with Supabase. Next.js may continue using Supabase Auth for
session creation and refresh, but it must pass the authenticated access token
to FastAPI and must not query application tables directly.

Only public Supabase values may use `NEXT_PUBLIC_` variables. Never expose a
secret or service-role key to browser code. The app must keep showing its safe
configuration notice when public Supabase values are absent. The variables are
documented in `frontend/.env.example`.

Do not trust a browser-supplied user ID, quote, balance, position, execution
price, or portfolio value. Validate trade input on the server. Trades execute
atomically in database code and use the request ID as an idempotency key. Keep
it that way.

Frontend checks:

```bash
cd frontend
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Browser tests need Chromium and WebKit. The configured suite also needs a
dedicated test account in local or test Supabase:

```bash
cd frontend
npm run playwright:install
npm run test:e2e
```

The missing-configuration suite does not need Supabase credentials:

```bash
cd frontend
npm run test:e2e:config
```

Keep test credentials in uncommitted `frontend/.env.local`. Never create an
authentication bypass or use a service-role key in browser tests.

## Backend, pipelines, and Python tests

Run Python commands from the repository root. Both the backend and the
pipelines import from the root, for example `backend.app.main` and
`pipelines.pipeline`:

```bash
uvicorn backend.app.main:app --reload
python -m pipelines.pipeline
python -m pytest
ruff check .
```

Use `python -m pytest`, not bare `pytest`. Backend settings require
`SUPABASE_URL` and `SUPABASE_SECRET_KEY`. CI sets dummy values for the Python
tests, and that is enough locally too. Tests marked `integration` need running
services and dedicated test accounts.

## Database

Keep every schema change in a new file under `supabase/migrations/`. Do not
make undocumented remote database changes the only source of truth.

Replay all migrations and run the SQL checks from the repository root:

```bash
npm ci
npm run test:db
```

## CI

- `tests.yml` — `ruff check .` and `python -m pytest`.
- `database.yml` — `npm run test:db`.
- `frontend.yml` — typecheck, lint, unit tests, build, and the
  missing-config browser suite. It also runs local Supabase integration and
  auth-flow jobs using the scripts in `scripts/`.
- `pipelines.yml` — scheduled ingestion, described below.

## Scheduling and operations

`.github/workflows/pipelines.yml` runs `python -m pipelines.pipeline` three
times per day. The source APIs report current totals and cannot backfill a
missed snapshot. GitHub cron is best effort, so the repeated runs reduce the
chance of losing a day. Same-day database writes are idempotent, which makes
the retries safe.

After a successful run, CI pings a healthchecks.io dead-man's switch. A failed
job already sends an alert, but a job that never starts does not. This monitor
also helps catch GitHub disabling scheduled workflows after 60 days without
repository activity.

Required repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `YOUTUBE_API_KEY`
- `LASTFM_API_KEY`
- `HEALTHCHECK_URL`

`DATABASE_URL` is an optional setting but is not currently used.

## Working with snapshot data

Snapshot tables contain collection gaps. Last.fm data, for example, skips
August 19–26, 2026 and resumes on August 27. Always divide changes by the
actual number of elapsed days. Do not treat adjacent rows as adjacent dates.

A plain `lag()` over rows makes a multi-day change look like one day's growth
and creates a false price spike. Use the date difference:

```sql
(playcount - lag(playcount) OVER w)
/ NULLIF(date - lag(date) OVER w, 0)
```

Apply the same rule anywhere snapshot deltas become growth rates, rankings,
charts, or prices. Surface the snapshot date and distinguish fresh, stale, and
unavailable values in product code. Trading requires a published quote whose
`source_as_of` is no more than 48 hours old.

## General development rules

- Preserve unrelated changes in a dirty worktree. Do not overwrite generated
  or user-created work unless the task includes it.
- Add tests at the layer being changed. Pricing and API logic belong in
  `tests/test_backend/`, pipeline logic in `tests/test_pipelines/`, schema
  rules in `supabase/tests/`, and user journeys in the frontend Playwright
  suite.
- Keep secrets out of source, logs, client bundles, fixtures, screenshots, and
  error messages.
- Use plain language and short sentences in comments, docstrings, plans,
  commits, pull requests, and replies.
- Do not add Codex or Anthropic attribution to commits or pull requests.

## Commit workflow

- Make a Git commit after adding tests, adding or removing a feature, or completing a major change. Do not push unless requested.

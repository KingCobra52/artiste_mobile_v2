# AGENTS.md

This file gives Codex project-wide guidance for this repository. Read
`frontend/AGENTS.md` as well before changing the Next.js application.

## Project state

Artiste is currently a web-first beta backed by Supabase and Python data
pipelines. The repository contains:

- a working Next.js frontend in `frontend/`;
- two working ingestion pipelines in `pipelines/`;
- a configured local Supabase project in `supabase/`; and
- a stub FastAPI service in `backend/app/`.

There is no native mobile client yet. A React Native, Expo, or Flutter app may
be added later, but the framework and schedule are not decided. Do not create
mobile structure unless the task explicitly calls for it.

The frontend is the active product surface. It has authentication, Market,
artist detail, portfolio, and trade UI. Market and portfolio values are still
sample data. Trading validates the request and signed-in session, then returns
`not_connected`; it does not change money or holdings.

The next planned product milestone is a real, read-only Market experience:

1. put the database schema under versioned Supabase migrations;
2. define the artist and market quote contract;
3. derive gap-aware prices and changes from snapshot data;
4. load real artists and quotes in the Market and artist pages; and
5. cover fresh, stale, unavailable, and missing data in tests.

After that, connect the portfolio. Implement transactional trading only after
the price, cash, holdings, authorization, idempotency, and audit rules are
defined. The server or database must remain authoritative for all financial
state.

The main branch is `main`. CI files live in `.github/workflows/`.

## Repository structure

- `frontend/` — independent Next.js 16 application using React 19, TypeScript,
  Tailwind CSS, Supabase SSR, and Playwright. It has its own `package.json`,
  lockfile, README, and agent instructions.
  - `app/` — App Router pages, layouts, loading and error states, and the auth
    callback.
  - `actions/` — server actions for authentication and the disabled trade flow.
  - `components/` — auth, navigation, market, artist, portfolio, trade, and
    shared state components.
  - `lib/placeholder-data.ts` — temporary Market and portfolio data. Treat it
    as preview data, not a source of truth.
  - `lib/supabase/` — browser and server clients, configuration checks, and
    session refresh support.
  - `tests/e2e/` — Playwright tests for public, authenticated, and missing-config
    behavior. This is the canonical browser-test location.
- `pipelines/` — standalone data ingestion. It is not wired into FastAPI.
  - `pipeline.py` — the cron entry point. It runs YouTube first because that
    API has a daily quota, then Last.fm. It reports per-artist failures and
    exits non-zero only when a pipeline crashes or fails every artist.
  - `yt_pipeline.py` — collects channel and recent-video statistics and upserts
    `youtube_snapshots` and `recent_youtube_video_snapshots`. Same-day reruns
    overwrite the running counters.
  - `last_fm_pipeline.py` — collects top-track data, removes collisions on
    `(artist_id, track_key, date)`, and upserts `lastfm_track_snapshots`.
  - `artists.py` — the hardcoded artist list shared by both pipelines. The
    frontend preview list is different and is not authoritative.
  - `http_errors.py` — turns request failures into safe summaries without
    leaking API keys embedded in request URLs.
- `backend/app/` — FastAPI skeleton. `trading` and `holdings` routers exist but
  have no endpoints. The frontend does not currently call this service.
- `supabase/` — local Supabase CLI configuration. There are no committed schema
  migrations yet. Add migrations before relying on a database contract.
- `tests/test_pipelines/` — 65 Python tests for the pipeline runner, YouTube,
  and Last.fm. API calls are stubbed with `responses`.
- `tests/experiments/dev.py` — old disconnected scratch code, not a real test.
- `app/` — local Python virtual environment, not application source. Ignore it
  when searching for product code.
- root `package.json` — used for repository-level tooling such as the Supabase
  CLI. The frontend does not consume it.

An uncommitted generated Playwright scaffold may exist at the repository root
(`playwright.config.ts`, `.github/workflows/playwright.yml`, and root Playwright
dependencies). It is not the canonical frontend test setup. Do not extend or
silently commit it. Use `frontend/playwright.config.ts` and
`frontend/tests/e2e/` unless a task explicitly establishes root-level tests.

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

The app supports email-and-password sign-in for existing accounts. It does not
offer signup or password reset. Protected layouts verify Supabase claims.
Proxy-based session refresh and early redirects improve navigation, but they
are not the final authorization boundary.

The frontend must access application data through FastAPI using server-to-server
requests. FastAPI is the authoritative boundary for artists, market quotes,
portfolios, holdings, and trades, and is responsible for communicating with
Supabase. Next.js may continue using Supabase Auth for session creation and
refresh, but it must pass the authenticated access token to FastAPI and must not
query application tables directly.

Only public Supabase values may use `NEXT_PUBLIC_` variables. Never expose a
secret or service-role key to browser code. The app must keep showing its safe
configuration notice when public Supabase values are absent.

Do not trust a browser-supplied user ID, quote, balance, position, execution
price, or portfolio value. Validate trade input on the server. When trading is
implemented, execute it atomically in trusted server or database code and use
the existing request ID as an idempotency key.

Frontend checks:

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```

Browser tests need Chromium. The configured suite also needs a dedicated test
account in local or test Supabase:

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

## Pipelines and Python tests

No Python `__init__.py` files exist. The project uses implicit namespace
packages. Pipeline imports assume the repository root is on `sys.path`, so run
pipeline and test commands from the repository root:

```bash
python -m pipelines.pipeline
python -m pipelines.yt_pipeline
python -m pytest
ruff check .
```

Use `python -m pytest`, not bare `pytest`. Test collection imports
`backend/app/supabase_client.py`, which creates a client at import time.
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` must therefore be set even though the
tests do not contact Supabase. Dummy values are enough.

`backend/app/main.py` uses imports that currently resolve only when the working
directory is `backend/app/`. Match the import convention of the area being
changed. Do not assume the frontend, pipelines, and FastAPI service share one
runtime or import convention.

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

`DATABASE_URL` is read by Python configuration but is not currently used by a
pipeline. The frontend uses the public variables documented in
`frontend/.env.example`.

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
unavailable values in product code.

## General development rules

- Preserve unrelated changes in a dirty worktree. Do not overwrite generated
  or user-created work unless the task includes it.
- Keep schema changes in Supabase migrations. Do not make undocumented remote
  database changes the only source of truth.
- Add tests at the layer being changed. Pipeline logic belongs in Python tests;
  user journeys belong in the frontend Playwright suite.
- Keep secrets out of source, logs, client bundles, fixtures, screenshots, and
  error messages.
- Use plain language and short sentences in comments, docstrings, plans,
  commits, pull requests, and replies.
- Do not add Codex or Anthropic attribution to commits or pull requests.

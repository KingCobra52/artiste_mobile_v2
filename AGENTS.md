# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project state

Despite the repo name, this repo currently contains **only Python backend + data pipeline code** — no mobile client exists yet. A mobile app (React Native/Expo/Flutter — unspecified) is planned for later; do not assume any mobile structure or files exist until they're added.

Single branch (`main`). CI lives in `.github/workflows/`. `backend/app/` is still stub-only (empty routers). The pipeline layer is the actively developed part of the repo and now has two working pipelines, a shared cron entry point, and a real test suite. Linting: `ruff check .` (config in `ruff.toml`).

## Structure

- `backend/app/` — FastAPI service. `main.py` includes `trading` and `holdings` routers (both currently empty stubs, no endpoints). `models/` and `services/` are empty placeholder dirs. `supabase_client.py` sets up the Supabase client; `config.py` loads env vars via `dotenv`.
- `pipelines/` — data-ingestion scripts, run standalone or via `pipeline.py`. Not wired into the FastAPI app.
  - `pipeline.py` — the real cron entry point, run three times a day by `.github/workflows/pipelines.yml`. Runs every pipeline in `PIPELINES` in order (YouTube first, since it has the daily quota; Last.fm second), prints a per-artist failure summary, and exits non-zero only when a whole pipeline crashed or failed every artist — a single bad artist is reported but doesn't fail the job.
  - `yt_pipeline.py` — pulls YouTube Data API v3 channel/video stats and upserts into Supabase (`youtube_snapshots`, `recent_youtube_video_snapshots`). `run_pipeline()` loops artists, delegates the per-artist fetch+upsert work to `process_artist()`, batches both the recent-videos stats call and the video row write into one request each, and returns a list of `{"artist", "reason"}` failure dicts rather than raising. Both writes upsert on a unique index (`artist_id,date` and `artist_id,video_id,date`) so a repeat run in the same day overwrites instead of duplicating. Unlike Last.fm it does not pass `ignore_duplicates` — these are running counters, so the later reading should win.
  - `last_fm_pipeline.py` — pulls Last.fm top-tracks data per artist, dedupes tracks that collide on `(artist_id, track_key, date)`, and upserts into `lastfm_track_snapshots`. Ported from an older `track_pipelines.py` in a prior version of this project.
  - `artists.py` — the hardcoded artist list, shared by both pipelines (`from pipelines.artists import artists`).
  - `http_errors.py` — `describe_request_error()`, shared by both pipelines to summarize a failed request as `"HTTP {status}"` or the exception type name, without leaking the API key that both YouTube and Last.fm embed in the request URL.
- `app/` — a local Python venv (git-ignored). Not source code; ignore when searching for app logic.
- `tests/` — replaces the old `overall_tests/`. `tests/test_pipelines/` holds 65 passing tests across `test_pipeline.py`, `test_yt_pipeline.py` and `test_last_fm_pipeline.py`, using `responses` to stub the APIs. `tests/experiments/dev.py` is the old disconnected scratch FastAPI file, not an actual test.

  Run them as `python -m pytest` from the repo root, not bare `pytest`. There is no `conftest.py`, no `__init__.py` and no `pythonpath` setting, so imports only resolve with the root on `sys.path`. Collection also imports `backend/app/supabase_client.py`, which builds a real client at import time — so `SUPABASE_URL` and `SUPABASE_SECRET_KEY` must be set even though no test hits Supabase. Dummy values work.

## Scheduling

`.github/workflows/pipelines.yml` runs `python -m pipelines.pipeline` three times a day. Three attempts rather than one because these APIs only report current totals — a missed day cannot be backfilled later, and GitHub cron is best-effort. That redundancy is only safe because every write is now idempotent per day.

On success the job pings a healthchecks.io dead-man's switch (`HEALTHCHECK_URL` secret). That is the alert that matters: a failing run already emails, but a run that never fires does not, and silent stoppage is what put a three-week hole in the data during Aug 2026. Note GitHub disables scheduled workflows after 60 days of repo inactivity — the dead-man's switch is what catches that too.

Required repo secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `YOUTUBE_API_KEY`, `LASTFM_API_KEY`, `HEALTHCHECK_URL`. `DATABASE_URL` is read by `config.py` but no pipeline uses it.

## Running code

No `__init__.py` files exist anywhere (implicit namespace packages), and import styles are inconsistent between parts of the codebase:
- `pipelines/*.py` import via `from backend.app.config import ...` and `from pipelines.<module> import ...` — run these from the **repo root** (e.g. `python -m pipelines.pipeline`, `python -m pipelines.yt_pipeline`).
- `backend/app/main.py` imports via `from routers import trading, holdings` — this only resolves if run with cwd set to `backend/app/`.

These two conventions conflict; when adding new code, match whichever part of the codebase you're extending rather than assuming one global convention.

## Known gaps

- `requirements.txt` now includes `supabase` and `requests` (previously missing) — that gap from before is resolved.
- No `.env.example` — required env vars (in `.env`, git-ignored) are: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `LASTFM_API_KEY`, `YOUTUBE_API_KEY`. A few other keys exist in `.env` (Spotify, Last.fm secret, Supabase publishable/JWKS, IPv6 DB URL) but aren't consumed by any code yet — likely for unbuilt features.
- `ruff` is pinned in `requirements.txt` but is not actually installed in the `app/` venv, so `ruff check .` only runs in CI unless you install it locally.

## Working with snapshot data

Snapshot tables have gaps. Collection has stopped and restarted more than once.
For example, Last.fm track snapshots skip Aug 19-26, 2026, then resume Aug 27.

So: when you compute a change between two snapshots, divide by the actual
number of days elapsed, not by row position.

A plain `lag()` over consecutive rows treats a 9-day gap as one day. On the
Aug 27 rows that shows up as a 0.161% jump against a normal daily 0.015% —
roughly ten times too big. Any price built that way will show a fake spike.

Use the date difference:

    (playcount - lag(playcount) OVER w) / NULLIF(date - lag(date) OVER w, 0)

Same rule anywhere else deltas turn into a price or a growth rate.

## Writing style

In all prose you write — code comments, docstrings, plans, commit messages, and replies — use plain language, short sentences, and avoid dense or overly compressed phrasing.

Write code comments in plain language. Short sentences, or even phrases.

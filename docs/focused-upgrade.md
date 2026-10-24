# Focused web upgrade

Artiste remains a Next.js → FastAPI → Supabase paper-trading application. Application tables stay behind FastAPI. Supabase Auth creates and refreshes user sessions. No agent, agent simulation, real-money feature, or CAPTCHA is included.

## Deployment sequence

1. Back up the database and replay committed migrations in a staging project. The four `20261024*` migrations contain the catalog, pricing engine, cost-basis migration, onboarding state and ingestion reporting. Do not change hosted tables manually as a substitute for migrations.
2. Configure FastAPI with its server-only Supabase URL and secret key. Configure Next.js with `ARTISTE_API_URL`, public Supabase URL/key and `NEXT_PUBLIC_SITE_URL`. Never put an administrative key in a `NEXT_PUBLIC_` variable.
3. Configure phone Auth in the hosted Supabase dashboard: enable phone signup/confirmation, select Twilio, supply the account SID, message service SID/sender and Auth token. Restrict permitted destinations and apply provider spending limits. Match the 60-second resend interval, six-digit code and server-side SMS rate limits in `supabase/config.toml`. Retain email login and password recovery, site URL and callback allowlist for existing accounts. Account UUIDs and holdings are preserved when adding a verified phone.
4. Verify real SMS signup, resend, delivery errors, login, password recovery and existing-account phone attachment in staging. Local unit tests validate SDK calls and error handling; they cannot prove carrier delivery. No SMS credentials are committed or configured by this change.
5. Run ingestion against the migrated staging project. Confirm that both sources publish valid anchors and ingestion reports are stored. Verify that the curated artists have fresh published quotes before inviting users.
6. Keep `pricing_controls.enabled = false` during review. Previews show the curve and fees, but execution fails closed. Only after the execution, concurrency, rounding and pricing checks pass should an operator enable this flag in the intended paper-trading environment. The local fixture helper enables it only in the disposable localhost database.

## Product and data rules

- First entry opens three onboarding screens. Anonymous progress is local; account progress is stored in profile columns through the authenticated FastAPI endpoint. The header provides replay, and login preserves a normalized destination.
- The initial reviewed catalog is Kendrick Lamar, JID and Denzel Curry. Their short factual context links to its Last.fm source and an official listening channel. Other artist records remain inactive, with their positions and execution history intact. Freshness failures temporarily remove discovery eligibility; a source/database outage returns a service error.
- Audience pricing matches Last.fm track identities across observations, divides by elapsed calendar days, compounds normalized growth with a ±5% daily cap, and blends available measured sources equally. A stale source is excluded when a fresh measured source remains; its exclusion is retained in provenance. Future observations are removed before all calculations. New artists start at $10; existing artists retain their valid prior price at model cutover.
- Model `audience-inventory-v2` applies `anchor × (1 + 0.20 × tanh(net inventory / 10000))`. These parameters are experimental. Each order integrates across the curve, with conservative cent rounding and a disclosed 10-basis-point fee. Only committed trades affect inventory. Preview versions, wallet locking and request IDs protect execution and retries.
- Holdings preserve exact remaining acquisition cost, including fees. Full legacy ledgers are replayed to recover exact costs; incomplete records retain their prior estimated basis and are labeled. Displayed rounded averages never drive total valuation.
- Archived/missing-quote holdings use remaining purchase cost and have no invented quote timestamp. Stale quotes retain their actual value/date. `priced_at` is publication time; `source_as_of` is the underlying audience observation date. Account calculation time is separate.
- Account graphs contain recorded server snapshots, never invented backfills. Reads do not write history. Trades snapshot all affected owners in the same transaction, with wallets locked in UUID order; ingestion snapshots changed audience-quote valuations. Historical chart segments label the reconstructed and recorded methodologies.
- Ingestion stores source runs and per-artist outcomes. Reports contain attempted denominators, unattempted counts, failure scope, 7/30-day source/artist/slot/hour breakdowns, repeated failures, recovery times and low-sample warnings. UTC is stored; reports convert display times to America/New_York. The existing missing-run monitor remains separate. Historical ingestion failures before this rollout cannot be reconstructed from these new records.

## Repeatable validation

From the repository root:

```sh
npm ci
npm run test:db
SUPABASE_URL=http://localhost:54321 SUPABASE_SECRET_KEY=unused-test-config python -m pytest -m 'not integration'
ruff check .
npx supabase start -x studio,realtime,storage-api,imgproxy,postgres-meta,edge-runtime,logflare,vector,supavisor
python -m scripts.setup_local_tests
python -m scripts.run_local_checks api
```

Use another terminal for `python -m scripts.run_local_checks browser`, then `python -m scripts.run_local_checks integration`. Install Chromium and WebKit with `cd frontend && npx playwright install chromium webkit` first. The API must be running for these checks; Playwright builds and starts the production Next.js server if necessary. For manual local inspection use `python -m scripts.run_local_checks web`.

The fixture helper refuses hosted URLs. It creates two dedicated local accounts, three quoted artists and an archived holding. Its private `/tmp/artiste-web-test-env.json` contains local credentials; never commit or upload this file. Browser and frontend processes receive only public Auth settings, user test credentials and the API URL. The administrative key is used only for local fixture setup and FastAPI. Reset the disposable local database before rerunning the destructive execution/concurrency checks (`npx supabase db reset --local`, then fixture setup). Do not run these helpers against a shared database.

Frontend checks run from `frontend/`: `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e:config`. Configured browser projects cover Chromium/WebKit phones and 360, 390, 430, 768 and 1280px layouts. CI also runs the disposable local integration suite. Dedicated SQL checks use PGlite to replay every migration and test real PostgreSQL transactions without a hosted database.

Supabase reference documentation: [phone/password authentication](https://supabase.com/docs/guides/auth/passwords), [SMS OTP without account creation](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp), [verification resend](https://supabase.com/docs/reference/javascript/auth-resend), and [verified-session password update](https://supabase.com/docs/reference/javascript/auth-updateuser). SMS recovery deliberately composes these APIs; it does not call the email-reset endpoint.

## Validation recorded for this change

- 120 Python unit/service/pipeline checks; three additional live local API checks cover execution retries, account isolation, concurrent orders and onboarding ownership.
- 25 frontend unit checks, including SMS SDK contracts, redirect normalization and deterministic Eastern timestamps across daylight-saving changes.
- 25 Chromium/WebKit production-build journey checks, covering phones, tablet/desktop widths, touch/keyboard charts and interrupted form submissions; five missing-configuration checks.
- All migrations replayed in local Supabase and embedded PostgreSQL; transaction checks cover cost basis, shadow gating, rollback, purchase-cost fallback and recording quote changes for other holders.
- Frontend typecheck, lint and production webpack build, Python Ruff and diff whitespace checks passed.

Real carrier SMS delivery, hosted migration application and hosted deployment remain operator tasks. Timing checks used the small local three-artist fixture and are not a production load test. Browser runtime assertions narrowly exclude WebKit's documented same-origin RSC cancellation diagnostic during document replacement ([upstream issue](https://github.com/microsoft/playwright/issues/43120)); hydration failures and other runtime errors still fail the suite.

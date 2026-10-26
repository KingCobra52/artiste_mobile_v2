# Database migrations

The first six hosted Artiste migration versions predate the migration files in
this repository. `20260726034610` is therefore a reconstructed schema snapshot,
followed by the original migration-version markers so fresh local databases and
the hosted migration history share the same version sequence. It is not a
byte-for-byte recovery of the original SQL. Later migration filenames retain
their hosted version IDs so the CLI does not mistake an applied schema change
for a pending migration.

The paper-trading migration adds simulated portfolios, trade history,
idempotent atomic execution, and the aggregate market snapshot RPC. The later
portfolio-valuation migration records owner-scoped values after successful
trades and changed market refreshes. The scheduled pipeline uses the shared
pricing calculation after ingestion; the portfolio-history endpoint also
captures a refreshed observation. Review both before applying them to a hosted
project. Browser users cannot write snapshots directly.

For a fresh local project, run `supabase db reset` after starting the local
Supabase stack. `seed.sql` loads the project's current artist catalog.

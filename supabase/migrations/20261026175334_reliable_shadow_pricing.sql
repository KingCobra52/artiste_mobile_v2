-- v2 records unavailable/stale results explicitly; they are not executable quotes.
alter table public.pricing_shadow_quotes
  alter column source_as_of drop not null,
  alter column performance_index_cents drop not null;
alter table public.pricing_shadow_quotes
  rename column input_hash to calculation_hash;

alter table public.pricing_shadow_quotes
  drop constraint if exists pricing_shadow_quotes_status_check;
alter table public.pricing_shadow_quotes
  add constraint pricing_shadow_quotes_status_check
  check(status in ('fresh','stale','unavailable'));

create index pricing_shadow_quotes_artist_published
  on public.pricing_shadow_quotes(artist_id, published_at desc);

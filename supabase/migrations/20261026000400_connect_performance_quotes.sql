-- Route reliable performance-index results into published quote anchors.
-- The first model transition rebases to the current anchor without repricing
-- holdings. Paper-trading execution controls are unchanged.
create or replace function public.publish_performance_anchor(
  p_artist_id integer,
  p_raw numeric,
  p_as_of timestamptz,
  p_sources jsonb,
  p_initial bigint,
  p_pricing_version text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.artist_market_state;
  inv bigint;
  anchor numeric;
begin
  if p_raw is null or p_raw < 1 or p_initial is null or p_initial < 1
     or p_as_of is null or p_as_of > now()
     or p_pricing_version <> 'performance-index-v2' then
    raise exception 'invalid_performance_anchor';
  end if;

  perform pg_advisory_xact_lock(18373, p_artist_id);
  select * into s from public.artist_market_state
  where artist_id = p_artist_id for update;

  if not found then
    select coalesce(sum(quantity), 0) into inv
    from public.paper_positions where artist_id = p_artist_id;
    insert into public.artist_market_state(
      artist_id, anchor_cents, raw_reference, base_anchor_cents,
      baseline_inventory, inventory, price_cents, source_as_of, sources,
      pricing_version
    ) values (
      p_artist_id, p_initial, p_raw, p_initial, inv, inv, p_initial,
      p_as_of, p_sources, p_pricing_version
    ) returning * into s;
  else
    if p_as_of < s.source_as_of then
      return;
    end if;

    if s.pricing_version <> p_pricing_version then
      -- Preserve the current displayed price while changing the raw-index
      -- baseline so subsequent movements come only from this model.
      anchor := s.anchor_cents;
      update public.artist_market_state set
        anchor_cents = anchor,
        raw_reference = p_raw,
        base_anchor_cents = anchor,
        pricing_version = p_pricing_version,
        source_as_of = p_as_of,
        sources = p_sources,
        version = version + 1,
        refreshed_at = now(),
        priced_at = now(),
        price_cents = public.curve_price(anchor, inventory - baseline_inventory),
        demand_percent = (
          public.curve_price(anchor, inventory - baseline_inventory) / anchor - 1
        ) * 100
      where artist_id = p_artist_id returning * into s;
    else
      anchor := greatest(1, s.base_anchor_cents * p_raw / s.raw_reference);
      if s.anchor_cents = anchor and s.source_as_of = p_as_of and s.sources = p_sources then
        return;
      end if;
      update public.artist_market_state set
        anchor_cents = anchor,
        source_as_of = p_as_of,
        sources = p_sources,
        version = version + 1,
        refreshed_at = now(),
        priced_at = now(),
        price_cents = public.curve_price(anchor, inventory - baseline_inventory),
        demand_percent = (
          public.curve_price(anchor, inventory - baseline_inventory) / anchor - 1
        ) * 100
      where artist_id = p_artist_id returning * into s;
    end if;
  end if;

  insert into public.published_quotes(
    artist_id, version, price_cents, anchor_cents, demand_percent,
    source_as_of, sources
  ) values (
    s.artist_id, s.version, s.price_cents, s.anchor_cents, s.demand_percent,
    s.source_as_of, s.sources
  );
end;
$$;

revoke all on function public.publish_performance_anchor(integer, numeric, timestamptz, jsonb, bigint, text)
  from public, anon, authenticated;
grant execute on function public.publish_performance_anchor(integer, numeric, timestamptz, jsonb, bigint, text)
  to service_role;

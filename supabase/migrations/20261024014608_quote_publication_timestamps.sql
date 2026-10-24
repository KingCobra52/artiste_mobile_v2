-- A price publication time is distinct from the age of its audience inputs.
alter table public.artist_market_state add column priced_at timestamptz not null default now();
update public.artist_market_state s set priced_at=coalesce((select max(q.observed_at) from public.published_quotes q where q.artist_id=s.artist_id),s.refreshed_at);

create or replace function public.get_pricing_observations()
returns table(artist_id integer,snapshot_date date,lastfm_tracks jsonb,youtube_subscribers bigint)
language sql stable security definer set search_path='' as $$
 with lf as (
 select s.artist_id,s.date,jsonb_object_agg(s.track_key,s.playcount) as tracks
 from public.lastfm_track_snapshots s where s.date<=(now() at time zone 'UTC')::date and s.track_key is not null and s.playcount>0
 group by s.artist_id,s.date
 ), yt as (
 select s.artist_id,s.date,max(s.subscribers)::bigint as subscribers from public.youtube_snapshots s
 where s.date<=(now() at time zone 'UTC')::date and s.subscribers>0 group by s.artist_id,s.date
 ) select coalesce(lf.artist_id,yt.artist_id),coalesce(lf.date,yt.date),lf.tracks,yt.subscribers
 from lf full join yt on lf.artist_id=yt.artist_id and lf.date=yt.date order by 1,2;
$$;


create or replace function public.publish_artist_anchor(p_artist_id integer,p_raw numeric,p_as_of timestamptz,p_sources jsonb,p_initial bigint)
returns void language plpgsql security definer set search_path='' as $$
declare s public.artist_market_state; inv bigint; anchor numeric;
begin
 if p_raw is null or p_raw<1 or p_initial is null or p_initial<1 or p_as_of is null or p_as_of>now() then raise exception 'invalid_anchor'; end if;
 perform pg_advisory_xact_lock(18373,p_artist_id);
 select * into s from public.artist_market_state where artist_id=p_artist_id for update;
 if not found then
   select coalesce(sum(quantity),0) into inv from public.paper_positions where artist_id=p_artist_id;
   insert into public.artist_market_state(artist_id,anchor_cents,raw_reference,base_anchor_cents,baseline_inventory,inventory,price_cents,source_as_of,sources)
   values(p_artist_id,p_initial,p_raw,p_initial,inv,inv,p_initial,p_as_of,p_sources) returning * into s;
 else
   if p_as_of<s.source_as_of then return; end if;
   anchor:=greatest(1,s.base_anchor_cents*p_raw/s.raw_reference);
   if s.anchor_cents=anchor and s.source_as_of=p_as_of and s.sources=p_sources then return; end if;
   update public.artist_market_state set anchor_cents=anchor,source_as_of=p_as_of,sources=p_sources,version=version+1,refreshed_at=now(),priced_at=now(),
     price_cents=public.curve_price(anchor,inventory-baseline_inventory),
     demand_percent=(public.curve_price(anchor,inventory-baseline_inventory)/anchor-1)*100
   where artist_id=p_artist_id returning * into s;
 end if;
 insert into public.published_quotes(artist_id,version,price_cents,anchor_cents,demand_percent,source_as_of,sources)
 values(s.artist_id,s.version,s.price_cents,s.anchor_cents,s.demand_percent,s.source_as_of,s.sources);
end;
$$;


create or replace function public.get_portfolio_v2(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with held as (
 select p.*, a.name,a.genre,a.active,a.biography,a.music_context,a.listening_url,a.notable_releases,a.context_source_url,a.image_url,
   s.price_cents,s.source_as_of,s.priced_at,s.version,
   case when a.id is null or not a.active or a.biography='' or a.music_context='' or a.listening_url not like 'https://%' or s.price_cents is null or s.source_as_of>now() then 'purchase_cost'
        when s.source_as_of<now()-interval '48 hours' then 'stale_quote' else 'quote' end as basis
 from public.paper_positions p left join public.artists a on a.id=p.artist_id left join public.artist_market_state s on s.artist_id=p.artist_id
 where p.user_id=p_user_id
 ), marks as (
 select *, case when basis='purchase_cost' then cost_basis_cents else quantity::bigint*price_cents end as value from held
 ), holdings as (
 select coalesce(jsonb_agg(jsonb_build_object(
  'artist', jsonb_build_object('id',artist_id::text,'name',coalesce(name,'Unavailable artist'),'symbol',left(regexp_replace(upper(replace(coalesce(name,'Artist'),'.','')), '(^|\s)(\S)\S*','\2','g'),4),'genre',coalesce(genre,'Music'),
    'active',coalesce(active,false),'biography',coalesce(biography,''),'music_context',coalesce(music_context,''),
    'listening_url',coalesce(listening_url,''),'notable_releases',coalesce(notable_releases,'[]'::jsonb),'context_source_url',coalesce(context_source_url,''),'image_url',image_url),
  'quantity',quantity,'average_cost_cents',round(cost_basis_cents::numeric/quantity),'cost_basis_cents',cost_basis_cents,
  'current_price_cents',case when basis='purchase_cost' then round(cost_basis_cents::numeric/quantity) else price_cents end,
  'current_value_cents',value,'first_purchased_at',first_purchased_at,'last_purchased_at',last_purchased_at,
  'quote_as_of',case when basis='purchase_cost' then null else priced_at end,'data_source_as_of',case when basis='purchase_cost' then null else source_as_of end,'valuation_basis',basis,'quote_version',case when basis='purchase_cost' then null else version::text end,
  'purchases',coalesce((select jsonb_agg(jsonb_build_object('quantity',t.quantity,'priceCents',t.execution_price_cents,'totalCents',t.total_cents,'feeCents',t.fee_cents,'date',t.executed_at) order by t.executed_at)
     from public.paper_trades t where t.user_id=p_user_id and t.artist_id=marks.artist_id and t.side='buy'),'[]'::jsonb)
 ) order by first_purchased_at),'[]'::jsonb) as items,coalesce(sum(value),0) as value,
 coalesce(sum(cost_basis_cents),0) as cost,min(priced_at) filter(where basis<>'purchase_cost') as oldest,
 coalesce(bool_or(basis<>'quote'),false) as degraded from marks
 ), trades as (
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'artist',jsonb_build_object('id',t.artist_id::text,'name',coalesce(a.name,'Unavailable artist'),'symbol',left(regexp_replace(upper(replace(coalesce(a.name,'Artist'),'.','')), '(^|\s)(\S)\S*','\2','g'),4),'genre',coalesce(a.genre,'Music')),
 'side',t.side,'quantity',t.quantity,'execution_price_cents',t.execution_price_cents,'total_cents',t.total_cents,'fee_cents',t.fee_cents,'executed_at',t.executed_at) order by t.executed_at desc),'[]'::jsonb) as items
 from (select * from public.paper_trades where user_id=p_user_id order by executed_at desc limit 50) t left join public.artists a on a.id=t.artist_id
 ) select jsonb_build_object('summary',jsonb_build_object('cash_cents',p.cash_cents,'holdings_value_cents',h.value,'total_value_cents',p.cash_cents+h.value,
 'gain_loss_cents',h.value-h.cost,'as_of',h.oldest,'calculated_at',now(),'status',case when h.degraded then 'stale' else 'fresh' end),
 'holdings',h.items,'trades',trades.items) from public.profiles p cross join holdings h cross join trades where p.id=p_user_id;
$$;


create or replace function public.execute_market_trade(p_user_id uuid,p_artist_id integer,p_side text,p_quantity integer,p_request_id uuid,p_quote_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.artist_market_state; t public.paper_trades; pos public.paper_positions; estimate jsonb; cash bigint; gross bigint; fee bigint; total bigint; basis bigint;
begin
 -- Lock order: artist, profile. Preview and execution use the same curve.
 perform pg_advisory_xact_lock(18373,p_artist_id);
 select * into s from public.artist_market_state where artist_id=p_artist_id for update;
 select cash_cents into cash from public.profiles where id=p_user_id for update;
 if not found then raise exception 'profile_not_ready'; end if;
 select * into t from public.paper_trades where user_id=p_user_id and request_id=p_request_id;
 if found then
  if t.artist_id<>p_artist_id or t.side<>p_side or t.quantity<>p_quantity then raise exception 'request_id_conflict'; end if;
  return jsonb_build_object('ok',true,'code','accepted','message','Paper trade was already processed.','trade_id',t.id,
   'execution_price_cents',t.execution_price_cents,'total_cents',t.total_cents,'fee_cents',t.fee_cents,'cash_cents',cash,'idempotent',true);
 end if;
 if not coalesce((select enabled from public.pricing_controls where id),false) then raise exception 'pricing_shadow'; end if;
 if p_request_id is null or p_quote_version is null or p_quote_version<>s.version::text then raise exception 'quote_changed'; end if;
 estimate:=public.trade_estimate(p_artist_id,p_side,p_quantity);
 gross:=(estimate->>'gross_cents')::bigint; fee:=(estimate->>'fee_cents')::bigint; total:=(estimate->>'total_cents')::bigint;
 select * into pos from public.paper_positions where user_id=p_user_id and artist_id=p_artist_id for update;
 if p_side='buy' then
  if cash<total then raise exception 'insufficient_cash'; end if;
  if coalesce(pos.quantity,0)::bigint+p_quantity>2147483647 then raise exception 'invalid_trade'; end if;
  basis:=coalesce(pos.cost_basis_cents,0)+total;
  insert into public.paper_positions(user_id,artist_id,quantity,average_cost_cents,cost_basis_cents,last_purchased_at)
  values(p_user_id,p_artist_id,coalesce(pos.quantity,0)+p_quantity,round(basis::numeric/(coalesce(pos.quantity,0)+p_quantity)),basis,now())
  on conflict(user_id,artist_id) do update set quantity=excluded.quantity,average_cost_cents=excluded.average_cost_cents,cost_basis_cents=excluded.cost_basis_cents,last_purchased_at=excluded.last_purchased_at;
  cash:=cash-total;
 else
  if pos.quantity is null or pos.quantity<p_quantity then raise exception 'insufficient_shares'; end if;
  if pos.quantity=p_quantity then delete from public.paper_positions where user_id=p_user_id and artist_id=p_artist_id;
  else
   basis:=pos.cost_basis_cents-round(pos.cost_basis_cents::numeric*p_quantity/pos.quantity);
   update public.paper_positions set quantity=pos.quantity-p_quantity,cost_basis_cents=basis,average_cost_cents=round(basis::numeric/(pos.quantity-p_quantity)) where user_id=p_user_id and artist_id=p_artist_id;
  end if;
  cash:=cash+total;
 end if;
 update public.profiles set cash_cents=cash where id=p_user_id;
 insert into public.paper_trades(user_id,artist_id,side,quantity,execution_price_cents,total_cents,request_id,gross_cents,fee_cents,quote_version)
 values(p_user_id,p_artist_id,p_side,p_quantity,(estimate->>'execution_price_cents')::bigint,total,p_request_id,gross,fee,s.version) returning * into t;
 update public.artist_market_state set inventory=inventory+case when p_side='buy' then p_quantity else -p_quantity end,
  price_cents=(estimate->>'price_after_cents')::bigint,version=version+1,priced_at=now(),
  demand_percent=((estimate->>'price_after_cents')::numeric/anchor_cents-1)*100 where artist_id=p_artist_id returning * into s;
 insert into public.published_quotes(artist_id,version,price_cents,anchor_cents,demand_percent,source_as_of,sources)
 values(s.artist_id,s.version,s.price_cents,s.anchor_cents,s.demand_percent,s.source_as_of,s.sources);
 perform public.capture_portfolio_v2(p_user_id,'trade',t.id);
 return jsonb_build_object('ok',true,'code','accepted','message','Paper trade completed.','trade_id',t.id,
 'execution_price_cents',t.execution_price_cents,'total_cents',total,'fee_cents',fee,'cash_cents',cash,'idempotent',false);
end;
$$;

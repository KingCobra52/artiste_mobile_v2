-- All application writes remain behind the verified FastAPI boundary.
alter table public.artists add column biography text not null default '';
alter table public.artists add column music_context text not null default '';
alter table public.artists add column notable_releases jsonb not null default '[]';
alter table public.artists add column listening_url text not null default '';
alter table public.artists add column context_source_url text not null default '';
alter table public.artists add column active boolean not null default false;
alter table public.artists add column exclusion_reason text default 'Context awaiting review';
-- Short editorial summaries, with sources retained for review. Other catalog rows stay intact.
update public.artists set active=true, exclusion_reason=null, genre='Hip-hop',
 biography='Kendrick Lamar is a rapper from Compton, California, known for narrative albums and character-driven writing.',
 music_context='Explore West Coast rap through the contrasting album worlds of good kid, m.A.A.d city and To Pimp a Butterfly.',
 notable_releases='["good kid, m.A.A.d city", "To Pimp a Butterfly", "DAMN."]',
 listening_url='https://www.youtube.com/channel/UC3lBXcrKFnFAFkfVk5WuKcQ',
 context_source_url='https://www.last.fm/music/Kendrick+Lamar/+wiki'
 where name='Kendrick Lamar';
update public.artists set active=true, exclusion_reason=null, genre='Hip-hop',
 biography='JID is an Atlanta rapper whose music pairs detailed storytelling with agile vocal rhythms.',
 music_context='His music connects Atlanta rap with funk and soul influences. Start with The Forever Story and its intricate narrative songs.',
 notable_releases='["The Never Story", "DiCaprio 2", "The Forever Story"]',
 listening_url='https://www.youtube.com/channel/UC3WIRbOw46MsbycRc1N5x4g',
 context_source_url='https://www.last.fm/music/JID/+wiki' where name='JID';
update public.artists set active=true, exclusion_reason=null, genre='Hip-hop',
 biography='Denzel Curry is a rapper from Carol City in Miami Gardens, Florida.',
 music_context='His records move between intense delivery, introspection, and South Florida rap influences. Compare the energy of ZUU with Melt My Eyez See Your Future.',
 notable_releases='["TA13OO", "ZUU", "Melt My Eyez See Your Future"]',
 listening_url='https://www.youtube.com/channel/UCiKxNv_MHAShqT2lATxG_Wg',
 context_source_url='https://www.last.fm/music/Denzel+Curry/+wiki' where name='Denzel Curry';

alter table public.profiles add column onboarding_version integer not null default 0;
alter table public.profiles add column onboarding_step integer not null default 0 check (onboarding_step between 0 and 2);
alter table public.profiles add column onboarding_completed boolean not null default false;
alter table public.paper_positions add column cost_basis_cents bigint;
update public.paper_positions set cost_basis_cents=quantity::bigint*average_cost_cents;
alter table public.paper_positions alter column cost_basis_cents set not null;
alter table public.paper_positions add constraint position_cost_positive check(cost_basis_cents>0);
alter table public.paper_positions add column last_purchased_at timestamptz;
update public.paper_positions p set last_purchased_at=coalesce((select max(t.executed_at) from public.paper_trades t where t.user_id=p.user_id and t.artist_id=p.artist_id and t.side='buy'), p.first_purchased_at);
alter table public.paper_positions alter column last_purchased_at set not null;
alter table public.paper_trades add column fee_cents bigint not null default 0;
alter table public.paper_trades add column gross_cents bigint;
update public.paper_trades set gross_cents=total_cents;
alter table public.paper_trades alter column gross_cents set not null;
alter table public.paper_trades add column quote_version bigint;
alter table public.paper_trades add column actor_kind text not null default 'user' check(actor_kind in ('user','agent'));
alter table public.paper_portfolio_snapshots add column holding_prices jsonb not null default '[]';
alter table public.paper_portfolio_snapshots add column valuation_version text not null default 'legacy-v1';

create table public.pricing_controls(id boolean primary key default true check(id), enabled boolean not null default false);
insert into public.pricing_controls values(true,false);
create table public.artist_market_state(
 artist_id integer primary key references public.artists(id),
 anchor_cents numeric not null check(anchor_cents>=1),
 raw_reference numeric not null check(raw_reference>0),
 base_anchor_cents numeric not null check(base_anchor_cents>0),
 baseline_inventory bigint not null,
 inventory bigint not null,
 version bigint not null default 1,
 price_cents bigint not null check(price_cents>=1),
 demand_percent numeric not null default 0,
 source_as_of timestamptz not null,
 sources jsonb not null default '{}',
 refreshed_at timestamptz not null default now(),
 pricing_version text not null default 'audience-inventory-v2'
);
create table public.published_quotes(
 id bigint generated always as identity primary key,
 artist_id integer not null references public.artists(id),
 version bigint not null,
 price_cents bigint not null,
 anchor_cents numeric not null,
 demand_percent numeric not null,
 source_as_of timestamptz not null,
 sources jsonb not null,
 observed_at timestamptz not null default now(),
 pricing_version text not null default 'audience-inventory-v2',
 unique(artist_id,version)
);
create index published_quotes_artist_time on public.published_quotes(artist_id,observed_at);
alter table public.pricing_controls enable row level security;
alter table public.artist_market_state enable row level security;
alter table public.published_quotes enable row level security;
revoke all on public.pricing_controls, public.artist_market_state, public.published_quotes from anon,authenticated;
grant all on public.pricing_controls, public.artist_market_state, public.published_quotes to service_role;
grant usage,select on sequence public.published_quotes_id_seq to service_role;

create function public.get_pricing_observations()
returns table(artist_id integer,snapshot_date date,lastfm_tracks jsonb,youtube_subscribers bigint)
language sql stable security definer set search_path='' as $$
 with lf as (
 select s.artist_id,s.date,jsonb_object_agg(s.track_key,s.playcount) as tracks
 from public.lastfm_track_snapshots s where s.date<=current_date and s.track_key is not null and s.playcount>0
 group by s.artist_id,s.date
 ), yt as (
 select s.artist_id,s.date,max(s.subscribers)::bigint as subscribers from public.youtube_snapshots s
 where s.date<=current_date and s.subscribers>0 group by s.artist_id,s.date
 ) select coalesce(lf.artist_id,yt.artist_id),coalesce(lf.date,yt.date),lf.tracks,yt.subscribers
 from lf full join yt on lf.artist_id=yt.artist_id and lf.date=yt.date order by 1,2;
$$;

-- Stable log(cosh(x)) avoids overflow for large inventories.
create function public.curve_primitive(q numeric) returns numeric
language sql immutable strict set search_path='' as $$
 select q + 2000 * (abs(q/10000) + ln(1+exp(-2*abs(q/10000))) - ln(2::numeric));
$$;
create function public.curve_price(anchor numeric,q numeric) returns bigint
language sql immutable strict set search_path='' as $$
 select greatest(1,round(anchor*(1+0.2*(2/(1+exp(-2*greatest(-30,least(30,q/10000))))-1))))::bigint;
$$;

create function public.publish_artist_anchor(p_artist_id integer,p_raw numeric,p_as_of timestamptz,p_sources jsonb,p_initial bigint)
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
   update public.artist_market_state set anchor_cents=anchor,source_as_of=p_as_of,sources=p_sources,version=version+1,refreshed_at=now(),
     price_cents=public.curve_price(anchor,inventory-baseline_inventory),
     demand_percent=(public.curve_price(anchor,inventory-baseline_inventory)/anchor-1)*100
   where artist_id=p_artist_id returning * into s;
 end if;
 insert into public.published_quotes(artist_id,version,price_cents,anchor_cents,demand_percent,source_as_of,sources)
 values(s.artist_id,s.version,s.price_cents,s.anchor_cents,s.demand_percent,s.source_as_of,s.sources);
end;
$$;

create function public.trade_estimate(p_artist_id integer,p_side text,p_quantity integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.artist_market_state; q numeric; gross bigint; fee bigint; total bigint; after_price bigint; a public.artists;
begin
 if p_side not in ('buy','sell') or p_side is null or p_quantity is null or p_quantity<1 or p_quantity>1000000 then raise exception 'invalid_trade'; end if;
 select * into a from public.artists where id=p_artist_id;
 if not found or not a.active or a.biography='' or a.music_context='' or a.listening_url not like 'https://%' then raise exception 'artist_unsupported'; end if;
 select * into s from public.artist_market_state where artist_id=p_artist_id;
 if not found or s.source_as_of>now() or s.source_as_of<now()-interval '48 hours' then raise exception 'quote_not_tradable'; end if;
 q:=s.inventory-s.baseline_inventory;
 if p_side='buy' then
  gross:=ceil(s.anchor_cents*(public.curve_primitive(q+p_quantity)-public.curve_primitive(q)));
  after_price:=public.curve_price(s.anchor_cents,q+p_quantity);
 else
  gross:=floor(s.anchor_cents*(public.curve_primitive(q)-public.curve_primitive(q-p_quantity)));
  after_price:=public.curve_price(s.anchor_cents,q-p_quantity);
 end if;
 fee:=ceil(gross::numeric*10/10000);
 total:=case when p_side='buy' then gross+fee else greatest(0,gross-fee) end;
 return jsonb_build_object('quote_version',s.version::text,'gross_cents',gross,'fee_cents',fee,'total_cents',total,
  'execution_price_cents',round(gross::numeric/p_quantity),'price_after_cents',after_price,
  'price_impact_percent',(after_price::numeric/s.price_cents-1)*100,'shadow',not (select enabled from public.pricing_controls where id),
  'as_of',s.source_as_of,'pricing_version',s.pricing_version);
end;
$$;

-- One statement reads cash, all positions and quote versions consistently.
create function public.get_portfolio_v2(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with held as (
 select p.*, a.name,a.genre,a.active,a.biography,a.music_context,a.listening_url,a.notable_releases,a.context_source_url,a.image_url,
   s.price_cents,s.source_as_of,s.version,
   case when a.id is null or not a.active or s.price_cents is null or s.source_as_of>now() then 'purchase_cost'
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
  'quote_as_of',case when basis='purchase_cost' then null else source_as_of end,'valuation_basis',basis,'quote_version',version::text,
  'purchases',coalesce((select jsonb_agg(jsonb_build_object('quantity',t.quantity,'priceCents',t.execution_price_cents,'totalCents',t.total_cents,'feeCents',t.fee_cents,'date',t.executed_at) order by t.executed_at)
     from public.paper_trades t where t.user_id=p_user_id and t.artist_id=marks.artist_id and t.side='buy'),'[]'::jsonb)
 ) order by first_purchased_at),'[]'::jsonb) as items,coalesce(sum(value),0) as value,
 coalesce(sum(cost_basis_cents),0) as cost,min(source_as_of) filter(where basis<>'purchase_cost') as oldest,
 coalesce(bool_or(basis<>'quote'),false) as degraded from marks
 ), trades as (
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'artist',jsonb_build_object('id',t.artist_id::text,'name',coalesce(a.name,'Unavailable artist'),'symbol',left(regexp_replace(upper(replace(coalesce(a.name,'Artist'),'.','')), '(^|\s)(\S)\S*','\2','g'),4),'genre',coalesce(a.genre,'Music')),
 'side',t.side,'quantity',t.quantity,'execution_price_cents',t.execution_price_cents,'total_cents',t.total_cents,'fee_cents',t.fee_cents,'executed_at',t.executed_at) order by t.executed_at desc),'[]'::jsonb) as items
 from (select * from public.paper_trades where user_id=p_user_id order by executed_at desc limit 50) t left join public.artists a on a.id=t.artist_id
 ) select jsonb_build_object('summary',jsonb_build_object('cash_cents',p.cash_cents,'holdings_value_cents',h.value,'total_value_cents',p.cash_cents+h.value,
 'gain_loss_cents',h.value-h.cost,'as_of',h.oldest,'calculated_at',now(),'status',case when h.degraded then 'stale' else 'fresh' end),
 'holdings',h.items,'trades',trades.items) from public.profiles p cross join holdings h cross join trades where p.id=p_user_id;
$$;

create function public.capture_portfolio_v2(p_user_id uuid,p_source text,p_trade_id bigint default null) returns void
language plpgsql security definer set search_path='' as $$
declare data jsonb; last public.paper_portfolio_snapshots;
begin
 perform 1 from public.profiles where id=p_user_id for update;
 data:=public.get_portfolio_v2(p_user_id);
 if data is null then return; end if;
 select * into last from public.paper_portfolio_snapshots where user_id=p_user_id order by observed_at desc,id desc limit 1;
 if p_source='quote_refresh' and last.valuation_version='purchase-fallback-v2' and last.cash_cents=(data#>>'{summary,cash_cents}')::bigint
 and last.total_cents=(data#>>'{summary,total_value_cents}')::bigint and last.holding_prices=data->'holdings' then return; end if;
 insert into public.paper_portfolio_snapshots(user_id,trade_id,source,cash_cents,holdings_cents,total_cents,source_date,status,holding_prices,valuation_version)
 values(p_user_id,p_trade_id,p_source,(data#>>'{summary,cash_cents}')::bigint,(data#>>'{summary,holdings_value_cents}')::bigint,
 (data#>>'{summary,total_value_cents}')::bigint,(data#>>'{summary,as_of}')::timestamptz,data#>>'{summary,status}',data->'holdings','purchase-fallback-v2')
 on conflict(trade_id) do nothing;
end;
$$;

create function public.execute_market_trade(p_user_id uuid,p_artist_id integer,p_side text,p_quantity integer,p_request_id uuid,p_quote_version text)
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
  price_cents=(estimate->>'price_after_cents')::bigint,version=version+1,
  demand_percent=((estimate->>'price_after_cents')::numeric/anchor_cents-1)*100 where artist_id=p_artist_id returning * into s;
 insert into public.published_quotes(artist_id,version,price_cents,anchor_cents,demand_percent,source_as_of,sources)
 values(s.artist_id,s.version,s.price_cents,s.anchor_cents,s.demand_percent,s.source_as_of,s.sources);
 perform public.capture_portfolio_v2(p_user_id,'trade',t.id);
 return jsonb_build_object('ok',true,'code','accepted','message','Paper trade completed.','trade_id',t.id,
 'execution_price_cents',t.execution_price_cents,'total_cents',total,'fee_cents',fee,'cash_cents',cash,'idempotent',false);
end;
$$;
-- Close the old flat-price path, including service-role callers.
revoke all on function public.execute_paper_trade(uuid,integer,text,integer,bigint,uuid) from service_role;

create table public.ingestion_runs(
 id uuid primary key,source text not null,scheduled_slot text not null,started_at timestamptz not null,finished_at timestamptz,
 expected integer not null,crashed boolean not null default false
);
create table public.ingestion_outcomes(
 run_id uuid references public.ingestion_runs(id),artist_id integer references public.artists(id),artist_name text not null,
 started_at timestamptz not null,finished_at timestamptz not null,status text not null check(status in ('success','failed','unattempted')),
 category text,primary key(run_id,artist_id)
);
create index ingestion_runs_time on public.ingestion_runs(started_at);
alter table public.ingestion_runs enable row level security;
alter table public.ingestion_outcomes enable row level security;
revoke all on public.ingestion_runs,public.ingestion_outcomes from anon,authenticated;
grant all on public.ingestion_runs,public.ingestion_outcomes to service_role;

-- Functions are callable only by the trusted API/ingestion role.
revoke all on function public.get_pricing_observations(),public.curve_primitive(numeric),public.curve_price(numeric,numeric),public.publish_artist_anchor(integer,numeric,timestamptz,jsonb,bigint),public.trade_estimate(integer,text,integer),public.get_portfolio_v2(uuid),public.capture_portfolio_v2(uuid,text,bigint),public.execute_market_trade(uuid,integer,text,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.get_pricing_observations(),public.curve_primitive(numeric),public.curve_price(numeric,numeric),public.publish_artist_anchor(integer,numeric,timestamptz,jsonb,bigint),public.trade_estimate(integer,text,integer),public.get_portfolio_v2(uuid),public.capture_portfolio_v2(uuid,text,bigint),public.execute_market_trade(uuid,integer,text,integer,uuid,text) to service_role;

-- Recover exact remaining costs where the complete execution ledger is available.
-- Positions with incomplete legacy records retain their existing basis and are labeled.
alter table public.paper_positions add column cost_basis_method text not null default 'legacy_average';
do $$
declare p record; t record; units bigint; basis bigint; complete boolean;
begin
 for p in select * from public.paper_positions loop
  units:=0; basis:=0; complete:=true;
  for t in select * from public.paper_trades where user_id=p.user_id and artist_id=p.artist_id order by executed_at,id loop
   if t.side='buy' then units:=units+t.quantity; basis:=basis+t.total_cents;
   else
    if units<t.quantity then complete:=false; exit; end if;
    basis:=basis-round(basis::numeric*t.quantity/units); units:=units-t.quantity;
   end if;
  end loop;
  if complete and units=p.quantity and basis>0 then
   update public.paper_positions set cost_basis_cents=basis,average_cost_cents=round(basis::numeric/units),cost_basis_method='ledger' where user_id=p.user_id and artist_id=p.artist_id;
  end if;
 end loop;
end;
$$;
alter table public.paper_positions alter column cost_basis_method set default 'ledger';
alter table public.paper_positions add constraint cost_basis_method_valid check(cost_basis_method in ('ledger','legacy_average'));

create or replace function public.curve_primitive(q numeric) returns numeric
language sql immutable strict set search_path='' as $$
 select q + 2000 * (abs(q/10000) + case when abs(q/10000)>30 then 0 else ln(1+exp(-2*abs(q/10000))) end - ln(2::numeric));
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
  'quantity',quantity,'average_cost_cents',round(cost_basis_cents::numeric/quantity),'cost_basis_cents',cost_basis_cents,'cost_basis_method',cost_basis_method,
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



create or replace function public.capture_portfolio_v2(p_user_id uuid,p_source text,p_trade_id bigint default null) returns void
language plpgsql security definer set search_path='' as $$
declare data jsonb; last public.paper_portfolio_snapshots; marks jsonb;
begin
 perform 1 from public.profiles where id=p_user_id for update;
 data:=public.get_portfolio_v2(p_user_id);
 if data is null then return; end if;
 select coalesce(jsonb_agg(item-'purchases'),'[]'::jsonb) into marks from jsonb_array_elements(data->'holdings') item;
 select * into last from public.paper_portfolio_snapshots where user_id=p_user_id order by observed_at desc,id desc limit 1;
 if p_source='quote_refresh' and last.valuation_version='purchase-fallback-v2' and last.cash_cents=(data#>>'{summary,cash_cents}')::bigint
 and last.total_cents=(data#>>'{summary,total_value_cents}')::bigint and last.holding_prices=marks then return; end if;
 insert into public.paper_portfolio_snapshots(user_id,trade_id,source,cash_cents,holdings_cents,total_cents,source_date,status,holding_prices,valuation_version)
 values(p_user_id,p_trade_id,p_source,(data#>>'{summary,cash_cents}')::bigint,(data#>>'{summary,holdings_value_cents}')::bigint,
 (data#>>'{summary,total_value_cents}')::bigint,(data#>>'{summary,as_of}')::timestamptz,data#>>'{summary,status}',marks,'purchase-fallback-v2')
 on conflict(trade_id) do nothing;
end;
$$;


create or replace function public.trade_estimate(p_artist_id integer,p_side text,p_quantity integer)
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
 if gross<1 then raise exception 'order_too_small'; end if;
 fee:=ceil(gross::numeric*10/10000);
 total:=case when p_side='buy' then gross+fee else greatest(0,gross-fee) end;
 if total<1 then raise exception 'order_too_small'; end if;
 return jsonb_build_object('quote_version',s.version::text,'gross_cents',gross,'fee_cents',fee,'total_cents',total,
  'execution_price_cents',round(gross::numeric/p_quantity),'price_after_cents',after_price,
  'price_impact_percent',(after_price::numeric/s.price_cents-1)*100,'shadow',not coalesce((select enabled from public.pricing_controls where id),false),
  'as_of',s.source_as_of,'pricing_version',s.pricing_version);
end;
$$;

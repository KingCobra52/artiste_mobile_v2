create or replace function public.execute_market_trade(p_user_id uuid,p_artist_id integer,p_side text,p_quantity integer,p_request_id uuid,p_quote_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.artist_market_state; t public.paper_trades; pos public.paper_positions; estimate jsonb; cash bigint; gross bigint; fee bigint; total bigint; basis bigint; affected uuid[]; owner_id uuid;
begin
 -- Lock order: artist, then all affected wallets in UUID order.
 -- This records a quote-changing trade for every existing owner without
 -- acquiring wallet locks in conflicting orders across different artists.
 perform pg_advisory_xact_lock(18373,p_artist_id);
 select * into s from public.artist_market_state where artist_id=p_artist_id for update;
 select array_agg(id order by id) into affected from public.profiles p
 where id=p_user_id or exists(select 1 from public.paper_positions held where held.user_id=p.id and held.artist_id=p_artist_id);
 perform 1 from public.profiles where id=any(affected) order by id for update;
 select cash_cents into cash from public.profiles where id=p_user_id;
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
 foreach owner_id in array affected loop
  if owner_id=p_user_id then perform public.capture_portfolio_v2(owner_id,'trade',t.id);
  else perform public.capture_portfolio_v2(owner_id,'quote_refresh',null); end if;
 end loop;
 return jsonb_build_object('ok',true,'code','accepted','message','Paper trade completed.','trade_id',t.id,
 'execution_price_cents',t.execution_price_cents,'total_cents',total,'fee_cents',fee,'cash_cents',cash,'idempotent',false);
end;
$$;

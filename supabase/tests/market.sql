begin;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
select public.publish_artist_anchor(4,1000,now()-interval '1 hour','{"youtube":{"asOf":"test"}}',1000);
do $$ declare before_price bigint; after_price bigint; begin
 select price_cents into before_price from public.artist_market_state where artist_id=4;
 perform public.publish_performance_anchor(4,1200,now(),'{"model_version":"performance-index-shadow-v2","change_percent":2}',1000,'performance-index-v2');
 select price_cents into after_price from public.artist_market_state where artist_id=4;
 assert after_price=before_price,'performance-model transition changed the quote';
 assert (select pricing_version='performance-index-v2' from public.artist_market_state where artist_id=4);
 perform public.publish_performance_anchor(4,1260,now(),'{"model_version":"performance-index-shadow-v2","change_percent":5}',1000,'performance-index-v2');
 assert (select price_cents>before_price from public.artist_market_state where artist_id=4),'performance change did not move quote';
end $$;
do $$ begin
 assert not (select enabled from public.pricing_controls where id),'engine did not default to shadow mode';
 begin
  perform public.execute_market_trade('10000000-0000-4000-8000-000000000001',4,'buy',1,'20000000-0000-4000-8000-000000000009','1');
  raise exception 'shadow engine accepted execution';
 exception when raise_exception then if sqlerrm<>'pricing_shadow' then raise; end if; end;
 assert not exists(select 1 from public.paper_trades),'shadow request changed the ledger';
end $$;
update public.pricing_controls set enabled=true;
do $$
declare preview jsonb; bought jsonb; retried jsonb; sold jsonb; account jsonb; n bigint; original_cash bigint; before_version bigint;
begin
 assert not has_function_privilege('anon','public.execute_market_trade(uuid,integer,text,integer,uuid,text)','execute');
 assert not has_function_privilege('authenticated','public.get_portfolio_v2(uuid)','execute');
 assert not has_function_privilege('service_role','public.execute_paper_trade(uuid,integer,text,integer,bigint,uuid)','execute');
 select cash_cents into original_cash from public.profiles where id='10000000-0000-4000-8000-000000000001';
 preview:=public.trade_estimate(4,'buy',5);
 assert (preview->>'fee_cents')::bigint>0;
 bought:=public.execute_market_trade('10000000-0000-4000-8000-000000000001',4,'buy',5,'20000000-0000-4000-8000-000000000001',preview->>'quote_version');
 retried:=public.execute_market_trade('10000000-0000-4000-8000-000000000001',4,'buy',5,'20000000-0000-4000-8000-000000000001',preview->>'quote_version');
 assert (retried->>'idempotent')::boolean;
 assert (select count(*)=1 from public.paper_trades where user_id='10000000-0000-4000-8000-000000000001');
 assert (select quantity=5 from public.paper_positions where user_id='10000000-0000-4000-8000-000000000001');
 begin
  perform public.execute_market_trade('10000000-0000-4000-8000-000000000001',4,'buy',1,'20000000-0000-4000-8000-000000000002',preview->>'quote_version');
  raise exception 'stale quote was executed';
 exception when raise_exception then if sqlerrm<>'quote_changed' then raise; end if; end;
 account:=public.get_portfolio_v2('10000000-0000-4000-8000-000000000002');
 assert jsonb_array_length(account->'holdings')=0;
 update public.artists set active=false where id=4;
 account:=public.get_portfolio_v2('10000000-0000-4000-8000-000000000001');
 assert account#>>'{holdings,0,valuation_basis}'='purchase_cost';
 assert (account#>>'{holdings,0,current_value_cents}')::bigint=(bought->>'total_cents')::bigint;
 assert account#>>'{holdings,0,quote_as_of}' is null;
 assert (account#>>'{summary,total_value_cents}')::bigint=original_cash;
 update public.artists set active=true where id=4;
 -- Fresh quotes for unheld artists must not change portfolio timestamps.
 perform public.publish_artist_anchor(16,1000,now(),'{}',1000);
 update public.artist_market_state set priced_at=now()-interval '1 hour' where artist_id=4;
 account:=public.get_portfolio_v2('10000000-0000-4000-8000-000000000001');
 assert (account#>>'{summary,as_of}')::timestamptz<now()-interval '30 minutes';
 -- Failed orders have no financial or inventory effect.
 select version into before_version from public.artist_market_state where artist_id=4;
 begin
  perform public.execute_market_trade('10000000-0000-4000-8000-000000000002',4,'sell',1,'20000000-0000-4000-8000-000000000004',before_version::text);
  raise exception 'unowned shares were sold';
 exception when raise_exception then if sqlerrm<>'insufficient_shares' then raise; end if; end;
 assert (select version=before_version from public.artist_market_state where artist_id=4);
 preview:=public.trade_estimate(4,'sell',5);
 sold:=public.execute_market_trade('10000000-0000-4000-8000-000000000001',4,'sell',5,'20000000-0000-4000-8000-000000000003',preview->>'quote_version');
 assert (sold->>'cash_cents')::bigint<original_cash,'round trip minted virtual cash';
 assert (select inventory=baseline_inventory from public.artist_market_state where artist_id=4);
 assert (select count(*)=2 from public.paper_portfolio_snapshots where user_id='10000000-0000-4000-8000-000000000001');
 select count(*) into n from public.paper_portfolio_snapshots;
 perform public.get_portfolio_v2('10000000-0000-4000-8000-000000000001');
 assert (select count(*)=n from public.paper_portfolio_snapshots),'portfolio read wrote a valuation';
 begin
  perform public.publish_artist_anchor(4,999999,now()+interval '1 day','{}',1000);
  raise exception 'future anchor accepted';
 exception when raise_exception then if sqlerrm<>'invalid_anchor' then raise; end if; end;
end $$;
rollback;

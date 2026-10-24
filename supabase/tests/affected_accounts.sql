begin;
insert into auth.users(id) values('50000000-0000-4000-8000-000000000001'),('50000000-0000-4000-8000-000000000002');
select public.publish_artist_anchor(4,1000,now()-interval '1 hour','{}',1000);
update public.pricing_controls set enabled=true;
do $$
declare preview jsonb; n bigint; portfolio jsonb; snapshot public.paper_portfolio_snapshots;
begin
 preview:=public.trade_estimate(4,'buy',1);
 perform public.execute_market_trade('50000000-0000-4000-8000-000000000001',4,'buy',1,'60000000-0000-4000-8000-000000000001',preview->>'quote_version');
 select count(*) into n from public.paper_portfolio_snapshots where user_id='50000000-0000-4000-8000-000000000001';
 preview:=public.trade_estimate(4,'buy',5);
 perform public.execute_market_trade('50000000-0000-4000-8000-000000000002',4,'buy',5,'60000000-0000-4000-8000-000000000002',preview->>'quote_version');
 assert (select count(*)=n+1 from public.paper_portfolio_snapshots where user_id='50000000-0000-4000-8000-000000000001'),'another owner missed the quote update';
 portfolio:=public.get_portfolio_v2('50000000-0000-4000-8000-000000000001');
 select * into snapshot from public.paper_portfolio_snapshots where user_id='50000000-0000-4000-8000-000000000001' order by observed_at desc,id desc limit 1;
 assert snapshot.total_cents=(portfolio#>>'{summary,total_value_cents}')::bigint;
 assert snapshot.holding_prices->0->>'quote_version'=portfolio#>>'{holdings,0,quote_version}';
end $$;
rollback;

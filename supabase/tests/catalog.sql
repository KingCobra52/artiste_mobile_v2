begin;
insert into auth.users(id) values('30000000-0000-4000-8000-000000000001');
-- A catalog artist needs no editorial fields to trade or use quote valuation.
update public.artists set active=true, biography='',music_context='',listening_url='' where id=2;
select public.publish_artist_anchor(2,1000,now()-interval '48 hours','{}',1000);
update public.pricing_controls set enabled=true;
do $$
declare preview jsonb; account jsonb; direction text; version text;
begin
 preview:=public.trade_estimate(2,'buy',2);
 perform public.execute_market_trade('30000000-0000-4000-8000-000000000001',2,'buy',2,'30000000-0000-4000-8000-000000000002',preview->>'quote_version');
 account:=public.get_portfolio_v2('30000000-0000-4000-8000-000000000001');
 assert account#>>'{holdings,0,valuation_basis}'='quote';
 select s.version::text into version from public.artist_market_state s where artist_id=2;
 -- An estimate can expire before confirmation, without its version changing.
 update public.artist_market_state set source_as_of=now()-interval '48 hours 1 second' where artist_id=2;
 foreach direction in array array['buy','sell'] loop
  begin
   perform public.trade_estimate(2,direction,1);
   raise exception 'stale preview accepted';
  exception when raise_exception then if sqlerrm<>'quote_not_tradable' then raise; end if; end;
  begin
   perform public.execute_market_trade('30000000-0000-4000-8000-000000000001',2,direction,1,'30000000-0000-4000-8000-000000000003',version);
   raise exception 'stale execution accepted';
  exception when raise_exception then if sqlerrm<>'quote_not_tradable' then raise; end if; end;
 end loop;
 account:=public.get_portfolio_v2('30000000-0000-4000-8000-000000000001');
 assert account#>>'{holdings,0,valuation_basis}'='stale_quote';
 assert (account#>>'{holdings,0,data_source_as_of}')::timestamptz=now()-interval '48 hours 1 second';
 assert (select count(*)=1 from public.paper_trades where user_id='30000000-0000-4000-8000-000000000001');
 delete from public.artist_market_state where artist_id=2;
 begin
  perform public.trade_estimate(2,'buy',1);
  raise exception 'missing quote accepted';
 exception when raise_exception then if sqlerrm<>'quote_not_tradable' then raise; end if; end;
 account:=public.get_portfolio_v2('30000000-0000-4000-8000-000000000001');
 assert account#>>'{holdings,0,valuation_basis}'='purchase_cost';
 update public.artists set active=false where id=2;
 begin
  perform public.trade_estimate(2,'buy',1);
  raise exception 'excluded artist accepted';
 exception when raise_exception then if sqlerrm<>'artist_unsupported' then raise; end if; end;
end $$;
rollback;

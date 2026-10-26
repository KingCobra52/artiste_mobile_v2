-- Preserve the experimental performance index beside live prices. Nothing in
-- this migration changes the quote used for previews or trade execution.
create or replace function public.get_performance_observations()
returns table(
  artist_id integer,
  snapshot_date date,
  lastfm_tracks jsonb,
  youtube_videos jsonb
)
language sql stable security definer set search_path='' as $$
  with lf as (
    select s.artist_id, s.date,
      jsonb_object_agg(s.track_key, jsonb_build_object(
        'playcount', s.playcount, 'listeners', s.listeners
      )) as tracks
    from public.lastfm_track_snapshots s
    where s.date <= current_date and s.track_key is not null
      and (s.playcount > 0 or s.listeners > 0)
    group by s.artist_id, s.date
  ), yt as (
    select s.artist_id, s.date,
      jsonb_object_agg(s.video_id, jsonb_build_object(
        'views', s.view_count, 'likes', s.like_count, 'comments', s.comment_count
      )) as videos
    from public.recent_youtube_video_snapshots s
    where s.date <= current_date and s.video_id is not null
    group by s.artist_id, s.date
  )
  select coalesce(lf.artist_id, yt.artist_id), coalesce(lf.date, yt.date),
    lf.tracks, yt.videos
  from lf full join yt on lf.artist_id = yt.artist_id and lf.date = yt.date
  order by 1, 2;
$$;

create table public.pricing_shadow_quotes(
  id bigint generated always as identity primary key,
  artist_id integer not null references public.artists(id),
  model_version text not null,
  input_hash text not null,
  source_as_of timestamptz not null,
  performance_index_cents bigint not null check(performance_index_cents > 0),
  confidence numeric not null check(confidence between 0 and 1),
  status text not null check(status in ('fresh','stale')),
  sources jsonb not null,
  published_at timestamptz not null default now(),
  unique(artist_id, model_version, input_hash)
);

alter table public.pricing_shadow_quotes enable row level security;
revoke all on public.pricing_shadow_quotes from anon, authenticated;
grant all on public.pricing_shadow_quotes to service_role;
grant usage, select on sequence public.pricing_shadow_quotes_id_seq to service_role;
revoke all on function public.get_performance_observations() from public, anon, authenticated;
grant execute on function public.get_performance_observations() to service_role;

insert into public.artists
  (id, name, tier, youtube_handle, youtube_channel_id)
values
  (1, 'Drake', 'Established', 'DrakeOfficial', 'UCByOQJjav0CUDwxCk-jVNRQ'),
  (2, 'Travis Scott', 'Established', 'TravisScottXX', 'UCtxdfwb9wfkoGocVUAJ-Bmg'),
  (3, 'Future', 'Established', 'officialfuturevideos', 'UCSDvKdIQOwTfcyOimSi9oYA'),
  (4, 'Kendrick Lamar', 'Established', 'kendricklamar', 'UC3lBXcrKFnFAFkfVk5WuKcQ'),
  (5, 'J. Cole', 'Established', 'jcole', 'UCnc6db-y3IU7CkT_yeVXdVg'),
  (6, 'Lil Baby', 'Established', 'LilBabyATL', 'UCVS88tG_NYgxF6Udnx2815Q'),
  (7, 'Playboi Carti', 'Rising', 'playboicarti', 'UC652oRUvX1onwrrZ8ADJRPw'),
  (8, 'Don Toliver', 'Rising', 'dontoliver', 'UCgT01FILdWB9BsXBXKjpQ7A'),
  (9, 'GloRilla', 'Rising', 'theofficialGloRilla', 'UC9bZ9eWvF0eXVqrxK9ve7Nw'),
  (10, 'Central Cee', 'Rising', 'centralcee', 'UCV_CsAy5CNBX_uwDQ7RMe1Q'),
  (11, 'Ice Spice', 'Rising', 'icespice', 'UCJTqwQj5iTHYrko04PbGI9w'),
  (12, 'Rod Wave', 'Rising', 'RodWaveOfficial', 'UCenjunBhBhvKjfDAESnoppw'),
  (13, '21 Savage', 'Rising', '21savage', 'UCOjEHmBKwdS7joWpW0VrXkg'),
  (14, 'Gunna', 'Rising', 'GunnaOfficial', 'UCAkIMkEaa9sZmjcy7mfd5lQ'),
  (15, 'Sexyy Red', 'Rising', 'sexyyred', 'UC28rc3PHWPJib68G-VqpJ3w'),
  (16, 'JID', 'Breaking', 'jid6871', 'UC3WIRbOw46MsbycRc1N5x4g'),
  (17, 'Denzel Curry', 'Breaking', 'denzelcurryph', 'UCiKxNv_MHAShqT2lATxG_Wg'),
  (18, 'EsDeeKid', 'Breaking', 'esdeekid', 'UC8jLPGsRRCTaK-PAWIfCrpg'),
  (19, 'fakemink', 'Breaking', 'Fakeminkk', 'UCDnRK591TaPlJrHxjA1PL4A'),
  (20, 'Zeddy Will', 'Breaking', 'zeddywill', 'UC47-wNKFQbYDTBWcdGUGxpw'),
  (21, 'Kai Ca$h', 'Breaking', 'KaiCashmusic', 'UCdNIZ7nY7vOxG_HXGdn3T4Q'),
  (22, 'JELEEL!', 'Breaking', 'jeleeeeel', 'UC5wSitOQZCJVNNDw0-V1PlQ'),
  (24, 'Kae', 'Breaking', 'kaejiyeo', 'UCzzxeFDHhTrHrLMx-DF2wbQ'),
  (25, 'Baby Keem', 'Breaking', 'babykeem', 'UCq0Hi7HpCBCNeKpdKKcQqGQ')
on conflict (id) do update set
  name = excluded.name,
  tier = excluded.tier,
  youtube_handle = excluded.youtube_handle,
  youtube_channel_id = excluded.youtube_channel_id;

select setval(pg_get_serial_sequence('public.artists', 'id'),
  greatest((select coalesce(max(id), 1) from public.artists), 1), true);

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

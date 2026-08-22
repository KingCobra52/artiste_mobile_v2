#from track_pipelines.py - artiste_old
#needs the track_key method. A schema change added a unique index on
#(artist_id, track_key, date). Two songs with the same key can no longer both go
#in. dedupe_by_key picks which one to keep.
import re
import unicodedata
from datetime import date

import requests

from backend.app.config import lastfm_api_key
from backend.app.supabase_client import supabase
from pipelines.http_errors import describe_request_error
from pipelines.artists import artists
from requests.exceptions import HTTPError, RequestException

today = date.today()

session = requests.Session()


URL = "http://ws.audioscrobbler.com/2.0/"

#takes the top 10 tracks per artists
TOP_N = 10

_FEATURE = re.compile(
    r"[\(\[]\s*(?:feat|ft|featuring|with)\b[^\)\]]*[\)\]]|"
    r"\s+-\s+(?:feat|ft|featuring|with)\b.*$",
    re.IGNORECASE,
)
_EDITION = re.compile(
    r"[\(\[]\s*(?:\d{4}\s+)?(?:re-?master(?:ed)?|remaster(?:ed)?\s+\d{4}|"
    r"radio\s+edit|single\s+version|album\s+version|explicit|clean|"
    r"bonus\s+track|deluxe|original\s+mix)\s*[^\)\]]*[\)\]]|"
    r"\s+-\s+(?:\d{4}\s+)?(?:re-?master(?:ed)?|remaster(?:ed)?\s+\d{4}|"
    r"radio\s+edit|single\s+version|album\s+version|explicit|clean|"
    r"bonus\s+track|deluxe|original\s+mix)\s*.*$",
    re.IGNORECASE,
)
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_SPACE = re.compile(r"\s+")

class LastfmError(Exception):
    """Lastfm answered 200 with an error body, which it does for unknown artists"""

def track_key(name):
    """
    A stable identifier for a track across days.

    Normalisation is deliberately conservative - it removes the things Last.fm
    changes about a label, not the things that distinguish one track from another:

        "HUMBLE."                        -> "humble"
        "Humble"                         -> "humble"
        "Money Trees (feat. Jay Rock)"   -> "money trees"
        "Alright - Remastered 2015"      -> "alright"

    but a remix or a live cut keeps its marker and stays a separate track, because
    it genuinely is one and carries its own listener count.
    """
    if not name:
        return None
    # Compatibility-decompose first so a curly apostrophe and a straight one, or an
    # accented character typed two different ways, land on the same key.
    text = unicodedata.normalize("NFKD", name)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = _FEATURE.sub(" ", text)
    text = _EDITION.sub(" ", text)
    text = _PUNCT.sub(" ", text)
    text = _SPACE.sub(" ", text).strip().lower()
    # Everything stripped means the name was punctuation alone; fall back to the
    # original rather than returning an empty key that would collide with others.
    return text or _SPACE.sub(" ", name).strip().lower()


def dedupe_by_key(tracks, artist=None):
    """
    Keep one track per track_key. Better rank wins.

    The table has a unique index on (artist_id, track_key, date). So two tracks
    with the same key cannot both go in. This happens daily for GloRilla, Ice
    Spice and Zeddy Will:

        "WHATCHU KNO ABOUT ME (feat. Sexyy Red)"  rank 4
        "WHATCHU KNO ABOUT ME (with Sexyy Red)"   rank 6   -> same key, dropped

    tracks comes in sorted by rank. So the first key we see is its best rank.

    Ranks are not renumbered. A deduped artist keeps a gap: 1,2,3,4,5,7,8,9,10.
    That matches the history already in the table.

    Dropped listeners are thrown away, not added to the survivor. Same song, so
    summing would count it twice.
    """
    kept = []
    seen = {}

    for track in tracks:
        key = track["track_key"]

        # Empty name gives a None key. The unique index ignores NULLs, and
        # nothing could join on it anyway.
        if key is None:
            print(f"Dropped {track['name']!r} (rank {track['rank']}), no usable track key")
            continue

        first = seen.get(key)
        if first is not None:
            # Print it. One key, two names means Last.fm relabelled a track.
            # That is what the mbid column is for. Silence would hide it.
            label = f" for {artist}" if artist else ""
            print(f"Dropped {track['name']!r} (rank {track['rank']}){label}, "
                  f"duplicate of rank {first['rank']} {first['name']!r}")
            continue

        seen[key] = track
        kept.append(track)

    return kept


def fetch_top_tracks(lastfm_api_key, artist, limit=TOP_N):
    response = session.get(URL, timeout=30, params={
        "method": "artist.gettoptracks",
        "artist": artist,
        "api_key": lastfm_api_key,
        "format": "json",
        "limit": limit,
    })
    response.raise_for_status()
    data = response.json()

    # Last.fm reports application-level errors inside a 200, so raise_for_status
    # alone would let an unknown artist through as an empty result.
    if "error" in data:
        raise LastfmError(data.get("message", "unknown error"))

    tracks = data.get("toptracks", {}).get("track", [])
    # A single result comes back as an object rather than a list
    if isinstance(tracks, dict):
        tracks = [tracks]

    out = []
    for rank, track in enumerate(tracks, start=1):
        listeners = track.get("listeners")
        playcount = track.get("playcount")
        name = track.get("name")
        # Last.fm sends "" rather than omitting the field when there is no
        # MusicBrainz id, and an empty string would look like a real shared id
        # linking together every track that lacks one.
        mbid = track.get("mbid") or None
        out.append({
            "rank": rank,
            "name": name,
            "track_key": track_key(name),
            "mbid": mbid,
            # None rather than 0, the same distinction the YouTube pipeline makes:
            # a missing count renormalises away, a literal 0 prices as real silence.
            "listeners": int(listeners) if listeners is not None else None,
            "playcount": int(playcount) if playcount is not None else None,
        })
    return out


def process_artist(supabase, lastfm_api_key, artist_row, today):
    """
    Fetch, dedupe and store one artist's top tracks.

    Catches nothing on purpose. run_pipeline owns the loop, so only it can decide
    whether a failure stops the run. Returning a status here would give the
    caller two things to check instead of one.
    """
    artist_id = artist_row["id"]
    artist_name = artist_row["name"]

    tracks = fetch_top_tracks(lastfm_api_key, artist_name)
    tracks = dedupe_by_key(tracks, artist_name)

    # A 200 with no tracks is still a Last.fm problem. Same channel as the rest.
    if not tracks:
        raise LastfmError("no top tracks returned")

    rows = [{
        # Store the raw name, not the key. Keeps renames visible.
        "artist_id": artist_id,
        "rank": track["rank"],
        "track_name": track["name"],
        "track_key": track["track_key"],
        "mbid": track["mbid"],
        "listeners": track["listeners"],
        "playcount": track["playcount"],
        # Always set this. The column is nullable with no default, and it is part
        # of the unique index. A NULL date would switch the constraint off.
        "date": f"{today}",
    } for track in tracks]

    # One call for all ten rows, not a loop like yt_pipeline. So an artist's day
    # lands whole or not at all. ignore_duplicates leaves earlier rows alone but
    # still fills in any the earlier run missed.
    response = (
        supabase.table("lastfm_track_snapshots")
        .upsert(rows, on_conflict="artist_id,track_key,date", ignore_duplicates=True)
        .execute()
    )

    # With ignore_duplicates, response.data holds only the new rows.
    # So an empty list means a rerun, not a failure.
    if not response.data:
        print(f"Today's top tracks already recorded for {artist_name}")


def run_pipeline(supabase, lastfm_api_key, artists):
    """
    Returns the artists that failed, as {"artist": name, "reason": text} dicts.

    A list rather than a count so the caller can name the artists that need
    fixing. len() still gives the count for the exit-code rule.
    """
    today = date.today()
    artist_append_failures = []

    for artist in artists:
        # Supabase lookup goes inside the try too, so one lookup failure costs a
        # single artist instead of ending the whole run.
        try:
            response = (
                supabase.table("artists")
                .select("id, name")
                .eq("name", f"{artist}")
                .execute()
            )
            rows = response.data
            if not rows:
                print(f"No response data for artist: {artist}")
                artist_append_failures.append(
                    {"artist": artist, "reason": "no matching row in the artists table"}
                )
                continue

            process_artist(supabase, lastfm_api_key, rows[0], today)

        # Last.fm reports unknown artists inside a 200.
        # So this catches a wrong name in artists.py.
        except LastfmError as e:
            reason = f"Last.fm rejected the lookup: {e}"
            print(f"Last.fm rejected top-track lookup for {artist}: {e}")
            artist_append_failures.append({"artist": artist, "reason": reason})
        # 403 means bad key. 429 means slow down.
        # Must come first. It subclasses RequestException.
        except HTTPError as e:
            reason = f"HTTP error: {describe_request_error(e)}"
            print(f"HTTP error occured for {artist}: {describe_request_error(e)}")
            artist_append_failures.append({"artist": artist, "reason": reason})
        # Timeout, ConnectionError, JSONDecodeError. No status code to report.
        except RequestException as e:
            reason = f"request failed: {describe_request_error(e)}"
            print(f"Request failed for {artist}: {describe_request_error(e)}")
            artist_append_failures.append({"artist": artist, "reason": reason})
        # Everything else. One bad artist must not kill the other 23.
        except Exception as e:
            reason = f"{type(e).__name__}: {e}"
            print(f"Non-HTTP error occured for {artist}: {reason}")
            artist_append_failures.append({"artist": artist, "reason": reason})

    return artist_append_failures


def main():
    run_pipeline(supabase, lastfm_api_key, artists)


if __name__ == "__main__":
    main()

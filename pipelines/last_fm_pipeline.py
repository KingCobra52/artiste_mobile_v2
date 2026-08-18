#from track_pipelines.py - artiste_old 
#need the track_key method -> make sure all the track keys -> due to schema changes can't add songs with the same track key into db -> need to decide which one to add in this file
from backend.app.config import supabase_url, supabase_secret_key, lastfm_api_key
from pipelines.pipeline import artists
from backend.app.supabase_client import supabase
import unicodedata
import requests 
from datetime import date 
import re 

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


TRACK_INSERT = ""

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


def process_artist():
    #function will call fetch_top_tracks 
    pass 

def run_pipeline():
    #for loop per artist -> will call process_artist after calling fetch_top_tracks  
    for artist in artists:
        #get the response data -> figure out of the artist is in the supabase table 
        artist_id = supabase.table("artists").select("id").eq("name", f"{artist}").execute()
        response = supabase.table("lastfm_track_snapshots").select("id").eq("artist_id", f"{artist_id}").execute()
        rows = response.data
        if not rows:
            print(f"No response data for artist: {artist}")
            continue
        try:
            process_artist()
        except:
            #refine the exceptions later in the code  
            pass

def main():
    pass 

if __name__ == "__main__":
    main()
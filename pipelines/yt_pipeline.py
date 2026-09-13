from datetime import date

import requests
from requests.exceptions import HTTPError, RequestException

from backend.app.config import yt_api_key
from backend.app.supabase_client import supabase
from pipelines.artists import artists
from pipelines.http_errors import describe_request_error

#have the http errors in both of the functions where HTTP responses are actually created

session = requests.Session()
REQUEST_TIMEOUT_SECONDS = 10

def fetch_channel_information(api_key, channel_id=None, handle=None):
    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {"part": "statistics,snippet,contentDetails", "key": api_key}
    if channel_id:
        params["id"] = channel_id
    elif handle:
        params["forHandle"] = f"@{handle}"
    else:
        raise ValueError("one of channel_id or handle is required")

    response = session.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
    # Surface quota/auth failures as HTTP errors instead of a misleading "not found"
    response.raise_for_status()
    data = response.json()

    channel_data = data["items"][0]
    stats = channel_data["statistics"]
    videos_playlist = channel_data["contentDetails"]["relatedPlaylists"]["uploads"]

    # None means "unknown", which compute_price_per_share renormalizes away.
    # A literal 0 would instead be priced as a real audience of zero.
    if stats.get("hiddenSubscriberCount", False) or "subscriberCount" not in stats:
        sub_count = None
    else:
        sub_count = int(stats["subscriberCount"])

    view_count = int(stats["viewCount"]) if "viewCount" in stats else None
    video_count = int(stats["videoCount"]) if "videoCount" in stats else None

    return {
        "channel_id": channel_data["id"],
        "channel_title": channel_data["snippet"]["title"],
        "subscriber_count": sub_count,
        "view_count": view_count,
        "video_count": video_count,
        "videos_playlist": videos_playlist,
    }


def recent_uploads_data(videos_playlist_id, api_key):
    url = "https://www.googleapis.com/youtube/v3/playlistItems"

    params = {
        "part": "contentDetails",
        "playlistId": videos_playlist_id,
        "maxResults": 50,
        "key": api_key
    }

    response = session.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    data = response.json()

    if "items" not in data or len(data["items"]) == 0:
        return []

    video_ids = []
    for item in data["items"]:
        video_ids.append(item["contentDetails"]["videoId"])

    return video_ids

def recent_videos_stats(videos_playlist_id, api_key):
    #this function needs to get the view Counts and like Counts for len(videoIds)
    video_ids = recent_uploads_data(videos_playlist_id, api_key)
    if not video_ids:
        return {}

    url = "https://www.googleapis.com/youtube/v3/videos"

    params = {
        "part": "statistics",
        "id": ",".join(video_ids),
        "key": api_key
    }

    response = session.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    data = response.json()

    video_counts = {}
    for item in data.get("items", []):
        video_stats = item.get("statistics", {})
        video_views = int(video_stats.get("viewCount", 0))
        video_likes = int(video_stats.get("likeCount", 0))
        video_comments = int(video_stats.get("commentCount", 0))
        video_counts[item["id"]] = [video_views, video_likes, video_comments]

    return video_counts


def process_artist(supabase, yt_api_key, artist_row, today):
    artist_id = artist_row["id"]
    youtube_handle = artist_row["youtube_handle"]
    youtube_channel_id = artist_row["youtube_channel_id"]

    channel_information = fetch_channel_information(yt_api_key, youtube_channel_id, youtube_handle)
    subscribers = channel_information["subscriber_count"]
    total_views = channel_information["view_count"]
    videos_playlist_id = channel_information["videos_playlist"]

    # Upsert, not insert, so a second run on the same day overwrites instead of
    # writing a duplicate row. The job runs a few times a day on purpose, and a
    # duplicate date would break the per-day deltas built on top of this table.
    #
    # Always set the date. The unique index is on (artist_id, date), so a NULL
    # date would switch the constraint off and let duplicates back in.
    (
        supabase.table("youtube_snapshots")
        .upsert({
            "artist_id": artist_id,
            "subscribers": subscribers,
            "total_views": total_views,
            "date": f"{today}",
        }, on_conflict="artist_id,date")
        .execute()
    )

    # No ignore_duplicates here, unlike last_fm_pipeline. These are running
    # counters, so a later run in the same day is the better reading and should
    # win. Last.fm stores a daily ranking, where the first reading is the one to keep.
    video_counts = recent_videos_stats(videos_playlist_id, yt_api_key)
    rows = [{
        "artist_id": artist_id,
        "video_id": video_id,
        "view_count": video_stats[0],
        "like_count": video_stats[1],
        "comment_count": video_stats[2],
        "date": f"{today}",
    } for video_id, video_stats in video_counts.items()]

    # One call for all the videos, not a call each. That was up to 50 round trips
    # per artist. It also means an artist's videos land whole or not at all.
    if rows:
        (
            supabase.table("recent_youtube_video_snapshots")
            .upsert(rows, on_conflict="artist_id,video_id,date")
            .execute()
        )


def run_pipeline(supabase, yt_api_key, artists):
    """
    Returns the artists that failed, as {"artist": name, "reason": text} dicts.

    A list rather than a count so the caller can name the artists that need
    fixing. len() still gives the count for the exit-code rule.
    """
    today = date.today()
    artist_append_failures = []

    for artist in artists:
        # The Supabase lookup sits inside the try as well, so one lookup failure
        # costs a single artist instead of ending the whole run.
        try:
            response = (
                supabase.table("artists")
                .select("id, youtube_handle, youtube_channel_id")
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

            process_artist(supabase, yt_api_key, rows[0], today)
        # 403 means bad key. 429 means quota gone.
        # Must come first. It subclasses RequestException.
        #Server rejected request
        except HTTPError as e:
            reason = f"HTTP error: {describe_request_error(e)}"
            print(f"HTTP error occured for {artist}: {describe_request_error(e)}")
            artist_append_failures.append({"artist": artist, "reason": reason})
        # Timeout, ConnectionError, JSONDecodeError.
        # These carry the URL too.
        except RequestException as e:
            reason = f"request failed: {describe_request_error(e)}"
            print(f"Request failed for {artist}: {describe_request_error(e)}")
            artist_append_failures.append({"artist": artist, "reason": reason})
        # Everything else. Supabase errors land here. No key in those.
        except Exception as e:
            reason = f"{type(e).__name__}: {e}"
            print(f"Non-HTTP error occured for {artist}: {reason}")
            artist_append_failures.append({"artist": artist, "reason": reason})

    return artist_append_failures


def main():
    run_pipeline(supabase, yt_api_key, artists)

if __name__ == "__main__":
    main()

from asyncio import Handle
import supabase 
import requests
import sys 
from pipelines.pipeline import artists 
from datetime import date 
from backend.app.config import yt_api_key, supabase_url, supabase_secret_key
from backend.app.supabase_client import supabase


#have the http errors in both of the functions where HTTP responses are actually created 

session = requests.Session()

class HandleNotFoundError(Exception):
    pass 

def describe_request_error(exc):
    response = getattr(exc, "response", None)
    if response is not None:
        return f"HTTP {response.status_code}"
    return type(exc).__name__

def fetch_channel_stats(api_key, channel_id=None, handle=None):
    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {"part": "statistics,snippet,contentDetails", "key": api_key}
    if channel_id:
        params["id"] = channel_id
    elif handle:
        params["forHandle"] = f"@{handle}"
    else:
        raise ValueError("one of channel_id or handle is required")

    response = session.get(url, params=params)
    # Surface quota/auth failures as HTTP errors instead of a misleading "not found"
    response.raise_for_status()
    data = response.json()

    if "items" not in data or len(data["items"]) == 0:
        raise HandleNotFoundError

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

    response = session.get(url, params=params)
    response.raise_for_status()
    data = response.json()

    if "items" not in data or len(data["items"]) == 0:
        return []

    video_ids = []
    for item in data["items"]:
        video_ids.append(item["contentDetails"]["videoId"])

    return video_ids

def run_pipeline(supabase, yt_api_key, artists):
    artist_handle = None 
    for artist in artists:
        try:

            try:
                #try-except block for fetch_channel_stats 
                pass 

            except:
                
                pass 

            try: 
                #try-except block for recent uploads data 
                pass 

            except:
                pass 
            

        

        except HandleNotFoundError as error:
            print(f"no youtube channel found for handle: {artist_handle}")
            failures += 1 

    



def main():
    yt_failures = run_pipeline(supabase, yt_api_key, artists)

    print(f"\nYouTube: {len(artists) - yt_failures}/{len(artists)} artists recorded, "  # pyright: ignore[reportOperatorIssue]
          f"{yt_failures} failed") 

if __name__ == "__main__":
    main()
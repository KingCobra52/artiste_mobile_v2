from asyncio import Handle
from multiprocessing import Value
from typing import Any
import supabase 
import requests
import sys 
from pipelines.pipeline import artists 
from datetime import date 
from backend.app.config import yt_api_key, supabase_url, supabase_secret_key
from backend.app.supabase_client import supabase
from collections import defaultdict


#have the http errors in both of the functions where HTTP responses are actually created 

session = requests.Session()

def describe_request_error(exc):
    response = getattr(exc, "response", None)
    if response is not None:
        return f"HTTP {response.status_code}"
    return type(exc).__name__

def fetch_channel_information(api_key, channel_id=None, handle=None):
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

def recent_videos_stats(videos_playlist_id, api_key):
    #this function needs to get the view Counts and like Counts for len(videoIds)

    video_ids = recent_uploads_data(videos_playlist_id, api_key)

    url = "https://www.googleapis.com/youtube/v3/videos"

    video_counts = defaultdict(list)

    for i in range(len(video_ids)):
        video_id = video_ids[i]

        params = {
        "part": "statistics",
        "id": f"{video_id}",
        "key": api_key 
        }

        response = session.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        items = data.get("items", [])
        if not items:
            raise ValueError(f"No Video data found for ID: {video_id}")
        video_stats = items[0]["statistics"]
        video_views = video_stats.get("viewCount", 0)
        video_likes = video_stats.get("likeCount", 0)
        video_comments = video_stats.get("commentCount", 0)
        video_counts[video_id] = [video_views, video_likes, video_comments]  

    return video_counts        


def run_pipeline(supabase, yt_api_key, artists):
    failures = 0
    today = date.today()
    for artist in artists:
        response = supabase.table("artists").select("id, youtube_handle, youtube_channel_id").eq("artist", f"{artist}").execute()
        rows = response.data 
        artist_id = rows[0]["id"]
        youtube_handle = rows[0]["youtube_handle"]
        youtube_channel_id = rows[0]["youtube_channel_id"]

        try:
            channel_information = fetch_channel_information(yt_api_key, youtube_channel_id, youtube_handle)
            subscribers = channel_information["subscriber_count"]
            total_views = channel_information["view_count"]
            videos_playlist_id = channel_information["videos_playlist"]

            #insert artist_id, subscribers, total_views into youtube_snapshots 
            response = (
                supabase.table("youtube_snapshots")
                .insert({
                    "artist_id": f"{artist_id}",
                    "subscribers": f"{subscribers}",
                    "total_views": f"{total_views}"
                })
                .execute()
            )
            print(response.data)

            try: 
                #try-except block for recent uploads data 
                video_counts = recent_videos_stats(videos_playlist_id, yt_api_key) 
                for video_id, video_stats in video_counts.items():
                    response = (
                        supabase.table("recent_youtube_video_snapshots")
                        .insert({
                            "artist_id": f"{artist_id}",
                            "video_id": f"{video_id}",
                            "view_count": f"{video_stats[0]}",
                            "like_count": f"{video_stats[1]}",
                            "comment_count": f"{video_stats[2]}",
                            "date": f"{today}",
                        })
                        .execute())
                    print(response.data)


            except requests.exceptions.HTTPError as e:
                print(f"HTTP Error occured during recent_videos_stats(): {e}")

            except Exception as e:
                print(f"Non-HTTP Error occured during recent_videos_stats(): {e}")

        except requests.exceptions.HTTPError as e:
            print(f"HTTP Error occured during fetch_channel_information(): {e}")
        
        except Exception as e:
             print(f"Non-HTTP Error occured during fetch_channel_information(): {e}")
            

    



def main():
    yt_failures = run_pipeline(supabase, yt_api_key, artists)

    print(f"\nYouTube: {len(artists) - yt_failures}/{len(artists)} artists recorded, "  # pyright: ignore[reportOperatorIssue]
          f"{yt_failures} failed") 

if __name__ == "__main__":
    main()
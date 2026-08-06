import supabase 
import requests 
import os
import sys 
from datetime import date 
from backend.app.config import database_url, supabase_url, supabase_secret_key, lastfm_api_key, yt_api_key


artists = [
        "Drake", "Travis Scott", "Future", "Kendrick Lamar", "J. Cole", "Lil Baby",
        "Playboi Carti", "Don Toliver", "GloRilla", "Central Cee", "Ice Spice",
        "Rod Wave", "21 Savage", "Gunna", "Sexyy Red",
        "JID", "Denzel Curry", "EsDeeKid", "fakemink", "Zeddy Will",
        "Kai Ca$h", "JELEEL!", "Kae", "Baby Keem"
    ]

today = date.today()



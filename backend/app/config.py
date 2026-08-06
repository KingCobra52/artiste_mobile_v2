import os 
from dotenv import load_dotenv
load_dotenv()

#load enviornment variables as necessary 

database_url = str(os.getenv("DATABASE_URL"))
supabase_url = str(os.getenv("SUPABASE_URL"))
supabase_secret_key = str(os.getenv("SUPABASE_SECRET_KEY"))
lastfm_api_key = os.getenv("LASTFM_API_KEY")
yt_api_key = os.getenv("YOUTUBE_API_KEY")


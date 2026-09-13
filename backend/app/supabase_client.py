from backend.app.config import supabase_secret_key, supabase_url
from supabase import Client, create_client

supabase: Client = create_client(supabase_url, supabase_secret_key)

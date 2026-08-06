from supabase import create_client, Client 
from config import supabase_url, supabase_secret_key

supabase: Client = create_client(supabase_url, supabase_secret_key)
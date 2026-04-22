import os
import threading
import time
import uuid
import sys
import gc
import requests
from flask import Flask, request, send_file, jsonify, make_response
from flask_cors import CORS
import yt_dlp
from supabase import create_client, Client

# Log a message when the script starts
print("[WORKER STARTUP] Python worker script is initializing...")
sys.stdout.flush()

app = Flask(__name__)
CORS(app)

# Supabase Config
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# Concurrency Control
download_semaphore = threading.BoundedSemaphore(value=1)
DOWNLOAD_DIR = "/tmp/downloads"
COOKIE_PATH = "/tmp/cookies.txt"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def log(message):
    # Use a consistent prefix for all worker logs
    print(f"[AUDIO-WORKER] {message}", flush=True)

def download_cookies_from_supabase():
    """Fetches the latest cookies.txt from Supabase Storage to handle auth blocks."""
    try:
        log("Checking Supabase 'cookies' bucket for fresh auth file...")
        res = supabase.storage.from_("cookies").download("cookies.txt")
        if res:
            # Always overwrite to ensure we don't use stale local files
            with open(COOKIE_PATH, "wb") as f:
                f.write(res)
            log("SUCCESS: cookies.txt synchronized from Cloud Vault.")
            return True
    except Exception as e:
        log(f"Vault Sync Note: No cookies.txt found or accessible ({e}). Proceeding with PO_TOKEN only.")
    return False

def process_queued_song(song):
    song_id = song.get('id')
    video_url = song.get('youtube_url')
    user_id = song.get('user_id')
    title = song.get('title', 'Unknown Title')

    # Get credentials from Render Environment Variables
    po_token = os.environ.get("YOUTUBE_PO_TOKEN")
    visitor_data = os.environ.get("YOUTUBE_VISITOR_DATA")

    with download_semaphore:
        try:
            log(f">>> STARTING PROCESSING: {title} (ID: {song_id})")
            
            # Force a fresh cookie sync before every download attempt
            download_cookies_from_supabase()

            log(f"Updating DB status to PROCESSING for {title}")
            supabase.table("repertoire").update({
                "extraction_status": "processing", 
                "last_sync_log": "Starting high-fidelity audio extraction..."
            }).eq("id", song_id).execute()

            file_id = str(uuid.uuid4())
            output_template = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")
            
            ydl_opts = {
                'format': 'wa',
                'noplaylist': True,
                'outtmpl': output_template,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '128',
                }],
                # --- CRITICAL AUTH SETTINGS ---
                'cookiefile': COOKIE_PATH if os.path.exists(COOKIE_PATH) else None,
                'po_token': f"web+none:{po_token}" if po_token else None,
                'headers': {
                    'X-Goog-Visitor-Id': visitor_data,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                } if visitor_data else {},
                # ------------------------------
                'nocheckcertificate': True,
                'quiet': True,
                'no_warnings': False, # Show warnings to help debug
            }

            log(f"Downloading audio for '{title}' from {video_url}...")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])
            
            mp3_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.mp3")
            
            if os.path.exists(mp3_path):
                log(f"Download successful. Starting upload to Supabase Storage for {title}.")
                storage_path = f"{user_id}/{song_id}/{int(time.time())}.mp3"
                
                with open(mp3_path, 'rb') as f:
                    supabase.storage.from_("public_audio").upload(storage_path, f.read(), {'content-type': 'audio/mpeg'})
                
                public_url = supabase.storage.from_("public_audio").get_public_url(storage_path)
                
                log(f"Upload complete. Updating Supabase record for '{title}'")
                supabase.table("repertoire").update({
                    "audio_url": public_url,
                    "preview_url": public_url,
                    "extraction_status": "completed",
                    "extraction_error": None,
                    "last_extracted_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                    "last_sync_log": "Master audio linked successfully."
                }).eq("id", song_id).execute()
                
                log(f"SUCCESS: Finished processing '{title}'")
                os.remove(mp3_path)
            else:
                raise Exception("Post-processing failed: MP3 conversion yielded no output. This usually means YouTube blocked the download.")
            
        except Exception as e:
            error_msg = str(e)
            log(f"FAILED: '{title}' | Error: {error_msg}")
            
            # Provide helpful feedback in the DB log
            friendly_error = "YouTube blocked the request (429). Please update PO_TOKEN and Cookies." if "429" in error_msg else f"Worker Error: {error_msg[:100]}"
            
            try:
                supabase.table("repertoire").update({
                    "extraction_status": "failed",
                    "extraction_error": error_msg[:250],
                    "last_sync_log": friendly_error
                }).eq("id", song_id).execute()
            except Exception as db_e:
                log(f"Status update failed: {db_e}")
        finally:
            gc.collect()


def job_poller():
    """Checks the DB for new work every 20 seconds."""
    log("Job Poller initialized. Starting initial cookie sync.")
    download_cookies_from_supabase()
    
    while True:
        try:
            res = supabase.table("repertoire")\
                .select("id, youtube_url, user_id, title")\
                .eq("extraction_status", "queued")\
                .order('created_at', ascending=True)\
                .limit(1)\
                .execute()
            
            if res.data and len(res.data) > 0:
                song_data = res.data[0]
                log(f"Found queued job: {song_data.get('title')}. Starting processing.")
                process_queued_song(song_data)
            else:
                time.sleep(20)
        except Exception as e:
            log(f"Poller Error: {e}")
            time.sleep(30)

# Start the poller in the background
threading.Thread(target=job_poller, daemon=True).start()

@app.route('/')
def health():
    return "Worker is alive and polling Supabase...", 200

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))
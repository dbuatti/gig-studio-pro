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
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def log(message):
    # Added flush=True directly to the print function
    print(f"[WORKER LOG] {message}", flush=True)

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
            supabase.table("repertoire").update({"extraction_status": "PROCESSING", "last_sync_log": "Starting audio extraction..."}).eq("id", song_id).execute()

            file_id = str(uuid.uuid4())
            output_template = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")
            
            # Look for cookies file
            cookie_path = './cookies.txt' if os.path.exists('./cookies.txt') else None

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
                'cookiefile': cookie_path,
                'po_token': f"web+none:{po_token}" if po_token else None,
                'headers': {'X-Goog-Visitor-Id': visitor_data} if visitor_data else {},
                # ------------------------------
                'nocheckcertificate': True,
                'quiet': True,
                'no_warnings': True,
                'logger': log # Direct yt_dlp logs to our function
            }

            log(f"Downloading audio for '{title}' from YouTube URL: {video_url}")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])
            
            mp3_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.mp3")
            
            if os.path.exists(mp3_path):
                log(f"Upload complete. Updating Supabase record for '{title}' with public URL: {public_url}")
                public_url = supabase.storage.from_("public_audio").get_public_url(storage_path)
                
                log(f"Upload complete. Updating Supabase record for '{title}' with public URL: {public_url}")
                supabase.table("repertoire").update({
                    "audio_url": public_url,
                    "preview_url": public_url, # ADDED THIS LINE
                    "extraction_status": "COMPLETED",
                    "extraction_error": None,
                    "last_extracted_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                    "last_sync_log": "Audio extraction and upload completed successfully."
                }).eq("id", song_id).execute()
                
                log(f"SUCCESS: Finished processing '{title}' (ID: {song_id})")
                os.remove(mp3_path)
            else:
                raise Exception("MP3 conversion failed: Expected file not found after yt_dlp.")
            
        except Exception as e:
            error_msg = str(e)
            log(f"FAILED PROCESSING: '{title}' (ID: {song_id}) | Error: {error_msg}")
            # Use a simpler update in case columns are still jittery
            try:
                supabase.table("repertoire").update({
                    "extraction_status": "FAILED",
                    "extraction_error": error_msg[:200], # Truncate long errors
                    "last_sync_log": f"Extraction failed: {error_msg[:100]}" # Add to last_sync_log
                }).eq("id", song_id).execute()
            except Exception as db_update_e:
                log(f"Could not update failure status in Supabase: {db_update_e}")
        finally:
            gc.collect()
            log(f"<<< FINISHED PROCESSING: {title} (ID: {song_id})")


def job_poller():
    """Checks the DB for new work every 20 seconds."""
    log("Job Poller initialized. Starting to check for queued jobs...")
    while True:
        try:
            # HEARTBEAT LOG: This proves the worker is checking the DB
            log("Poller: Checking Supabase for 'queued' jobs...") 
            
            res = supabase.table("repertoire")\
                .select("id, youtube_url, user_id, title")\
                .eq("extraction_status", "queued")\
                .order('created_at', ascending=True)\
                .limit(1)\
                .execute()
            
            if res.data and len(res.data) > 0:
                log(f"Poller: Found a new job for '{res.data[0].get('title')}' (ID: {res.data[0].get('id')}). Spawning thread...")
                # Call the new process_queued_song function
                song_data = res.data[0]
                threading.Thread(target=lambda: process_queued_song(song_data)).start()
            else:
                log("Poller: No 'queued' jobs found. Waiting...")
                time.sleep(20)
        except Exception as e:
            log(f"Poller Critical Error: {e}")
            time.sleep(30)

# Start the poller in the background
threading.Thread(target=job_poller, daemon=True).start()

@app.route('/')
def health():
    return "Worker is alive and polling...", 200

# The /download endpoint is no longer used for initiating downloads,
# but we keep it for direct file access if needed (e.g., for testing or specific client flows)
@app.route('/download')
def get_file():
    # This endpoint's logic is simplified as the main worker handles uploads directly
    # It's primarily for direct file serving if the client requests it,
    # but the new flow will use public Supabase URLs.
    return jsonify({"message": "This endpoint is deprecated for new extraction flows. Use Supabase Storage public URLs."}), 404

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))
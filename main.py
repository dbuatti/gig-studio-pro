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
    print(f"[WORKER LOG] {message}")
    sys.stdout.flush()

def process_song_task(song_id, video_url, user_id):
    """The core logic that handles the heavy lifting."""
    log(f"[TASK {song_id}] Starting Extraction for video: {video_url}")
    try:
        # 1. Mark as Processing
        supabase.table("repertoire").update({"extraction_status": "PROCESSING", "last_sync_log": "Starting audio extraction..."}).eq("id", song_id).execute()
        log(f"[TASK {song_id}] Supabase Status Updated: PROCESSING")

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
            'nocheckcertificate': True,
            'quiet': True,
            'logger': log # Direct yt_dlp logs to our function
        }

        # 2. Download from YouTube
        log(f"[TASK {song_id}] Initiating yt_dlp download.")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            duration = info.get('duration', 0)
        log(f"[TASK {song_id}] yt_dlp download completed. Duration: {duration}s")
        
        mp3_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.mp3")
        
        if os.path.exists(mp3_path):
            log(f"[TASK {song_id}] MP3 file created: {mp3_path}")
            # 3. Upload to Supabase Storage
            storage_path = f"{user_id}/{song_id}/{int(time.time())}.mp3"
            log(f"[TASK {song_id}] Starting upload to Supabase Storage: {storage_path}")
            with open(mp3_path, 'rb') as f:
                res = supabase.storage.from_("public_audio").upload(storage_path, f, {"content-type": "audio/mpeg"})
                if res.status_code != 200:
                    raise Exception(f"Supabase Storage Upload Error: {res.text}")
            log(f"[TASK {song_id}] Supabase Storage upload successful.")
            
            public_url = supabase.storage.from_("public_audio").get_public_url(storage_path)

            # 4. Update Database
            supabase.table("repertoire").update({
                "preview_url": public_url,
                "duration_seconds": int(duration),
                "extraction_status": "COMPLETED",
                "last_extracted_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                "last_sync_log": "Audio extraction and upload completed successfully."
            }).eq("id", song_id).execute()
            
            log(f"[TASK {song_id}] SUCCESS: Audio extraction and upload complete. Public URL: {public_url}")
            os.remove(mp3_path)
            log(f"[TASK {song_id}] Cleaned up local file: {mp3_path}")
        else:
            raise Exception("MP3 conversion failed: Expected file not found after yt_dlp.")
        
    except Exception as e:
        error_msg = str(e)
        log(f"[TASK {song_id}] ERROR during download/upload: {error_msg}")
        supabase.table("repertoire").update({
            "extraction_status": "FAILED",
            "last_sync_log": f"Extraction failed: {error_msg}"
        }).eq("id", song_id).execute()
        log(f"[TASK {song_id}] Supabase Status Updated: FAILED")
    finally:
        gc.collect() # Force garbage collection to free memory

def job_poller():
    """Checks the DB for new work every 30 seconds."""
    log("Poller Thread Started. Looking for 'queued' jobs...")
    while True:
        try:
            # Look for one song that is 'queued'
            # Use .limit(1) and .order('created_at', ascending=True) to process oldest first
            res = supabase.table("repertoire").select("id, youtube_url, user_id").eq("extraction_status", "queued").order('created_at', ascending=True).limit(1).execute()
            
            if res.data and len(res.data) > 0:
                song = res.data[0]
                log(f"[POLLER] Found queued job for song ID: {song['id']}")
                # Process the job in a new thread to not block the poller, but respect semaphore
                threading.Thread(target=lambda: process_song_task(song['id'], song['youtube_url'], song['user_id'])).start()
            else:
                # No work to do, sleep
                time.sleep(30)
        except Exception as e:
            log(f"[POLLER ERROR] Poller encountered error: {e}")
            time.sleep(30) # Still sleep on error to prevent busy-looping

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
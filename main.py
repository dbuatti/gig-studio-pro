import secrets
import os
import threading
import time
import yt_dlp
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from uuid import uuid4
from pathlib import Path
from datetime import datetime, timedelta
from supabase import create_client, Client

app = Flask(__name__)
# Enable CORS for all routes and methods
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Configuration ---
# Use /tmp/ for storage as it is guaranteed writable on Render/Docker
ABS_DOWNLOADS_PATH = Path('/tmp/downloads')
ABS_DOWNLOADS_PATH.mkdir(parents=True, exist_ok=True)
COOKIES_PATH = '/tmp/cookies.txt'
TOKEN_LENGTH = 32

token_store = {}
last_sync_time = None

# Supabase Setup with Trailing Slash Fix
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
if SUPABASE_URL and not SUPABASE_URL.endswith('/'):
    SUPABASE_URL += '/'

SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
COOKIES_BUCKET = 'cookies'

supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"❌ Supabase Init Error: {e}")

# --- Utility Functions ---

def fetch_cookies():
    """Syncs cookies from Supabase to local container."""
    global last_sync_time
    if not supabase: 
        print("❌ Sync Aborted: Supabase client not initialized")
        return False
    try:
        print(f"🔄 Syncing cookies from bucket: {COOKIES_BUCKET}")
        # Explicitly try to download the file
        data = supabase.storage.from_(COOKIES_BUCKET).download('cookies.txt')
        
        if not data:
            print("⚠️ Vault Error: 'cookies.txt' returned no data")
            return False
            
        with open(COOKIES_PATH, 'wb') as f:
            f.write(data)
        
        last_sync_time = datetime.now().isoformat()
        print(f"✅ Cookies synced: {len(data)} bytes at {last_sync_time}")
        return True
    except Exception as e:
        print(f"❌ Cookie Sync Failed: {e}")
        return False

def background_worker():
    """Cleanup and periodic sync."""
    while True:
        now = time.time()
        try:
            for f in ABS_DOWNLOADS_PATH.glob("*.mp3"):
                if f.stat().st_mtime < now - 1800:
                    f.unlink()
                    keys_to_del = [k for k, v in token_store.items() if v == f.name]
                    for k in keys_to_del: del token_store[k]
        except: pass
        
        # Hourly auto-refresh
        fetch_cookies()
        time.sleep(3600)

# Start background worker
threading.Thread(target=background_worker, daemon=True).start()

# --- Routes ---

@app.route("/", methods=["GET"])
def handle_audio_request():
    video_url = request.args.get("url")
    if not video_url:
        return jsonify(error="Missing URL"), 400

    # Safety check: if file doesn't exist, try one last fetch before failing
    if not os.path.exists(COOKIES_PATH) or os.path.getsize(COOKIES_PATH) < 10:
        fetch_cookies()

    unique_id = str(uuid4())
    output_filename = f"{unique_id}.mp3"
    output_template = str(ABS_DOWNLOADS_PATH / unique_id)

    ydl_opts = {
        'format': 'ba/b', 
        'outtmpl': f"{output_template}.%(ext)s",
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'cookiefile': COOKIES_PATH if (os.path.exists(COOKIES_PATH) and os.path.getsize(COOKIES_PATH) > 10) else None,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'quiet': False,
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'noplaylist': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['tv', 'web'],
                'player_skip': ['configs', 'webpage']
            }
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"🚀 Extraction Start: {video_url}")
            ydl.download([video_url])
        
        actual_file = ABS_DOWNLOADS_PATH / output_filename
        if not actual_file.exists():
            return jsonify(error="Processing Error", detail="Engine failed to finalize MP3"), 500

        token = secrets.token_urlsafe(TOKEN_LENGTH)
        token_store[token] = output_filename
        
        return jsonify(token=token, download_url=f"{request.host_url}download?token={token}")

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Extraction Failed: {error_msg}")
        return jsonify(error="Engine Error", detail=error_msg), 500

@app.route("/download", methods=["GET"])
def download_file():
    token = request.args.get("token")
    filename = token_store.get(token)
    if not filename: return jsonify(error="Unauthorized"), 401
    return send_from_directory(str(ABS_DOWNLOADS_PATH), filename, as_attachment=True)

@app.route("/health", methods=["GET"])
def health():
    cookie_size = 0
    if os.path.exists(COOKIES_PATH):
        cookie_size = os.path.getsize(COOKIES_PATH)
        
    return jsonify(
        status="online", 
        cookies_loaded=(cookie_size > 10),
        server_cookie_bytes=cookie_size,
        last_sync=last_sync_time,
        timestamp=datetime.now().isoformat()
    )

# Force GET/POST compatibility for the sync route
@app.route("/refresh-cookies", methods=["POST", "GET"])
def manual_refresh():
    success = fetch_cookies()
    return jsonify(success=success, time=last_sync_time)

if __name__ == "__main__":
    # Initial startup sync
    fetch_cookies()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
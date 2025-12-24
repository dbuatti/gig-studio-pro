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
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Configuration ---
ABS_DOWNLOADS_PATH = Path('/tmp/downloads')
ABS_DOWNLOADS_PATH.mkdir(parents=True, exist_ok=True)
COOKIES_PATH = '/tmp/cookies.txt'
TOKEN_LENGTH = 32

token_store = {}
last_sync_time = None

# Supabase Setup
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
    if not supabase: return False
    try:
        data = supabase.storage.from_(COOKIES_BUCKET).download('cookies.txt')
        if not data: return False
        with open(COOKIES_PATH, 'wb') as f:
            f.write(data)
        last_sync_time = datetime.now().isoformat()
        return True
    except Exception as e:
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
        fetch_cookies()
        time.sleep(3600)

threading.Thread(target=background_worker, daemon=True).start()

# --- Routes ---

@app.route("/", methods=["GET"])
def handle_audio_request():
    video_url = request.args.get("url")
    if not video_url:
        return jsonify(error="Missing URL"), 400

    if not os.path.exists(COOKIES_PATH) or os.path.getsize(COOKIES_PATH) < 10:
        fetch_cookies()

    unique_id = str(uuid4())
    output_filename = f"{unique_id}.mp3"
    output_template = str(ABS_DOWNLOADS_PATH / unique_id)

    # REFINED Strategy for restricted VEVO/Major Label tracks
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f"{output_template}.%(ext)s",
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'cookiefile': COOKIES_PATH if (os.path.exists(COOKIES_PATH) and os.path.getsize(COOKIES_PATH) > 10) else None,
        # Forcing IPv4 to bypass cloud-IP range blocks
        'source_address': '0.0.0.0', 
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'referer': 'https://www.youtube.com/',
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'noplaylist': True,
        'extract_flat': False,
        'allow_unplayable_formats': True,
        'youtube_include_dash_manifest': True,
        'youtube_include_hls_manifest': True,
        'extractor_args': {
            'youtube': {
                # Focusing on web-based clients that respect the cookies uploaded
                'player_client': ['web', 'mweb'],
                'player_skip': ['configs', 'web_extract_initial_data']
            }
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        
        actual_file = ABS_DOWNLOADS_PATH / output_filename
        if not actual_file.exists():
            potential_files = list(ABS_DOWNLOADS_PATH.glob(f"{unique_id}.*"))
            if not potential_files:
                return jsonify(error="Extraction Blocked", detail="YouTube is currently hiding audio streams for this track. Your cookies may be invalid."), 500
            actual_file = potential_files[0]

        token = secrets.token_urlsafe(TOKEN_LENGTH)
        token_store[token] = actual_file.name
        return jsonify(token=token, download_url=f"{request.host_url}download?token={token}")

    except Exception as e:
        error_msg = str(e)
        user_error = "Engine Error"
        
        if "format is not available" in error_msg.lower():
            user_error = "Format Request Denied. YouTube has restricted this specific track from server-side access."
        elif "Sign in to confirm" in error_msg or "403" in error_msg:
            user_error = "Bot detection triggered. Fresh cookies are required via Incognito Protocol."
            
        return jsonify(error=user_error, detail=error_msg), 500

@app.route("/download", methods=["GET"])
def download_file():
    token = request.args.get("token")
    filename = token_store.get(token)
    if not filename: return jsonify(error="Unauthorized"), 401
    return send_from_directory(str(ABS_DOWNLOADS_PATH), filename, as_attachment=True)

@app.route("/health", methods=["GET"])
def health():
    size = os.path.getsize(COOKIES_PATH) if os.path.exists(COOKIES_PATH) else 0
    return jsonify(status="online", cookies_loaded=(size > 10), bytes=size, last_sync=last_sync_time)

@app.route("/refresh-cookies", methods=["POST", "GET"])
def manual_refresh():
    success = fetch_cookies()
    return jsonify(success=success, time=last_sync_time)

if __name__ == "__main__":
    fetch_cookies()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
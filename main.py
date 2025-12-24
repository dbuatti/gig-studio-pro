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
ABS_DOWNLOADS_PATH = Path(os.environ.get('DOWNLOADS_PATH', '/app/downloads'))
ABS_DOWNLOADS_PATH.mkdir(parents=True, exist_ok=True)
COOKIES_PATH = '/app/cookies.txt'
TOKEN_LENGTH = 32

token_store = {}

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
COOKIES_BUCKET = 'cookies'

supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# --- Utility Functions ---

def fetch_cookies():
    """Syncs cookies from Supabase to local container."""
    if not supabase: return False
    try:
        data = supabase.storage.from_(COOKIES_BUCKET).download('cookies.txt')
        if not data: return False
            
        with open(COOKIES_PATH, 'wb') as f:
            f.write(data)
        print(f"✅ Cookies synced: {len(data)} bytes")
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

    # Ultra-resilient yt-dlp Options
    ydl_opts = {
        # 'ba/b' tells it to get Best Audio, or if that fails, get Best (video+audio) 
        # and we let the postprocessor handle the audio extraction.
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
        'no_warnings': False,
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'noplaylist': True,
        'extractor_args': {
            'youtube': {
                # We specifically use 'web' here because your cookies were exported from a browser.
                'player_client': ['web'],
                'player_skip': ['configs', 'webpage']
            }
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"🚀 Attempting extraction: {video_url}")
            ydl.download([video_url])
        
        actual_file = ABS_DOWNLOADS_PATH / output_filename
        if not actual_file.exists():
            return jsonify(error="Processing Error", detail="Engine failed to find final converted file"), 500

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
        timestamp=datetime.now().isoformat()
    )

@app.route("/refresh-cookies", methods=["POST", "GET"])
def manual_refresh():
    success = fetch_cookies()
    return jsonify(success=success)

if __name__ == "__main__":
    fetch_cookies()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
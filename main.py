import secrets
import os
import threading
import time
import yt_dlp
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from uuid import uuid4
from pathlib import Path
from datetime import datetime
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
last_error = None

# Supabase Setup
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
COOKIES_BUCKET = 'cookies'

supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        # Ensure URL doesn't have double slashes if provided with trailing
        clean_url = SUPABASE_URL.rstrip('/')
        supabase = create_client(clean_url, SUPABASE_SERVICE_KEY)
        print(f"✅ Supabase Client Initialized: {clean_url}")
    except Exception as e:
        print(f"❌ Supabase Init Error: {e}")
        last_error = f"Client Init Error: {str(e)}"

def fetch_cookies():
    """Syncs cookies from Supabase to local container."""
    global last_sync_time, last_error
    if not supabase: 
        last_error = "Supabase client not initialized. Check ENV variables."
        return 0
    
    try:
        print(f"🔄 Attempting to download cookies from bucket: {COOKIES_BUCKET}")
        data = supabase.storage.from_(COOKIES_BUCKET).download('cookies.txt')
        
        if not data:
            last_error = "Download returned empty data from Supabase."
            return 0
            
        with open(COOKIES_PATH, 'wb') as f:
            f.write(data)
            
        last_sync_time = datetime.now().isoformat()
        last_error = None
        size = len(data)
        print(f"✅ Cookies synced successfully: {size} bytes")
        return size
    except Exception as e:
        last_error = f"Sync Error: {str(e)}"
        print(f"❌ Cookie Sync Error: {e}")
        return 0

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

@app.route("/", methods=["GET"])
def handle_audio_request():
    video_url = request.args.get("url")
    if not video_url:
        return jsonify(error="Missing URL"), 400

    if not os.path.exists(COOKIES_PATH) or os.path.getsize(COOKIES_PATH) < 10:
        fetch_cookies()

    print(f"🚀 Processing: {video_url}")
    unique_id = str(uuid4())
    output_filename = f"{unique_id}.mp3"
    output_template = str(ABS_DOWNLOADS_PATH / unique_id)

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f"{output_template}.%(ext)s",
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'cookiefile': COOKIES_PATH if (os.path.exists(COOKIES_PATH) and os.path.getsize(COOKIES_PATH) > 10) else None,
        'user_agent': 'com.google.ios.youtube/19.12.3 (iPhone16,2; U; CPU iOS 17_4_1 like Mac OS X; US; en_US)',
        'referer': 'https://www.youtube.com/',
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'noplaylist': True,
        'extract_flat': False,
        'allow_unplayable_formats': True,
        'cachedir': False,
        'extractor_args': {
            'youtube': {
                'player_client': ['tv', 'ios', 'android'],
                'player_skip': ['web', 'mweb']
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
                return jsonify(error="Extraction Failed", detail="YouTube is currently hiding audio streams for this track."), 500
            actual_file = potential_files[0]

        token = secrets.token_urlsafe(TOKEN_LENGTH)
        token_store[token] = actual_file.name
        return jsonify(token=token, download_url=f"{request.host_url}download?token={token}")

    except Exception as e:
        error_msg = str(e)
        user_error = "Engine Error"
        if "Sign in to confirm" in error_msg or "403" in error_msg:
            user_error = "Bot detection triggered. Session cookies may be invalid."
        print(f"❌ Extraction Failed: {error_msg}")
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
    return jsonify({
        "status": "online", 
        "cookies_loaded": (size > 10), 
        "bytes": size, 
        "last_sync": last_sync_time,
        "last_error": last_error,
        "supabase_initialized": supabase is not None
    })

@app.route("/refresh-cookies", methods=["POST", "GET"])
def manual_refresh():
    size = fetch_cookies()
    return jsonify({
        "success": size > 0, 
        "bytes": size, 
        "time": last_sync_time, 
        "error": last_error
    })

if __name__ == "__main__":
    fetch_cookies()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
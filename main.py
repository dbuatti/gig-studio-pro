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
ABS_DOWNLOADS_PATH = Path(os.environ.get('DOWNLOADS_PATH', '/app/downloads'))
ABS_DOWNLOADS_PATH.mkdir(parents=True, exist_ok=True)
COOKIES_PATH = '/app/cookies.txt'
TOKEN_LENGTH = 32

# In-memory mapping of tokens to filenames
token_store = {}

# Supabase Configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
COOKIES_BUCKET = 'cookies'

supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    print("⚠️ Supabase credentials missing. Extraction may be limited.")

# --- Utility Functions ---

def fetch_cookies():
    """Syncs cookies from Supabase to local container."""
    if not supabase: 
        print("❌ Supabase client not initialized")
        return False
    try:
        print(f"🔄 Syncing cookies from bucket: {COOKIES_BUCKET}")
        data = supabase.storage.from_(COOKIES_BUCKET).download('cookies.txt')
        if not data:
            print("⚠️ No data returned for cookies.txt")
            return False
            
        with open(COOKIES_PATH, 'wb') as f:
            f.write(data)
        print(f"✅ Cookies refreshed successfully: {len(data)} bytes")
        return True
    except Exception as e:
        print(f"❌ Cookie Sync Failed: {e}")
        return False

def background_worker():
    """Handles hourly cookie refresh and cleans up old mp3 files."""
    while True:
        # Run cleanup every iteration
        now = time.time()
        try:
            for f in ABS_DOWNLOADS_PATH.glob("*.mp3"):
                if f.stat().st_mtime < now - 1800:
                    f.unlink()
                    keys_to_del = [k for k, v in token_store.items() if v == f.name]
                    for k in keys_to_del: del token_store[k]
        except Exception as e:
            print(f"❌ Cleanup Error: {e}")
        
        # Periodic refresh
        fetch_cookies()
        time.sleep(3600)

threading.Thread(target=background_worker, daemon=True).start()

# --- Routes ---

@app.route("/", methods=["GET"])
def handle_audio_request():
    video_url = request.args.get("url")
    if not video_url:
        return jsonify(error="Missing URL"), 400

    # Ensure cookies exist before attempt
    if not os.path.exists(COOKIES_PATH) or os.path.getsize(COOKIES_PATH) < 10:
        print("🔍 Cookies missing from local disk. Attempting fetch...")
        fetch_cookies()

    unique_id = str(uuid4())
    output_filename = f"{unique_id}.mp3"
    output_template = str(ABS_DOWNLOADS_PATH / unique_id)

    # yt-dlp Options - Optimized for Server IPs
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f"{output_template}.%(ext)s",
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        # High-resilience spoofing
        'cookiefile': COOKIES_PATH if (os.path.exists(COOKIES_PATH) and os.path.getsize(COOKIES_PATH) > 10) else None,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'referer': 'https://www.youtube.com/',
        'quiet': False,
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'noplaylist': True,
        'geo_bypass': True,
        'extractor_args': {
            'youtube': {
                # 'web' is most compatible with standard browser cookie exports
                'player_client': ['web', 'mweb'],
                'player_skip': ['configs', 'webpage'],
                'skip': ['dash', 'hls']
            }
        },
        # Add a custom header to bypass some basic bot checks
        'http_headers': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
            'Sec-Fetch-Mode': 'navigate',
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"🚀 Starting extraction for: {video_url}")
            ydl.download([video_url])
        
        actual_file = ABS_DOWNLOADS_PATH / output_filename
        if not actual_file.exists():
            return jsonify(error="Processing Error", detail="Extraction failed to create file"), 500

        token = secrets.token_urlsafe(TOKEN_LENGTH)
        token_store[token] = output_filename
        
        return jsonify(token=token, download_url=f"{request.host_url}download?token={token}")

    except Exception as e:
        error_msg = str(e)
        print(f"❌ Extraction Failed: {error_msg}")
        
        # Specific detection for bot blocks
        user_error = "Engine Error"
        if "Sign in to confirm" in error_msg or "confirm you're not a bot" in error_msg or "403" in error_msg:
            user_error = "Bot detection triggered. Refresh cookies."
        
        return jsonify(error=user_error, detail=error_msg), 500

@app.route("/download", methods=["GET"])
def download_file():
    token = request.args.get("token")
    filename = token_store.get(token)
    if not filename:
        return jsonify(error="Unauthorized"), 401
    return send_from_directory(str(ABS_DOWNLOADS_PATH), filename, as_attachment=True)

@app.route("/health", methods=["GET"])
def health():
    cookie_size = 0
    if os.path.exists(COOKIES_PATH):
        cookie_size = os.path.getsize(COOKIES_PATH)
        
    return jsonify(
        status="online", 
        supabase=(supabase is not None),
        cookies_loaded=(cookie_size > 10),
        server_cookie_bytes=cookie_size,
        timestamp=datetime.now().isoformat()
    )

@app.route("/refresh-cookies", methods=["POST", "GET"])
def manual_refresh():
    """Force a cookie pull from Supabase."""
    success = fetch_cookies()
    return jsonify(success=success)

if __name__ == "__main__":
    fetch_cookies()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
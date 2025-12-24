import secrets
import os
import threading
import time
import yt_dlp
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from uuid import uuid4
from pathlib import Path
from datetime import datetime
from supabase import create_client, Client

app = Flask(__name__)

# --- Enhanced CORS Configuration ---
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    "expose_headers": ["Content-Type", "Authorization"]
}})

# --- Configuration ---
ABS_DOWNLOADS_PATH = Path('/tmp/downloads')
ABS_DOWNLOADS_PATH.mkdir(parents=True, exist_ok=True)
COOKIES_PATH = '/tmp/cookies.txt'
TOKEN_LENGTH = 32

token_store = {}
last_sync_time = None
last_error = None

# Supabase Setup - Explicit Logging
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
COOKIES_BUCKET = 'cookies'

print(f"--- Engine Initialization ---")
print(f"URL Detect: {'FOUND' if SUPABASE_URL else 'MISSING'}")
print(f"KEY Detect: {'FOUND' if SUPABASE_SERVICE_KEY else 'MISSING'}")

supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        clean_url = SUPABASE_URL.rstrip('/')
        supabase = create_client(clean_url, SUPABASE_SERVICE_KEY)
        print(f"✅ Supabase Client Initialized: {clean_url}")
    except Exception as e:
        print(f"❌ Supabase Init Error: {e}")
        last_error = f"Client Init Error: {str(e)}"
else:
    last_error = "Environment variables missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Update Render Dashboard."
    print(f"⚠️ {last_error}")

def fetch_cookies():
    """Syncs cookies from Supabase to local container."""
    global last_sync_time, last_error
    if not supabase: 
        last_error = "Supabase client not initialized. Check Render environment variables."
        print(f"❌ Sync Aborted: No Supabase Client")
        return 0
    
    try:
        print(f"📡 Syncing from bucket '{COOKIES_BUCKET}'...")
        data = supabase.storage.from_(COOKIES_BUCKET).download('cookies.txt')
        if not data:
            last_error = "Vault file 'cookies.txt' is empty or missing in bucket 'cookies'."
            print(f"⚠️ Vault Empty")
            return 0
            
        with open(COOKIES_PATH, 'wb') as f:
            f.write(data)
            
        last_sync_time = datetime.now().isoformat()
        last_error = None
        print(f"✅ Cookie vault synced: {len(data)} bytes")
        return len(data)
    except Exception as e:
        last_error = f"Vault Sync Error: {str(e)}"
        print(f"❌ {last_error}")
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
        if supabase:
            fetch_cookies()
        time.sleep(3600)

threading.Thread(target=background_worker, daemon=True).start()

# --- Robust Routing & Error Handling ---

@app.errorhandler(Exception)
def handle_exception(e):
    """Global error handler to ensure JSON + CORS headers on failure."""
    print(f"🔥 Internal Server Error: {str(e)}")
    response = jsonify({
        "error": "Internal Server Error",
        "detail": str(e),
        "status": 500
    })
    response.status_code = 500
    return response

@app.after_request
def after_request(response):
    """Fallback to ensure CORS headers are present on every single response."""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route("/", methods=["GET", "OPTIONS"])
def handle_audio_request():
    if request.method == "OPTIONS":
        return make_response("", 204)

    video_url = request.args.get("url")
    if not video_url:
        return jsonify(error="Missing URL"), 400

    if not os.path.exists(COOKIES_PATH) or os.path.getsize(COOKIES_PATH) < 10:
        fetch_cookies()

    print(f"🚀 Processing Request: {video_url}")
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
                return jsonify(error="Extraction Failed", detail="Engine could not generate audio stream."), 500
            actual_file = potential_files[0]

        token = secrets.token_urlsafe(TOKEN_LENGTH)
        token_store[token] = actual_file.name
        return jsonify(token=token, download_url=f"{request.host_url}download?token={token}")

    except Exception as e:
        error_msg = str(e)
        user_error = "Engine Error"
        if "Sign in to confirm" in error_msg or "403" in error_msg:
            user_error = "Bot detection triggered. Sessions in cookies.txt are invalid."
        print(f"❌ Error: {error_msg}")
        return jsonify(error=user_error, detail=error_msg), 500

@app.route("/download", methods=["GET"])
def download_file():
    token = request.args.get("token")
    filename = token_store.get(token)
    if not filename: return jsonify(error="Unauthorized"), 401
    return send_from_directory(str(ABS_DOWNLOADS_PATH), filename, as_attachment=True)

@app.route("/health", methods=["GET"], strict_slashes=False)
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

@app.route("/refresh-cookies", methods=["POST", "GET"], strict_slashes=False)
def manual_refresh():
    """Triggers a manual sync from Supabase vault."""
    size = fetch_cookies()
    return jsonify({
        "success": size > 0, 
        "bytes": size, 
        "time": last_sync_time, 
        "error": last_error
    })

if __name__ == "__main__":
    try:
        fetch_cookies()
    except:
        pass
    port = int(os.environ.get("PORT", 10000))
    print(f"📡 System Core starting on port {port}...")
    app.run(host="0.0.0.0", port=port)
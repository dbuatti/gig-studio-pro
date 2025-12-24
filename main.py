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

# Supabase Setup - Check common naming conventions
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').strip()
# Accept either ROLE key or just SERVICE key
SUPABASE_SERVICE_KEY = (os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_SERVICE_KEY') or '').strip()
COOKIES_BUCKET = 'cookies'

supabase: Client = None
try:
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        clean_url = SUPABASE_URL.rstrip('/')
        supabase = create_client(clean_url, SUPABASE_SERVICE_KEY)
        print(f"✅ Supabase Client Initialized.")
    else:
        print(f"⚠️ Missing Credentials: URL={bool(SUPABASE_URL)}, KEY={bool(SUPABASE_SERVICE_KEY)}")
except Exception as e:
    last_error = f"Init Error: {str(e)}"
    print(f"❌ Supabase Init Error: {e}")

def fetch_cookies():
    """Syncs cookies from Supabase to local container."""
    global last_sync_time, last_error
    if not supabase: 
        return 0
    
    try:
        data = supabase.storage.from_(COOKIES_BUCKET).download('cookies.txt')
        if not data:
            last_error = "File 'cookies.txt' not found in vault."
            return 0
            
        with open(COOKIES_PATH, 'wb') as f:
            f.write(data)
            
        last_sync_time = datetime.now().isoformat()
        last_error = None
        return len(data)
    except Exception as e:
        last_error = f"Sync Error: {str(e)}"
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

@app.route("/", methods=["GET", "OPTIONS"])
def handle_audio_request():
    if request.method == "OPTIONS":
        return make_response("", 204)
    video_url = request.args.get("url")
    if not video_url: return jsonify(error="Missing URL"), 400
    if not os.path.exists(COOKIES_PATH) or os.path.getsize(COOKIES_PATH) < 10:
        fetch_cookies()

    unique_id = str(uuid4())
    output_filename = f"{unique_id}.mp3"
    output_template = str(ABS_DOWNLOADS_PATH / unique_id)
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f"{output_template}.%(ext)s",
        'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192'}],
        'cookiefile': COOKIES_PATH if (os.path.exists(COOKIES_PATH) and os.path.getsize(COOKIES_PATH) > 10) else None,
        'nocheckcertificate': True,
        'noplaylist': True,
        'cachedir': False
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        actual_file = ABS_DOWNLOADS_PATH / output_filename
        if not actual_file.exists():
            return jsonify(error="Extraction Failed"), 500
        token = secrets.token_urlsafe(TOKEN_LENGTH)
        token_store[token] = actual_file.name
        return jsonify(token=token, download_url=f"{request.host_url}download?token={token}")
    except Exception as e:
        return jsonify(error="Engine Error", detail=str(e)), 500

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
        "supabase_initialized": supabase is not None,
        "env_check": {
            "url_present": bool(SUPABASE_URL),
            "key_present": bool(SUPABASE_SERVICE_KEY)
        }
    })

@app.route("/refresh-cookies", methods=["POST", "GET"], strict_slashes=False)
def manual_refresh():
    size = fetch_cookies()
    return jsonify({
        "success": size > 0, 
        "bytes": size, 
        "time": last_sync_time, 
        "error": last_error
    })

if __name__ == "__main__":
    if supabase: fetch_cookies()
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
import secrets
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from uuid import uuid4
from pathlib import Path
import yt_dlp
import requests
import threading
import time
from datetime import datetime
from supabase import create_client, Client

app = Flask(__name__)
CORS(app)

ABS_DOWNLOADS_PATH = os.environ.get('DOWNLOADS_PATH', '/app/downloads')
TOKEN_LENGTH = 32
COOKIES_PATH = '/app/cookies.txt'

# Supabase Configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
COOKIES_BUCKET = 'cookies'

# Initialize Supabase client
supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print(f"✅ Supabase client initialized for {SUPABASE_URL}")
else:
    print("⚠️  Supabase credentials not found. Cookie fetching disabled.")

def fetch_cookies_from_supabase():
    """Fetch cookies.txt from Supabase Storage"""
    if not supabase:
        print("❌ Supabase client not initialized")
        return False
    
    try:
        # Check if bucket exists
        buckets = supabase.storage.list_buckets()
        bucket_exists = any(b.name == COOKIES_BUCKET for b in buckets)
        
        if not bucket_exists:
            print(f"❌ Bucket '{COOKIES_BUCKET}' not found")
            return False
        
        # Download cookies.txt
        cookies_data = supabase.storage.from_(COOKIES_BUCKET).download('cookies.txt')
        
        if cookies_data:
            with open(COOKIES_PATH, 'wb') as f:
                f.write(cookies_data)
            
            file_size = len(cookies_data)
            print(f"✅ Cookies fetched from Supabase at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"   File size: {file_size} bytes")
            return True
        else:
            print("❌ No cookies data received from Supabase")
            return False
            
    except Exception as e:
        print(f"❌ Failed to fetch cookies from Supabase: {e}")
        return False

def check_cookies_valid():
    """Check if cookies file exists and has content"""
    if not os.path.exists(COOKIES_PATH):
        print(f"❌ Cookies file not found at {COOKIES_PATH}")
        return False
    
    file_size = os.path.getsize(COOKIES_PATH)
    if file_size == 0:
        print("❌ Cookies file is empty")
        return False
    
    print(f"✅ Cookies file exists ({file_size} bytes)")
    return True

def cookie_refresh_worker():
    """Background thread that refreshes cookies every hour"""
    while True:
        print("🔄 Starting scheduled cookie refresh...")
        fetch_cookies_from_supabase()
        time.sleep(3600)  # 1 hour

# Start background thread when app launches
if supabase:
    print("🚀 Starting automatic cookie refresh service...")
    refresh_thread = threading.Thread(target=cookie_refresh_worker, daemon=True)
    refresh_thread.start()
else:
    print("⚠️  Supabase not configured. Automatic refresh disabled.")

@app.route("/", methods=["GET"])
def handle_audio_request():
    video_url = request.args.get("url")
    if not video_url:
        return jsonify(error="Missing 'url' parameter."), 400

    print(f"📥 Processing request for: {video_url}")
    
    # Check cookies before attempting download
    if not check_cookies_valid():
        print("⚠️  Cookies invalid, attempting to fetch...")
        fetch_cookies_from_supabase()
        
        if not check_cookies_valid():
            return jsonify(error="Engine Error", detail="No valid cookies available. Please upload cookies via Admin Panel."), 500

    filename = f"{uuid4()}.mp3"
    downloads_path = Path(ABS_DOWNLOADS_PATH)
    downloads_path.mkdir(parents=True, exist_ok=True)
    output_path = downloads_path / filename

    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'outtmpl': str(output_path.with_suffix('.%(ext)s')),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': False,
        'cookiefile': COOKIES_PATH,
        'noplaylist': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['ios', 'android', 'mweb'],
                'player_skip': ['configs', 'webpage'],
                'skip': ['dash', 'hls']
            }
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        if not output_path.exists():
            return jsonify(error="Conversion failed: MP3 not found."), 500

    except Exception as e:
        print(f"❌ Download failed: {e}")
        return jsonify(error="Engine Error", detail=str(e)), 500

    token = secrets.token_urlsafe(TOKEN_LENGTH)
    access_manager.add_token(token, filename)
    return jsonify(token=token)

@app.route("/download", methods=["GET"])
def download_audio():
    token = request.args.get("token")
    if not token or not access_manager.has_access(token):
        return jsonify(error="Invalid token."), 401
    try:
        filename = access_manager.get_audio_file(token)
        return send_from_directory(ABS_DOWNLOADS_PATH, filename, as_attachment=True)
    except Exception as e:
        return jsonify(error="File access error.", detail=str(e)), 500

@app.route("/health", methods=["GET"])
def health_check():
    """Check if cookies exist and are valid"""
    has_cookies = os.path.exists(COOKIES_PATH)
    cookie_age = None
    if has_cookies:
        cookie_age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(COOKIES_PATH))
    
    return jsonify({
        "status": "healthy",
        "cookies_present": has_cookies,
        "cookie_age_minutes": cookie_age.total_seconds() / 60 if cookie_age else None,
        "last_refresh": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "supabase_connected": supabase is not None
    })

@app.route("/refresh-cookies", methods=["POST"])
def manual_refresh():
    """Manual endpoint to force cookie refresh"""
    result = fetch_cookies_from_supabase()
    if result:
        return jsonify(success=True, message="Cookies refreshed successfully")
    else:
        return jsonify(success=False, message="Failed to refresh cookies"), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    
    # Initial fetch on startup
    print("📥 Performing initial cookie fetch...")
    fetch_cookies_from_supabase()
    
    app.run(host="0.0.0.0", port=port)
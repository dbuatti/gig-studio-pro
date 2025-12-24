from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import yt_dlp
import os
import uuid
import threading
import time
import shutil
import subprocess
import requests

app = Flask(__name__)
CORS(app)

DOWNLOAD_DIR = "downloads"
TOKEN_EXPIRY = 300
active_tokens = {}

# Configuration for cookies
COOKIES_FILE = "cookies.txt"
COOKIES_URL = os.environ.get("COOKIES_URL") # Optional: URL to fetch cookies from

def download_cookies():
    """Download cookies.txt if a URL is provided in environment variables."""
    if COOKIES_URL:
        try:
            print(f"Downloading cookies from {COOKIES_URL}...")
            response = requests.get(COOKIES_URL)
            response.raise_for_status()
            with open(COOKIES_FILE, "w") as f:
                f.write(response.text)
            print("Cookies downloaded successfully.")
        except Exception as e:
            print(f"Failed to download cookies: {e}")

def get_ydl_opts(output_path):
    """Returns yt-dlp options, including cookies if available."""
    opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_path.replace('.mp3', ''),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True
    }
    
    # Add cookies if the file exists
    if os.path.exists(COOKIES_FILE):
        opts['cookiefile'] = COOKIES_FILE
        print("Using cookies file for download.")
    else:
        print("No cookies file found. Downloading without cookies (may fail).")
        
    return opts

def cleanup_expired_files():
    while True:
        current_time = time.time()
        expired_tokens = []
        
        for token, data in active_tokens.items():
            if current_time > data["expiry"]:
                expired_tokens.append(token)
                try:
                    if os.path.exists(data["file"]):
                        os.remove(data["file"])
                        print(f"Deleted expired file: {data['file']}")
                except Exception as e:
                    print(f"Error deleting file: {e}")
        
        for token in expired_tokens:
            del active_tokens[token]
            
        time.sleep(60)

def download_and_convert(url, token):
    try:
        filename = f"{uuid.uuid4()}.mp3"
        output_path = os.path.join(DOWNLOAD_DIR, filename)
        
        # Use the helper to get options
        ydl_opts = get_ydl_opts(output_path)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        if token in active_tokens:
            active_tokens[token]["file"] = output_path
            print(f"Download complete: {output_path}")
        else:
            if os.path.exists(output_path):
                os.remove(output_path)
                
    except Exception as e:
        print(f"Download failed: {e}")
        if token in active_tokens:
            del active_tokens[token]

@app.route('/', methods=['GET', 'OPTIONS'])
def get_token():
    if request.method == 'OPTIONS':
        return '', 204
        
    video_url = request.args.get('url')
    if not video_url:
        return jsonify({"error": "Missing url parameter"}), 400

    token = str(uuid.uuid4())
    active_tokens[token] = {
        "file": None,
        "expiry": time.time() + TOKEN_EXPIRY
    }

    threading.Thread(target=download_and_convert, args=(video_url, token), daemon=True).start()

    return jsonify({"token": token})

@app.route('/download', methods=['GET', 'OPTIONS'])
def download_file():
    if request.method == 'OPTIONS':
        return '', 204
        
    token = request.args.get('token')
    if not token:
        return jsonify({"error": "Missing token parameter"}), 400

    token_data = active_tokens.get(token)
    if not token_data:
        return jsonify({"error": "Invalid or expired token"}), 404

    file_path = token_data["file"]
    if not file_path:
        return jsonify({"status": "processing", "message": "File is being prepared. Please try again in a few seconds."}), 202

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    del active_tokens[token]
    
    return send_file(file_path, as_attachment=True, download_name="audio.mp3")

if __name__ == '__main__':
    if not os.path.exists(DOWNLOAD_DIR):
        os.makedirs(DOWNLOAD_DIR)
    
    # Download cookies on startup if URL is provided
    download_cookies()
    
    cleanup_thread = threading.Thread(target=cleanup_expired_files, daemon=True)
    cleanup_thread.start()
    
    try:
        subprocess.run(['ffmpeg', '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        print("WARNING: FFmpeg is not installed. Audio conversion will fail.")
    
    app.run(host='0.0.0.0', port=10000)
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import yt_dlp
import os
import uuid
import threading
import time
import shutil
import subprocess

app = Flask(__name__)
# Allow CORS for all origins (specifically for your Dyad app)
CORS(app)

# Configuration
DOWNLOAD_DIR = "downloads"
TOKEN_EXPIRY = 300  # 5 minutes

# In-memory store for tokens: {token: {"file": "path", "expiry": timestamp}}
active_tokens = {}

def cleanup_expired_files():
    """Background thread to clean up expired tokens and files."""
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
            
        time.sleep(60)  # Check every minute

def download_and_convert(url, token):
    """Background thread to handle download and conversion."""
    try:
        filename = f"{uuid.uuid4()}.mp3"
        output_path = os.path.join(DOWNLOAD_DIR, filename)
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path.replace('.mp3', ''),  # yt-dlp adds extension
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Update token with actual file path
        if token in active_tokens:
            active_tokens[token]["file"] = output_path
            print(f"Download complete: {output_path}")
        else:
            # Token expired during download
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

    # Generate token
    token = str(uuid.uuid4())
    
    # Store token with expiry (file path will be added later)
    active_tokens[token] = {
        "file": None,  # Will be updated by background thread
        "expiry": time.time() + TOKEN_EXPIRY
    }

    # Start background download
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

    # Consume token (one-time download)
    del active_tokens[token]
    
    return send_file(file_path, as_attachment=True, download_name="audio.mp3")

if __name__ == '__main__':
    if not os.path.exists(DOWNLOAD_DIR):
        os.makedirs(DOWNLOAD_DIR)
    
    # Start cleanup thread
    cleanup_thread = threading.Thread(target=cleanup_expired_files, daemon=True)
    cleanup_thread.start()
    
    # Check if ffmpeg is installed
    try:
        subprocess.run(['ffmpeg', '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        print("WARNING: FFmpeg is not installed. Audio conversion will fail.")
    
    app.run(host='0.0.0.0', port=10000)
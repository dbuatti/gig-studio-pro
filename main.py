import os
import threading
import time
import uuid
import sys
import requests
from flask import Flask, request, jsonify, make_response, send_file
from flask_cors import CORS
import yt_dlp

app = Flask(__name__)

# Strict CORS for production stability
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"]
    }
})

def log(message):
    print(f"[SERVER LOG] {message}")
    sys.stdout.flush()

DOWNLOAD_DIR = "/tmp/downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

active_tokens = {}

# Change from 2 to 1 to prevent OOM (Out of Memory) crashes
download_semaphore = threading.BoundedSemaphore(value=1)

def cleanup_old_files():
    while True:
        now = time.time()
        for token, data in list(active_tokens.items()):
            if now - data['timestamp'] > 600:
                file_path = data.get('file_path')
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        log(f"Cleanup: Removed {token}")
                    except Exception as e:
                        log(f"Cleanup error: {e}")
                active_tokens.pop(token, None)
        time.sleep(60)

threading.Thread(target=cleanup_old_files, daemon=True).start()

def download_task(token, video_url, supabase_url=None, supabase_key=None, song_id=None, user_id=None):
    log(f"--- STARTING BACKGROUND TASK | Token: {token} | Song: {song_id} ---")
    
    # Acquire the semaphore before starting the download
    with download_semaphore:
        log(f"[download_task] Semaphore acquired for token: {token}")
        
        # Update status to processing in Supabase if possible
        if supabase_url and supabase_key and song_id:
            try:
                update_url = f"{supabase_url}/rest/v1/repertoire?id=eq.{song_id}"
                headers = {
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                }
                requests.patch(update_url, headers=headers, json={"extraction_status": "PROCESSING"})
                log(f"[download_task] Supabase Status Updated: PROCESSING for {song_id}")
            except Exception as e:
                log(f"[download_task] Supabase Init Update Error for {song_id}: {e}")

        file_id = str(uuid.uuid4())
        output_template = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")

        ydl_opts = {
            'format': 'wa',
            'noplaylist': True,
            'outtmpl': output_template,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '128',
            }],
            'nocheckcertificate': True,
            'quiet': True,
            'logger': log # Direct yt_dlp logs to our function
        }

        try:
            log(f"[download_task] Starting yt_dlp extraction for {video_url}")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                duration = info.get('duration', 0)
            log(f"[download_task] yt_dlp extraction completed. Duration: {duration}s")
            
            expected_file = os.path.join(DOWNLOAD_DIR, f"{file_id}.mp3")
            if os.path.exists(expected_file):
                log(f"[download_task] SUCCESS | MP3 ready for upload: {token} at {expected_file}")
                
                if supabase_url and supabase_key and song_id and user_id:
                    storage_path = f"{user_id}/{song_id}/{int(time.time())}.mp3"
                    upload_url = f"{supabase_url}/storage/v1/object/public_audio/{storage_path}"
                    
                    log(f"[download_task] Uploading to Supabase Storage: {storage_path}")
                    with open(expected_file, 'rb') as f:
                        upload_res = requests.post(
                            upload_url,
                            headers={
                                "apikey": supabase_key,
                                "Authorization": f"Bearer {supabase_key}",
                                "Content-Type": "audio/mpeg"
                            },
                            data=f
                        )
                    
                    if upload_res.ok:
                        public_url = f"{supabase_url}/storage/v1/object/public/public_audio/{storage_path}"
                        update_url = f"{supabase_url}/rest/v1/repertoire?id=eq.{song_id}"
                        headers = {
                            "apikey": supabase_key,
                            "Authorization": f"Bearer {supabase_key}",
                            "Content-Type": "application/json",
                            "Prefer": "return=minimal"
                        }
                        requests.patch(update_url, headers=headers, json={
                            "preview_url": public_url,
                            "duration_seconds": int(duration),
                            "extraction_status": "COMPLETED",
                            "last_extracted_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                        })
                        log(f"[download_task] BACKGROUND SYNC COMPLETE | Song: {song_id} | Public URL: {public_url}")
                    else:
                        log(f"[download_task] UPLOAD FAILED for {song_id}: {upload_res.status_code} - {upload_res.text}")
                        raise Exception(f"Supabase Upload Error: {upload_res.status_code} - {upload_res.text}")
                
                active_tokens[token]['file_path'] = expected_file
                active_tokens[token]['status'] = 'ready'
            else:
                raise Exception("MP3 conversion failed: Expected file not found.")

        except Exception as e:
            log(f"[download_task] ERROR | {token} | Song: {song_id} | Message: {str(e)}")
            active_tokens[token]['status'] = 'error'
            active_tokens[token]['error_message'] = str(e)
            if supabase_url and supabase_key and song_id:
                try:
                    update_url = f"{supabase_url}/rest/v1/repertoire?id=eq.{song_id}"
                    headers = {
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json"
                    }
                    requests.patch(update_url, headers=headers, json={"extraction_status": "FAILED", "last_sync_log": str(e)})
                    log(f"[download_task] Supabase Status Updated: FAILED for {song_id}")
                except Exception as db_e:
                    log(f"[download_task] Supabase Error Update Failed for {song_id}: {db_e}")
    finally:
        log(f"[download_task] Semaphore released for token: {token}")


@app.route('/')
def init_download():
    video_url = request.args.get('url')
    s_url = request.args.get('s_url')
    s_key = request.args.get('s_key')
    song_id = request.args.get('song_id')
    user_id = request.args.get('user_id')

    if not video_url: 
        log("[init_download] Error: No URL provided.")
        return jsonify({"error": "No URL"}), 400
    
    token = str(uuid.uuid4())
    active_tokens[token] = {'status': 'processing', 'progress': 0, 'timestamp': time.time(), 'file_path': None}
    log(f"[init_download] Received request for {video_url}. Assigned token: {token}")
    
    threading.Thread(
        target=download_task, 
        args=(token, video_url), 
        kwargs={'supabase_url': s_url, 'supabase_key': s_key, 'song_id': song_id, 'user_id': user_id}
    ).start()
    
    return jsonify({"token": token, "status": "background_started"})

@app.route('/download')
def get_file():
    token = request.args.get('token')
    if not token or token not in active_tokens:
        log(f"[get_file] Error: Invalid or missing token: {token}")
        return jsonify({"error": "Invalid token"}), 404
    
    task = active_tokens[token]
    if task['status'] == 'processing':
        log(f"[get_file] Status: Processing for token: {token}")
        return jsonify({"status": "processing", "progress": task.get('progress', 0)}), 202
    
    if task['status'] == 'error':
        log(f"[get_file] Status: Error for token: {token}. Message: {task.get('error_message', 'Unknown Error')}")
        return jsonify({"status": "error", "error": task.get('error_message', 'Unknown Error')}), 500

    if task['status'] == 'ready':
        log(f"[get_file] Status: Ready for token: {token}. Serving file: {task['file_path']}")
        response = make_response(send_file(
            task['file_path'], 
            as_attachment=True, 
            download_name="audio.mp3",
            mimetype="audio/mpeg"
        ))
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)))
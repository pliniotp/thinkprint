"""
Watch folder uploader for ThinkPrint.

This script monitors a directory on disk and automatically uploads
newly created image or video files to the ThinkPrint backend.  It is
intended to run on a Windows machine during an event so that photos
and videos saved from a camera or photo booth are immediately sent
into the system for facial recognition and distribution.

Usage (command‑line):

    python uploader.py --folder C:\\path\\to\\watch --event EVENTID \
        --api http://localhost:5000/api

The script will poll the folder every few seconds and post any files it
has not seen before to the /api/uploads endpoint.  For each upload
it prints a log line.  In a production scenario you might wrap this
logic in a GUI using Tkinter or PyQt and compile it to an executable
with PyInstaller.
"""
from __future__ import annotations

import argparse
import os
import time
import requests


def upload_file(api_base: str, event_id: str, file_path: str) -> bool:
    """Upload a single file to the backend.

    Returns True if the upload succeeded, False otherwise.
    """
    url = f"{api_base}/uploads"
    with open(file_path, 'rb') as f:
        files = {'file': (os.path.basename(file_path), f)}
        data = {'event_id': event_id}
        try:
            response = requests.post(url, files=files, data=data)
        except Exception as e:
            print(f"[ERROR] Failed to upload {file_path}: {e}")
            return False
    if response.ok:
        print(f"[UPLOAD] {file_path} -> {response.json().get('uploads')}")
        return True
    else:
        print(f"[ERROR] Upload failed for {file_path}: {response.text}")
        return False


def monitor_folder(folder: str, event_id: str, api_base: str, interval: int = 5) -> None:
    """Monitor a folder and upload new files.

    The function keeps track of previously processed files by name.  It
    does not persist state across runs; if you restart the script it
    will attempt to reupload all files in the folder.  Only regular
    files are processed; subdirectories are ignored.
    """
    seen: set[str] = set()
    print(f"Watching folder: {folder}\nEvent ID: {event_id}\nAPI: {api_base}")
    while True:
        try:
            for entry in os.scandir(folder):
                if entry.is_file() and not entry.name.startswith('.'):
                    path = entry.path
                    if path not in seen:
                        success = upload_file(api_base, event_id, path)
                        if success:
                            seen.add(path)
            time.sleep(interval)
        except KeyboardInterrupt:
            print("Stopping uploader...")
            break
        except Exception as e:
            print(f"[ERROR] {e}")
            time.sleep(interval)


def main() -> None:
    parser = argparse.ArgumentParser(description='ThinkPrint watch folder uploader')
    parser.add_argument('--folder', required=True, help='Path to watch folder')
    parser.add_argument('--event', required=True, help='Event ID to associate uploads with')
    parser.add_argument('--api', default='http://localhost:5000/api', help='Base URL of the backend API')
    parser.add_argument('--interval', type=int, default=5, help='Polling interval in seconds')
    args = parser.parse_args()
    monitor_folder(args.folder, args.event, args.api.rstrip('/'), args.interval)


if __name__ == '__main__':
    main()
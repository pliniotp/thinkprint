"""
Main Flask application for the ThinkPrint backend.

This module exposes a RESTful API used by the dashboard, microsite,
slideshow and uploader components.  It manages events, participant
registrations, media uploads and basic notification flows.  For the
sake of simplicity this reference implementation keeps all state in
memory and writes uploaded files to local storage rather than S3.  In
a production deployment you would likely replace the in‑memory
structures with a proper database (e.g. PostgreSQL) and configure
Amazon S3 for storage of original and processed media.  Similarly, the
realtime facial recognition and matching functionality is stubbed out
but shows where to integrate AWS Rekognition calls.

To run this application locally:

    $ pip install -r requirements.txt
    $ python app.py

The API will then be available at http://127.0.0.1:5000.  When using
Vercel or another deployment platform you may need to adapt the
`wsgi_app` to their environment.
"""
from __future__ import annotations

import base64
import datetime as dt
import io
import os
import uuid
import json
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

import qrcode
from PIL import Image

# Load configuration and Twilio/AWS clients.  We import config first so
# that its module‑level constants are available to other components.
import config

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
except ImportError:
    boto3 = None  # type: ignore

try:
    from twilio.rest import Client as TwilioClient
except ImportError:
    TwilioClient = None  # type: ignore


app = Flask(__name__)
app.config['SECRET_KEY'] = config.SECRET_KEY
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Enable CORS for all origins.  When deploying you may wish to
# restrict allowed origins to your frontend domains.
CORS(app)

# ---------------------------------------------------------------------------
# Data models

@dataclass
class Event:
    id: str
    name: str
    phrase: str = ""
    logo_url: Optional[str] = None
    expiration_days: int = config.DEFAULT_GALLERY_EXPIRATION_DAYS
    created_at: dt.datetime = field(default_factory=lambda: dt.datetime.utcnow())
    participants: List[str] = field(default_factory=list)
    uploads: List[str] = field(default_factory=list)


@dataclass
class Participant:
    id: str
    event_id: str
    phone: str
    selfie_filename: str
    registered_at: dt.datetime = field(default_factory=lambda: dt.datetime.utcnow())
    gallery_token: str = field(default_factory=lambda: uuid.uuid4().hex)
    last_access_at: Optional[dt.datetime] = None
    matched_uploads: List[str] = field(default_factory=list)


@dataclass
class Upload:
    id: str
    event_id: str
    filename: str
    uploaded_at: dt.datetime = field(default_factory=lambda: dt.datetime.utcnow())
    matched_participants: List[str] = field(default_factory=list)
    # In a real implementation you might store metadata such as video
    # duration, thumbnail etc.


# In-memory stores.  Keys are object IDs and values are the dataclass
# instances.  These are not thread‑safe and will be lost on process
# restart.  Use a database (SQLAlchemy, DynamoDB, etc.) in production.
#
# We persist events to a JSON file on disk.  This allows events to
# survive across local restarts.  In serverless environments the
# filesystem may be stateless; for production you should use a
# database.  Participants and uploads are still kept in memory for
# simplicity.

EVENTS_FILE = os.path.join(os.path.dirname(__file__), 'events.json')

def load_events_from_file() -> Dict[str, Event]:
    if not os.path.isfile(EVENTS_FILE):
        return {}
    try:
        with open(EVENTS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        loaded: Dict[str, Event] = {}
        for event_id, e in data.items():
            try:
                loaded[event_id] = Event(
                    id=event_id,
                    name=e.get('name', ''),
                    phrase=e.get('phrase', ''),
                    logo_url=e.get('logo_url'),
                    expiration_days=e.get('expiration_days', config.DEFAULT_GALLERY_EXPIRATION_DAYS),
                    created_at=dt.datetime.fromisoformat(e['created_at']) if 'created_at' in e else dt.datetime.utcnow(),
                    participants=e.get('participants', []),
                    uploads=e.get('uploads', []),
                )
            except Exception:
                continue
        return loaded
    except Exception:
        return {}

def save_events_to_file(events_dict: Dict[str, Event]) -> None:
    try:
        data: Dict[str, Dict] = {}
        for event_id, e in events_dict.items():
            data[event_id] = {
                'name': e.name,
                'phrase': e.phrase,
                'logo_url': e.logo_url,
                'expiration_days': e.expiration_days,
                'created_at': e.created_at.isoformat(),
                'participants': e.participants,
                'uploads': e.uploads,
            }
        with open(EVENTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

events: Dict[str, Event] = load_events_from_file()
participants: Dict[str, Participant] = {}
uploads: Dict[str, Upload] = {}

# Precompute hashed passwords for the admin users.  We do this at
# startup so that we don't store plaintext passwords in memory longer
# than necessary.
ADMIN_CREDENTIALS: Dict[str, str] = {}
for admin in config.ADMIN_USERS:
    ADMIN_CREDENTIALS[admin['username']] = generate_password_hash(admin['password'])

# Session tokens.  When an admin logs in we generate a random token and
# store it here.  Tokens are not persisted across restarts and are not
# signed or time‑limited.  Use JWTs or Flask sessions if you need
# persistent authentication.
sessions: Dict[str, str] = {}

# Instantiate AWS and Twilio clients if available.  These will be
# ``None`` if boto3 or Twilio is not installed.  You can safely
# override them in tests.
if boto3:
    rekognition_client = boto3.client(
        'rekognition',
        aws_access_key_id=config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=config.AWS_SECRET_ACCESS_KEY,
        region_name=config.AWS_REGION,
    )
else:
    rekognition_client = None

if TwilioClient:
    twilio_client = TwilioClient(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
else:
    twilio_client = None


def require_auth(func):  # type: ignore
    """Decorator to enforce admin authentication via a header token.

    Clients must send the header ``Authorization: Bearer <token>``.  If
    the token is missing or invalid a 401 response is returned.
    """
    from functools import wraps

    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401
        token = auth_header.split(' ', 1)[1]
        if token not in sessions:
            return jsonify({'error': 'Invalid session token'}), 401
        # You could also set ``g.user`` here based on sessions[token]
        return func(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# Helper functions

def generate_qr_code(url: str) -> bytes:
    """Generate a PNG QR code for the given URL and return its bytes.

    The caller can then base64‑encode the result or save it to disk.
    """
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()


def match_faces(upload: Upload, event: Event) -> None:
    """Match faces in the uploaded media to registered participants.

    This function is a stub demonstrating where AWS Rekognition
    integration would occur.  In a production system you would call
    ``rekognition_client.search_faces_by_image`` for photos or
    ``rekognition_client.search_faces_by_video`` for videos.  For
    simplicity we will match participants at random in this example.
    """
    # If there are no participants in the event there is nothing to match.
    if not event.participants:
        return

    # Here you would call AWS Rekognition to detect and recognise faces in
    # the uploaded file.  For example:
    # with open(os.path.join(app.config['UPLOAD_FOLDER'], upload.filename), 'rb') as f:
    #     image_bytes = f.read()
    # response = rekognition_client.search_faces_by_image(
    #     CollectionId=config.REKOGNITION_COLLECTION,
    #     Image={'Bytes': image_bytes},
    #     FaceMatchThreshold=80,
    #     MaxFaces=5
    # )
    # matches = response['FaceMatches']
    # Then map the Rekognition face IDs back to participant IDs stored in
    # your database.

    # For this demonstration we'll randomly select up to two participants
    # and pretend they appear in the upload.  This ensures that the
    # gallery shows something when you test the system locally.
    import random

    potential = event.participants
    matched = random.sample(potential, k=min(len(potential), 2))
    for participant_id in matched:
        upload.matched_participants.append(participant_id)
        participant = participants[participant_id]
        participant.matched_uploads.append(upload.id)
        # Simulate sending a notification.  In production you would call
        # ``twilio_client.messages.create`` with appropriate parameters.
        send_media_notification(participant, event, upload)


def send_media_notification(participant: Participant, event: Event, upload: Upload) -> None:
    """Send a WhatsApp or SMS notification to the participant.

    If the event has an attached participant who just matched a media
    file, this function sends them a message with a link to their
    gallery.  When Twilio is not configured the message is simply
    printed to stdout.
    """
    gallery_url = f"https://thinkprint-gallery.vercel.app/gallery/{participant.gallery_token}"
    message_body_sms = (
        f"Olá! Suas fotos e vídeos do evento '{event.name}' estão disponíveis. "
        f"Acesse sua galeria: {gallery_url}"
    )
    message_body_whatsapp = (
        f"🎉 Olá! Encontramos novas fotos/vídeos para você no evento '{event.name}'. "
        f"Veja sua galeria completa: {gallery_url}"
    )
    to_number = participant.phone
    # Decide whether to send via WhatsApp or SMS based on phone prefix.  This
    # is a naive implementation: numbers starting with "+55" get WhatsApp.
    use_whatsapp = to_number.startswith("+55")
    if twilio_client:
        try:
            if use_whatsapp:
                twilio_client.messages.create(
                    body=message_body_whatsapp,
                    from_=config.TWILIO_WHATSAPP_NUMBER,
                    to=f"whatsapp:{to_number}"
                )
            else:
                twilio_client.messages.create(
                    body=message_body_sms,
                    from_=config.TWILIO_SMS_NUMBER,
                    to=to_number
                )
        except Exception as e:
            # Log the error; do not crash the app due to a notification failure.
            print(f"Twilio error while sending media notification: {e}")
    else:
        # When Twilio is not configured, just print the message to the console.
        print(f"Would send to {to_number}: {message_body_whatsapp if use_whatsapp else message_body_sms}")


# ---------------------------------------------------------------------------
# API Endpoints

@app.route('/api/login', methods=['POST'])
def login():
    """Authenticate an admin user.

    Expects a JSON payload with ``username`` and ``password``.  On
    success returns a JSON object containing a bearer token.  The
    client should include this token in the ``Authorization`` header of
    subsequent requests.
    """
    data = request.get_json() or {}
    username = data.get('username', '')
    password = data.get('password', '')
    stored_hash = ADMIN_CREDENTIALS.get(username)
    if stored_hash and check_password_hash(stored_hash, password):
        token = uuid.uuid4().hex
        sessions[token] = username
        return jsonify({'token': token})
    return jsonify({'error': 'Invalid credentials'}), 401


@app.route('/api/events', methods=['GET', 'POST'])
@require_auth
def events_collection():
    """List all events or create a new event."""
    if request.method == 'GET':
        return jsonify([asdict(e) for e in events.values()])

    # POST: create a new event
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    phrase = data.get('phrase', '').strip()
    logo_url = data.get('logo_url')
    expiration_days = int(data.get('expiration_days', config.DEFAULT_GALLERY_EXPIRATION_DAYS))
    if not name:
        return jsonify({'error': 'Event name is required'}), 400
    event_id = uuid.uuid4().hex
    event = Event(id=event_id, name=name, phrase=phrase, logo_url=logo_url, expiration_days=expiration_days)
    events[event_id] = event
    save_events_to_file(events)
    return jsonify(asdict(event)), 201


@app.route('/api/events/<event_id>', methods=['GET', 'PUT', 'DELETE'])
@require_auth
def event_item(event_id: str):
    """Retrieve, update or delete a specific event."""
    event = events.get(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    if request.method == 'GET':
        return jsonify(asdict(event))
    if request.method == 'PUT':
        data = request.get_json() or {}
        event.name = data.get('name', event.name)
        event.phrase = data.get('phrase', event.phrase)
        event.logo_url = data.get('logo_url', event.logo_url)
        event.expiration_days = int(data.get('expiration_days', event.expiration_days))
        save_events_to_file(events)
        return jsonify(asdict(event))
    # DELETE
    # Remove participants and uploads associated with this event
    for pid in list(event.participants):
        participants.pop(pid, None)
    for uid in list(event.uploads):
        uploads.pop(uid, None)
    events.pop(event_id)
    save_events_to_file(events)
    return jsonify({'message': 'Event deleted'})


@app.route('/api/events/<event_id>/qr', methods=['GET'])
@require_auth
def event_qr(event_id: str):
    """Generate and return a QR code PNG for the registration link."""
    event = events.get(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    # Build a registration URL.  The microsite front‑end is assumed to
    # handle registration at /register?event=<event_id>
    reg_url = f"https://thinkprint-gallery.vercel.app/register?event={event_id}"
    png_bytes = generate_qr_code(reg_url)
    encoded = base64.b64encode(png_bytes).decode('utf-8')
    return jsonify({'qr': encoded, 'url': reg_url})


@app.route('/api/events/<event_id>/leads', methods=['GET'])
@require_auth
def event_leads(event_id: str):
    """Export leads for an event."""
    event = events.get(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    lead_data = []
    for pid in event.participants:
        p = participants[pid]
        lead_data.append({
            'participant_id': p.id,
            'phone': p.phone,
            'selfie': p.selfie_filename,
            'registered_at': p.registered_at.isoformat(),
            'gallery_token': p.gallery_token,
            'matched_uploads': p.matched_uploads,
        })
    return jsonify(lead_data)


@app.route('/api/events/<event_id>/uploads', methods=['GET'])
@require_auth
def event_uploads(event_id: str):
    """List uploads associated with an event."""
    event = events.get(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    return jsonify([asdict(uploads[uid]) for uid in event.uploads])


@app.route('/api/uploads', methods=['POST'])
def upload_media():
    """Endpoint for the watch folder uploader to send files.

    Expects multipart/form-data with ``file`` and a form field ``event_id``.
    Multiple files may be uploaded by repeating the ``file`` field.  The
    backend stores the files on disk and attempts to match faces.  A
    JSON response contains the created upload IDs.
    """
    event_id = request.form.get('event_id')
    event = events.get(event_id)
    if not event:
        return jsonify({'error': 'Invalid event_id'}), 400
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    files = request.files.getlist('file')
    created = []
    for file_storage in files:
        if file_storage.filename == '':
            continue
        filename = f"{uuid.uuid4().hex}_{file_storage.filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file_storage.save(filepath)
        upload_id = uuid.uuid4().hex
        upload = Upload(id=upload_id, event_id=event_id, filename=filename)
        uploads[upload_id] = upload
        event.uploads.append(upload_id)
        # Attempt to match faces (stubbed)
        match_faces(upload, event)
        created.append(upload_id)
    return jsonify({'uploads': created})


@app.route('/api/register', methods=['POST'])
def register_participant():
    """Handle participant registration.

    Expects multipart/form-data containing ``event_id``, ``phone`` and
    ``selfie``.  Stores the selfie on disk, creates a participant
    record, indexes their face (stub) and returns a confirmation.
    """
    event_id = request.form.get('event_id')
    phone = request.form.get('phone', '').strip()
    event = events.get(event_id)
    if not event:
        return jsonify({'error': 'Invalid event_id'}), 400
    if not phone:
        return jsonify({'error': 'Phone number is required'}), 400
    if 'selfie' not in request.files:
        return jsonify({'error': 'Selfie image is required'}), 400
    selfie = request.files['selfie']
    filename = f"selfie_{uuid.uuid4().hex}_{selfie.filename}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    selfie.save(filepath)
    participant_id = uuid.uuid4().hex
    participant = Participant(id=participant_id, event_id=event_id, phone=phone, selfie_filename=filename)
    participants[participant_id] = participant
    event.participants.append(participant_id)
    # Stub: index the face in AWS Rekognition
    # In production you would call rekognition_client.index_faces here.
    # After indexing, attempt to match existing uploads against this new participant
    for uid in event.uploads:
        upload = uploads[uid]
        # Only attempt to match if not already matched to this participant
        if participant_id not in upload.matched_participants:
            # In a real implementation you would call Rekognition to search
            # for this participant's face in the upload; here we just call
            # match_faces on the upload again so that the stub picks random
            # participants (which may include the new one).
            match_faces(upload, event)
    # Send a confirmation message to the participant (SMS/WhatsApp)
    confirmation_msg = (
        "Perfeito! Cadastro realizado. Você receberá em minutos seu vídeo ou foto "
        "por WhatsApp ou SMS."
    )
    # We treat this as a notification to the user; for demonstration we simply
    # return it in the JSON response.  A real system might send this via
    # Twilio immediately.
    return jsonify({'participant_id': participant_id, 'message': confirmation_msg})


@app.route('/api/gallery/<gallery_token>', methods=['GET'])
def participant_gallery(gallery_token: str):
    """Return the media associated with a participant's gallery.

    The gallery token is a random string assigned to each participant.
    This endpoint is used by the microsite to fetch the list of
    recognised uploads for a given participant.  When the gallery is
    accessed we update ``last_access_at`` so that the system knows
    whether or not to send reminder messages.
    """
    # Find participant by gallery token
    participant = next((p for p in participants.values() if p.gallery_token == gallery_token), None)
    if not participant:
        return jsonify({'error': 'Gallery not found'}), 404
    participant.last_access_at = dt.datetime.utcnow()
    media = []
    for uid in participant.matched_uploads:
        upload = uploads.get(uid)
        if upload:
            media.append({
                'upload_id': upload.id,
                'filename': upload.filename,
                'url': f"/api/media/{upload.filename}",
                'uploaded_at': upload.uploaded_at.isoformat(),
            })
    return jsonify({'participant_id': participant.id, 'event_id': participant.event_id, 'media': media})


@app.route('/api/media/<filename>', methods=['GET'])
def serve_media(filename: str):
    """Serve uploaded media files.

    This route serves files stored in the backend's uploads folder.  In
    production you should instead serve media directly from S3 or your
    CDN.  This endpoint is primarily for development and demo purposes.
    """
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.isfile(filepath):
        return jsonify({'error': 'File not found'}), 404
    return send_file(filepath)


@app.route('/api/slideshow/<event_id>', methods=['GET'])
def event_slideshow(event_id: str):
    """Return all media files for a slideshow.

    The slideshow endpoint returns a list of URLs to all uploads for a
    given event.  The front‑end can then iterate over these items to
    display an automatic slideshow with transitions.  We do not enforce
    authentication here since the slideshow is typically shown publicly
    during an event.
    """
    event = events.get(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    media = []
    for uid in event.uploads:
        upload = uploads.get(uid)
        if upload:
            media.append({
                'upload_id': upload.id,
                'filename': upload.filename,
                'url': f"/api/media/{upload.filename}",
                'uploaded_at': upload.uploaded_at.isoformat(),
            })
    return jsonify({'event_id': event_id, 'media': media})

# ---------------------------------------------------------------------------
# Public endpoints

@app.route('/api/public/events/<event_id>', methods=['GET'])
def public_event_details(event_id: str):
    """Return public information about an event for the microsite.

    This endpoint exposes a subset of event fields without requiring
    authentication.  It is used by the registration and slideshow
    front‑ends to display the event name, phrase and logo before a
    participant has registered.
    """
    event = events.get(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    return jsonify({
        'id': event.id,
        'name': event.name,
        'phrase': event.phrase,
        'logo_url': event.logo_url,
        'expiration_days': event.expiration_days,
    })


if __name__ == '__main__':
    # When running directly, start the Flask development server.  For
    # production use a WSGI server like Gunicorn or uWSGI.
    app.run(host='0.0.0.0', port=5000, debug=True)
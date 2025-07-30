"""
Configuration module for the ThinkPrint backend.

This file centralises all environment variables and default values used
throughout the backend. Adjust these values to point at your AWS
resources, Twilio credentials and other settings. When deploying the
application you should override these defaults using environment
variables.

The configuration is split into logical sections:

* AWS settings: Credentials and S3/Rekognition configuration.  The
  default values are placeholders and will not work until you supply
  your own AWS keys and region.
* Twilio settings: Account SID, auth token and the phone numbers used
  when sending SMS or WhatsApp messages.  Twilio will refuse to send
  messages if these values are incorrect or if your account is not
  configured for WhatsApp.
* Application settings: A list of predefined admin users along with
  optional secrets for JWT signing and token expiry.  If you wish to
  use a database instead of the in‑memory stores defined in
  ``app.py`` you can put the SQLAlchemy URI here as well.

It is good practice not to commit your real credentials to source
control.  Instead you can create a ``.env`` file alongside this
module or provide the values via your deployment platform (Vercel,
Heroku, etc.).  Python's ``os.environ`` will read from the system
environment automatically.
"""
from __future__ import annotations

import os

# ---------------------------------------------------------------------------
# AWS Configuration
#
# These keys are placeholders.  Replace them with your own credentials or
# configure your environment so that boto3 automatically picks up the
# credentials (for example by assigning the IAM role in an EC2 instance).

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "your-aws-access-key-id")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "your-aws-secret-access-key")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

# S3 bucket names for storing uploaded media and generated thumbnails.  You
# should create these buckets in your AWS account.  The backend will
# automatically prefix files with the event ID when uploading.
S3_MEDIA_BUCKET = os.environ.get("S3_MEDIA_BUCKET", "thinkprint-media")
S3_THUMBNAIL_BUCKET = os.environ.get("S3_THUMBNAIL_BUCKET", "thinkprint-thumbnails")

# Face collection name used by AWS Rekognition to index participants.  The
# backend will attempt to create the collection on startup if it does not
# already exist.  Changing this name will create a new collection.
REKOGNITION_COLLECTION = os.environ.get("REKOGNITION_COLLECTION", "thinkprint-faces")

# ---------------------------------------------------------------------------
# Twilio Configuration
#
# Twilio settings used for sending SMS and WhatsApp messages.  You must
# configure your Twilio account to support the WhatsApp sandbox and
# configure an approved WhatsApp sender.  See the Twilio documentation for
# details: https://www.twilio.com/docs/whatsapp

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "your-twilio-account-sid")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "your-twilio-auth-token")

# Phone numbers used as the sender for SMS and WhatsApp.  The WhatsApp
# number must include the ``whatsapp:`` prefix.  For example:
#   TWILIO_WHATSAPP_NUMBER = "whatsapp:+1234567890"
TWILIO_SMS_NUMBER = os.environ.get("TWILIO_SMS_NUMBER", "+1234567890")
TWILIO_WHATSAPP_NUMBER = os.environ.get("TWILIO_WHATSAPP_NUMBER", "whatsapp:+1234567890")

# ---------------------------------------------------------------------------
# Application Configuration

# Predefined admin users for the dashboard.  Each entry in this list
# contains a username and a plaintext password.  In a real deployment you
# should store hashed passwords in a database and provide a registration
# flow.  Note that these credentials are loaded on startup and cannot be
# modified via the API.
ADMIN_USERS = [
    {"username": "admin", "password": "password123"},
    {"username": "editor", "password": "edit321"},
    {"username": "viewer", "password": "viewonly"},
]

# Secret key used by Flask for signing session cookies and optional JWT
# tokens.  If you do not set this value explicitly a default string will
# be used.  For production deployments you should set a long random
# value.
SECRET_KEY = os.environ.get("SECRET_KEY", "super-secret-key")

# Time (in days) before a participant's gallery expires.  When creating
# events the dashboard can override this default to 15 or 30 days.
DEFAULT_GALLERY_EXPIRATION_DAYS = int(os.environ.get("DEFAULT_GALLERY_EXPIRATION_DAYS", 30))

"""
End of configuration file
"""
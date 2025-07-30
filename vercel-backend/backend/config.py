"""
Configuration module for the serverless ThinkPrint backend on Vercel.

This file is copied from ``thinkprint/backend/config.py`` and provides
defaults for AWS, Twilio and application settings.  Values can be
overridden via environment variables when deploying to Vercel.  Do not
hardcode your real credentials here; instead set the corresponding
environment variables in the Vercel project settings.
"""
from __future__ import annotations

import os

# ---------------------------------------------------------------------------
# AWS Configuration

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "your-aws-access-key-id")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "your-aws-secret-access-key")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

S3_MEDIA_BUCKET = os.environ.get("S3_MEDIA_BUCKET", "thinkprint-media")
S3_THUMBNAIL_BUCKET = os.environ.get("S3_THUMBNAIL_BUCKET", "thinkprint-thumbnails")
REKOGNITION_COLLECTION = os.environ.get("REKOGNITION_COLLECTION", "thinkprint-faces")

# ---------------------------------------------------------------------------
# Twilio Configuration

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "your-twilio-account-sid")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "your-twilio-auth-token")
TWILIO_SMS_NUMBER = os.environ.get("TWILIO_SMS_NUMBER", "+1234567890")
TWILIO_WHATSAPP_NUMBER = os.environ.get("TWILIO_WHATSAPP_NUMBER", "whatsapp:+1234567890")

# ---------------------------------------------------------------------------
# Application Configuration

ADMIN_USERS = [
    {"username": "admin", "password": "password123"},
    {"username": "editor", "password": "edit321"},
    {"username": "viewer", "password": "viewonly"},
]

SECRET_KEY = os.environ.get("SECRET_KEY", "super-secret-key")
DEFAULT_GALLERY_EXPIRATION_DAYS = int(os.environ.get("DEFAULT_GALLERY_EXPIRATION_DAYS", 30))
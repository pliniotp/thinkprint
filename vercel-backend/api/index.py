"""
Entry point for the ThinkPrint backend when deployed to Vercel.

Vercel's Python runtime expects a WSGI application to be exposed from
files inside the ``api/`` directory.  This module simply imports the
Flask ``app`` object defined in our monolithic ``backend/app.py`` and
exposes it as a module‑level variable.  Because our application
registers its routes with the ``/api`` prefix (e.g. ``/api/login``),
we additionally configure a rewrite rule in ``vercel.json`` to route
any incoming requests beginning with ``/api/`` to this function.  In
other words, requests to ``/api/login`` on the deployed domain will be
handled by the ``login`` route defined in ``backend/app.py``.

No code is executed at import time other than importing the Flask app,
so there is no call to ``app.run()``.  This is important: Vercel's
runtime will handle invoking our application for each request, and
starting a local server inside this file would break serverless
execution.
"""

from __future__ import annotations

# Import the Flask application from our existing backend.  The
# conditional in backend/app.py ensures that ``app.run()`` is not
# executed on import, so this is safe in a serverless environment.
from ..backend.app import app as app  # noqa: F401

# Vercel looks for a module‑level variable named ``app`` that is a
# valid WSGI callable.  By importing ``app`` above we satisfy this
# requirement.  There is no further configuration required here.

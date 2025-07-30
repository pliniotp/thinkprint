"""
WSGI entry point for the ThinkPrint backend on Vercel.

This file imports the Flask application defined in ``backend/app.py`` and
exposes it as ``app`` for the Vercel Python runtime.  The backend
package is bundled inside this project (see the ``backend`` directory)
to avoid having to import code from elsewhere in the repository.
"""

from __future__ import annotations

# Import the Flask app from the local backend package.  The ``backend``
# directory is included as part of the vercel-backend project.
from backend.app import app  # noqa: F401

# Nothing else to do: Vercel will detect the ``app`` variable and
# forward HTTP requests to it.  Do not call ``app.run()`` here.
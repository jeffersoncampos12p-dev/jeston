"""Regenerate the Jeston Mintlify pages with page-specific editorial content.

The detailed topic data lives in personalize_docs.py so the maintenance command
and the generated documentation always use the same source of truth.
"""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name('personalize_docs.py')), run_name='__main__')

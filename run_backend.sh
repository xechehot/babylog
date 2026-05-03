#!/bin/bash
set -e
cd "$(dirname "$0")/backend"
uv run fastapi dev app/main.py --host 0.0.0.0 --port 3849

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMFY="$ROOT/ComfyUI"

if [ ! -d "$COMFY" ]; then
  echo "ComfyUI not found. Run: bash tools/card-art/comfy/install-comfy.sh"
  exit 1
fi

cd "$COMFY"
source .venv/bin/activate
python main.py --listen 127.0.0.1 --port 8188

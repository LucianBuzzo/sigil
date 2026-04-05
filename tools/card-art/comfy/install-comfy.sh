#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$ROOT/ComfyUI"

if [ ! -d "$TARGET/.git" ]; then
  git clone https://github.com/comfyanonymous/ComfyUI.git "$TARGET"
else
  echo "ComfyUI already cloned at $TARGET"
fi

cd "$TARGET"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ ComfyUI installed at $TARGET"

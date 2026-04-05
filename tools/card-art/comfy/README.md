# Sigil ComfyUI Local Art Pipeline

This sets up a repeatable local image generation pipeline for card art.

## 1) Install ComfyUI (one-time)

```bash
cd ~/projects/sigil
bash tools/card-art/comfy/install-comfy.sh
```

## 2) Place a checkpoint model

Put an SDXL-compatible checkpoint in:

`tools/card-art/comfy/ComfyUI/models/checkpoints/`

Example expected file name (default):

`dreamshaperXL.safetensors`

You can override via env var:

```bash
export SIGIL_COMFY_CHECKPOINT="YourModelFile.safetensors"
```

## 3) Start ComfyUI API server

```bash
bash tools/card-art/comfy/start-comfy.sh
```

Default endpoint: `http://127.0.0.1:8188`

## 4) Generate card art from prompts.json

```bash
python3 tools/card-art/comfy/generate_cards.py
```

Outputs are written directly to:

`apps/client/public/card-art/`

## 5) Validate and preview in game

```bash
npm run art:check
npm run dev
```

---

## Notes

- This pipeline uses `tools/card-art/prompts.json` as source of truth.
- Generation settings can be tuned in `generate_cards.py`.
- If ComfyUI custom nodes alter base node names, adapt the workflow payload accordingly.

#!/usr/bin/env python3
import json
import os
import time
import urllib.request
import urllib.error
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # sigil/
PROMPTS_PATH = ROOT / "tools" / "card-art" / "prompts.json"
OUTPUT_DIR = ROOT / "apps" / "client" / "public" / "card-art"
COMFY_URL = os.environ.get("SIGIL_COMFY_URL", "http://127.0.0.1:8188")
CHECKPOINT = os.environ.get("SIGIL_COMFY_CHECKPOINT", "dreamshaperXL.safetensors")

WIDTH = int(os.environ.get("SIGIL_COMFY_WIDTH", "1152"))
HEIGHT = int(os.environ.get("SIGIL_COMFY_HEIGHT", "768"))
STEPS = int(os.environ.get("SIGIL_COMFY_STEPS", "32"))
CFG = float(os.environ.get("SIGIL_COMFY_CFG", "6.0"))
SAMPLER = os.environ.get("SIGIL_COMFY_SAMPLER", "dpmpp_2m")
SCHEDULER = os.environ.get("SIGIL_COMFY_SCHEDULER", "karras")
DENOISE = float(os.environ.get("SIGIL_COMFY_DENOISE", "1.0"))

NEGATIVE = (
    "text, logo, watermark, signature, frame, border, lowres, blurry, malformed anatomy, duplicate limbs, distorted face"
)

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def http_json(method: str, path: str, payload=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(COMFY_URL + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def check_comfy_up():
    try:
        _ = http_json("GET", "/system_stats")
        return True
    except Exception:
        return False


def workflow_for(prompt: str, seed: int, filename_prefix: str):
    # Standard Comfy base graph:
    # 1 CheckpointLoaderSimple
    # 2 CLIPTextEncode (positive)
    # 3 CLIPTextEncode (negative)
    # 4 EmptyLatentImage
    # 5 KSampler
    # 6 VAEDecode
    # 7 SaveImage
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": CHECKPOINT},
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["1", 1]},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": NEGATIVE, "clip": ["1", 1]},
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": WIDTH, "height": HEIGHT, "batch_size": 1},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": STEPS,
                "cfg": CFG,
                "sampler_name": SAMPLER,
                "scheduler": SCHEDULER,
                "denoise": DENOISE,
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
            },
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
        },
        "7": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": filename_prefix, "images": ["6", 0]},
        },
    }


def wait_for_prompt(prompt_id: str, timeout_s: int = 240):
    start = time.time()
    while time.time() - start < timeout_s:
        history = http_json("GET", f"/history/{prompt_id}")
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(1.2)
    raise TimeoutError(f"Timed out waiting for prompt {prompt_id}")


def move_latest_output(prefix: str, target_png: Path):
    comfy_out = Path(__file__).resolve().parent / "ComfyUI" / "output"
    if not comfy_out.exists():
        raise RuntimeError("Comfy output folder not found")

    candidates = sorted(
        [p for p in comfy_out.glob(f"{prefix}*.png") if p.is_file()],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise RuntimeError(f"No output image found for prefix: {prefix}")

    target_png.parent.mkdir(parents=True, exist_ok=True)
    target_png.write_bytes(candidates[0].read_bytes())


def main():
    if not check_comfy_up():
        raise SystemExit(
            "ComfyUI server not reachable. Start it with: bash tools/card-art/comfy/start-comfy.sh"
        )

    prompts = json.loads(PROMPTS_PATH.read_text())
    style = prompts.get("style", "")
    cards = prompts.get("cards", [])

    if not cards:
        raise SystemExit("No cards found in prompts.json")

    client_id = str(uuid.uuid4())

    for i, card in enumerate(cards, start=1):
        card_id = card["id"]
        seed = int(card.get("seed", 1))
        final_prompt = f"{card['prompt']}, {style}" if style else card["prompt"]
        prefix = f"sigil_{card_id}"

        print(f"[{i}/{len(cards)}] Generating {card_id}...")
        wf = workflow_for(final_prompt, seed, prefix)
        queued = http_json("POST", "/prompt", {"prompt": wf, "client_id": client_id})
        prompt_id = queued.get("prompt_id")
        if not prompt_id:
            raise RuntimeError(f"Comfy queue response missing prompt_id: {queued}")

        _ = wait_for_prompt(prompt_id)

        target = OUTPUT_DIR / f"{card_id}.png"
        move_latest_output(prefix, target)
        print(f"  -> {target}")

    print("\n✅ Card art generation complete")


if __name__ == "__main__":
    main()

# Sigil Local Card Art Pipeline (M1 Max)

This project supports local generation of card art with no API usage.

## Recommended stack

- **Draw Things** (fastest setup on Apple Silicon)
- Model: **SDXL** (e.g. JuggernautXL / DreamShaperXL)
- Output: `apps/client/public/card-art/<card-id>.png`

## Expected files

Current cards:

- `slash.png`
- `lunge.png`
- `shield-bash.png`
- `parry.png`
- `arc-bolt.png`

Place them in:

`apps/client/public/card-art/`

## Generation settings (starter)

- Size: `1152x768` (landscape card art)
- Steps: `28-36`
- CFG: `5.5-7.0`
- Sampler: `DPM++ 2M Karras` (or closest)
- Seed: fixed per card for reproducibility

## Prompting approach

Use `tools/card-art/prompts.json` as canonical prompts.

- Keep prompts **no text, no border, no watermark**.
- Keep consistent style descriptors across cards.

## Quick validation

```bash
node tools/card-art/check-art.mjs
```

This confirms required files exist and are wired for the client.


## Draw Things preset

- Preset guide: `tools/card-art/draw-things/SIGIL_DRAW_THINGS_PRESET.md`
- Task checklist: `tools/card-art/draw-things/generate-checklist.md`

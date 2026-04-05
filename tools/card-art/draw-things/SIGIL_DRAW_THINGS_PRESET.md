# Sigil Draw Things Preset (Card Art)

Use this as your default preset for fantasy TCG-style card illustrations.

## Base model

- **Preferred:** SDXL model (JuggernautXL or DreamShaperXL)
- **Fallback:** Any high-quality SDXL checkpoint you already have

## Core settings

- Size: **1152 x 768** (landscape card art)
- Steps: **32**
- CFG: **6.0**
- Sampler: **DPM++ 2M Karras** (or nearest equivalent)
- Clip skip: default
- Seed: fixed per card from `tools/card-art/prompts.json`

## Prompt template

Use this fixed style suffix for consistency:

`fantasy TCG illustration, painterly, dramatic lighting, high detail, no text, no logo, no border, no watermark`

Final prompt shape:

`<card-specific prompt>, fantasy TCG illustration, painterly, dramatic lighting, high detail, no text, no logo, no border, no watermark`

## Negative prompt

`text, logo, watermark, signature, frame, border, lowres, blurry, malformed anatomy, duplicate limbs, distorted face`

## Workflow

1. Open `tools/card-art/prompts.json`
2. Generate one image per `cards[].id` using corresponding seed + prompt
3. Export as PNG into `apps/client/public/card-art/<id>.png`
4. Run:

```bash
npm run art:check
```

5. Start app and review in context:

```bash
npm run dev
```

## Fast quality pass checklist

- Is silhouette readable at small size?
- Is subject centered enough for card crop?
- Any accidental text/watermark?
- Color identity distinct from other cards?

## Optional enhancement pass

- Generate 3 variants per card (`id-v1`, `id-v2`, `id-v3`)
- Pick best and rename to `<id>.png`
- Use `tools/card-art/fit-card-art.mjs` if source aspect differs

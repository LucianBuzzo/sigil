# Sigil QA Smoke Scripts

These scripts validate baseline playability in the browser.

## Prerequisites

1. Start the app:

```bash
npm run dev
```

2. Install Playwright once:

```bash
npm install -D playwright
```

## Run all smoke checks

```bash
npm run qa:smoke
```

## Checks included

- `smoke-load.mjs` — page loads and core UI exists
- `smoke-movement.mjs` — active ally can move at least one tile
- `smoke-turn-cards.mjs` — ending turn increments turn and produces hand state
- `smoke-combat.mjs` — playing a card updates selected-enemy combat state/log

## Optional URL override

```bash
SIGIL_URL=http://localhost:5173 npm run qa:smoke
```

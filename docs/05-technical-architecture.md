# Technical Architecture (Initial)

## Suggested Monorepo Layout

- `packages/core` — turn engine, combat rules, card resolution
- `packages/world` — dungeoneer integration + map adaptation
- `packages/content` — items, cards, classes, enemies
- `apps/client` — game client/UI
- `apps/sim` — headless simulation + balance tooling

## Engine Principles

- Pure, deterministic core logic
- Data-driven content definitions
- Seeded RNG boundaries
- Replay logs for debugging

## Dungeoneer Integration

- Use dungeoneer output as world-generation source
- Add adapter layer translating generated geometry into tactical grid metadata:
  - walkability
  - cover/blockers
  - spawn points
  - interactables

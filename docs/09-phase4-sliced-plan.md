# Phase 4 — Sliced Implementation Plan

This breaks `08-roadmap.md` Phase 4 into small, shippable slices.

## Slice 1 — Content Expansion (Classes, Cards, Enemies) ✅

Goal: increase gameplay variety with minimal system churn.

- [x] Add class loadout model in content package
- [x] Add at least 2 new cards using existing status system
- [x] Add at least 1 new item set wired to new cards
- [x] Add at least 1 new enemy archetype in core spawn logic
- [x] Ensure `createNewGame` can select a class loadout
- [x] Typecheck passes

## Slice 2 — Rank Tree Expansion (in progress)

Goal: deepen progression choices beyond current rank mutation pair.

- [x] Add additional rank mutation options or branches (added `reaper`)
- [ ] Add simple data-driven mutation definitions (not hardcoded if/else only)
- [x] Ensure mutation choice persists and affects turn loop
- [x] Add/update UX copy in right sidebar for mutation effects
- [x] Typecheck passes

## Slice 3 — Simulation Harness for Balancing

Goal: make balance tuning measurable and repeatable.

- [ ] Add headless simulation runner script (batch over seeds)
- [ ] Capture win/loss, avg floors, avg turns, avg kills
- [ ] Add knobs for iterations / seed start / class selection
- [ ] Output concise markdown/console summary for comparisons
- [ ] Document usage in docs

## Slice 4 — Balance Pass + Targets

Goal: tune with explicit success criteria.

- [ ] Define target ranges (e.g. floor reach, survival rate)
- [ ] Run harness before/after adjustments
- [ ] Tune AP/cards/enemy scaling/rewards against targets
- [ ] Record balancing notes and decisions

---

## Execution order

1. Slice 1
2. Slice 3 (harness early so we can measure)
3. Slice 2
4. Slice 4

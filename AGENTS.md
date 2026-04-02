# AGENTS.md - Sigil Project Rules

## Browser-driven development requirement

The playable client **must remain automatable via OpenClaw browser tooling** at all times.

### Non-negotiables

- Add stable `data-testid` attributes for all core interactive UI controls.
- Avoid random/reactive keys that break deterministic element selection.
- Keep controls discoverable by role/name and test IDs.
- When adding new UI flows, include selectors that support browser automation.

### Minimum interaction targets

- movement controls
- turn controls
- card interaction controls
- key status readouts (turn, hp)
- combat/event log

### Verification expectation

Before claiming UI work complete, validate that the page can be:

1. opened in OpenClaw browser,
2. controls clicked reliably,
3. state changes observed in the DOM.

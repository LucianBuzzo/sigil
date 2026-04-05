# Simulation Harness

Run batch simulations for quick balance checks.

## Command

```bash
npm run qa:simulate
```

## Environment knobs

- `SIGIL_SIM_ITERS` (default `20`): number of runs
- `SIGIL_SIM_SEED_START` (default `1`): first seed
- `SIGIL_SIM_CLASS` (default `warden`): `warden|vanguard|stalker`
- `SIGIL_SIM_MAX_STEPS` (default `300`): safety cap per run
- `SIGIL_URL` (default `http://localhost:5174/sigil/`): target app URL

Example:

```bash
SIGIL_SIM_ITERS=50 SIGIL_SIM_SEED_START=100 SIGIL_SIM_CLASS=vanguard npm run qa:simulate
```

The script prints per-run stats and a summary JSON with win rate, average floor, turns, and kills.

# Agent instructions

Delhi Metro 2D (Leaflet) / 3D (Three.js) map, built phase by phase from one processed GeoJSON dataset.

**Start by reading `docs/HANDOFF.md`.** It covers the current state, how the owner works, commands, architecture, gotchas, open items and the next phase. Then read `docs/CODE_SUMMARY.md`. `CLAUDE.md` holds the same rules for Claude Code.

The essentials:

- Work one phase at a time and **don't start the next phase until the owner says so**. Close each phase with a `docs/phaseN-<topic>.md` summary and updates to `docs/DECISIONS.md`, `docs/CODE_SUMMARY.md` and `CLAUDE.md`.
- **Never invent** stations, coordinates, geometry, colours or station types. `data/processed/` is generated only; hand fixes go in `data/manual/`.
- Lat/lng enters the 3D scene only through `src/utils/projection.ts`.
- Keep "simulated", "estimated" and "nominal" labels where they apply. Keep the OpenStreetMap attribution.
- Before finishing: `npx tsc -b && npm run lint && npm test` all clean. For visual changes, check screenshots with `scripts/screenshot.mjs`.
- Don't commit or push unless asked; the owner commits.

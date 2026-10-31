# Delhi Metro 2D/3D Visualization

Interactive Delhi Metro (DMRC) map: a Leaflet 2D view (the geographic validation layer) and a Three.js 3D view, both driven by the same GeoJSON.

**Priorities, in order:** geographic accuracy → 2D validation → 3D quality.

## Current phase

Phases 1 (research), 2 (dataset build) and 3 (validation: 0 errors) are **done**. Phase 4 (Leaflet 2D map) has **not started** and is waiting for the user's go-ahead.
Track progress in `docs/CODE_SUMMARY.md`.

## Workflow rules

- Work phase by phase (roadmap: `docs/ARCHITECTURE.md` §Roadmap). **Stop at the end of each phase and wait for the user's approval** before starting the next.
- No 3D work until the 2D map passes validation, or its remaining issues are documented.
- Record every user decision in `docs/DECISIONS.md` (dated). Update `docs/CODE_SUMMARY.md` when code changes.
- **At the end of every phase, write `docs/phaseN-<topic>.md`**: a frozen summary in the same shape as `phase1-research-and-plan.md` and `phase2-dataset-build.md`. Cover the goal and result, what was built, outputs with real figures, method, open issues, limitations, how to reproduce, and the next phase. Then stop for approval.
- Never build the whole app in one step.

## Data rules

- **Never invent** stations, coordinates, geometry, colours or station types. If something can't be verified, set it to `unknown` and log it in the quality report.
- Every feature carries provenance: `source[]`, `verified`, `estimated`, `conflicts[]`.
- `data/raw/` is immutable (dated snapshots). `data/processed/` is generated only, never hand-edited. Hand fixes go in `data/manual/`.
- No coordinates hardcoded in frontend code. The frontend only reads processed GeoJSON.
- Both views read the **same** GeoJSON. Never put raw lat/lng into Three.js; project it through `src/utils/projection.ts`.
- Keep attribution: OSM data is ODbL. Show "© OpenStreetMap contributors" in the app.

## Scope (see `docs/DECISIONS.md`)

- In: DMRC's 9 lines (Red, Yellow, Blue with its Vaishali branch, Green, Violet, Pink, Magenta, Grey, Airport Express).
- Phase 4 corridors: a separate "under construction" layer, off by default.
- Out (shown in the UI only as "work in progress"): Rapid Metro Gurugram, Noida Aqua Line, Namo Bharat/RapidX.

## Stack and commands

Vite 8 · React 19 · TypeScript 7 · Tailwind 4 · oxlint · @turf/turf. Planned additions: leaflet, react-leaflet, three, @react-three/fiber, @react-three/drei, zustand.

```bash
npm run dev          # dev server
npm run build        # tsc -b (app + scripts) && vite build
npm run lint         # oxlint
npm run data:fetch   # new OSM + Wikipedia snapshots → data/raw/ (network; Overpass may be busy)
npm run data:build   # data/raw + data/manual → data/processed + data/metadata, then validates (offline; exit 1 on errors)
npm run data:validate  # validation only → data/metadata/validation_report.json
npm test             # validator self-tests
```

After any change to the data or the pipeline, run `npm run data:build && npm test`. Never ship data with validation errors.

Scripts run directly with Node 24 (`node scripts/x.ts`, no build step). Schema types live in `src/data/types.ts`.

## Docs

| File | Purpose |
|---|---|
| `docs/REQUIREMENTS.md` | What the app must do |
| `docs/ARCHITECTURE.md` | Structure, data schema, pipeline, projection, roadmap |
| `docs/DECISIONS.md` | Dated decision log |
| `docs/CODE_SUMMARY.md` | What exists in the code right now |
| `docs/phase1-research-and-plan.md` | Phase 1 research snapshot (2026-10-31): sources, licences, OSM measurements, 3D assets |
| `docs/phase2-dataset-build.md` | Phase 2 summary: pipeline, outputs, per-line figures, open quality items |
| `docs/phase3-validation.md` | Phase 3 summary: checks, bugs found, reference comparison, documented warnings |
| `docs/phaseN-*.md` | One frozen summary per later phase |
| `text.txt` | The original project brief |
| `ref_image.png` | Visual style reference for the UI and the 3D view |

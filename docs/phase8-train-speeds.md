# Phase 8 revision: sourced speed limits and simulated speed display

**Date:** 2026-11-12. The user requested an internet-verified speed display, explicitly distinguishing Airport Express and Namo Bharat from ordinary metro trains.

## Goal and result

Current simulated speed is now visible in the train table, floating 3D train labels and the follow card. Published operating maximums have source links in the follow card and station details. Design speed is labelled separately in station details. Ordinary metro/Aqua caps are explicitly nominal model settings, with published maxima left unknown.

| Service | Published operating maximum | Published design speed | Source |
|---|---:|---:|---|
| Namo Bharat RRTS | 160 km/h | 180 km/h | [NCRTC Corporate Folder, January 2025](https://ncrtc.in/wp-content/uploads/2025/01/NCRTC-Corporate-Folder_Eng-Jan-2025.pdf); [Government confirmation, July 2025](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2147920&lang=2&reg=48) |
| Airport Express | 120 km/h | Not recorded | [DMRC Annual Report 2023–24, printed page 4 / PDF page 6](https://backend.delhimetrorail.com/documents/7611/Annual-Report-2023-24-English.pdf#page=6), with the increase dated 17 September 2023 |
| Meerut Metro | 120 km/h | 135 km/h | [Alstom trainset release, 16 February 2024](https://www.alstom.com/press-releases-news/2024/2/alstom-successfully-delivers-first-trainset-meerut-metro-project); [PMO opening announcement, February 2026](https://www.pmindia.gov.in/en/news_updates/pm-to-visit-meerut-on-22-february/?comment=disable) confirms the operating maximum |

All links were checked on 2026-11-12. A design capability is never used as the simulation's operating cap. No blanket 80/90 km/h factual maximum was assigned to every DMRC/Aqua line without an adequate primary source for those lines.

## Implementation and method

- `src/constants/trainSpeeds.ts`: operating/design facts, simulation caps, source labels/URLs and checked dates. RRTS cap 160, Airport/Meerut 120; other lines have a nominal 60 km/h simulation cap and null published maximum/source.
- `src/utils/trainMotion.ts`: deterministic, rest-to-rest acceleration/cruise/braking. The peak is lowered when station spacing is too short to reach the cap. Nominal acceleration is 0.8 m/s²; nominal braking is 0.9 m/s². These are modelling choices, not measured fleet specifications.
- `trainSim.ts`: each running leg stores a motion profile; `stateAt` returns position and `speedKmh` from the same profile. Dwell speed is zero. Arrivals and round-trip cycles use the motion durations.
- `routePlanner.ts`: ride costs use the same motion helper and per-line cap plus nominal dwell. A formerly ordinary-speed test trip can now choose Airport Express and average over 40 km/h, so the assertion now compares against the selected rides' actual model caps.
- `TrainSpeed.tsx`: shared current-speed and maximum/source UI. The table marks speed as simulated; the follow card shows current speed separately from its operating maximum or nominal cap. Station details add design speed where sourced. Playback multipliers change simulated time only.

The existing nominal six-minute service headway, 30-second station dwell, three-minute terminal dwell, geometry and fleet models remain in use. Faster round trips now yield **253 simulated trains** for that nominal headway, rather than preserving the previous arbitrary count of 302.

## Results and validation

The regular Blue Line model averages approximately **33.65 km/h including dwells**. Long RRTS and Airport Express hops can reach **160** and **120 km/h** respectively; short hops brake before reaching those caps. These are outputs of a simplified model, not published journey times.

Tests cover sourced versus nominal speed metadata, long/short runs, rest at both ends, bounded continuous movement, zero-distance handling, displayed speed matching the numerical derivative of position on every real route in both directions, express caps and agreement between simulation and route estimates. Existing network routing and train tests remain active. **54 tests** pass; production build/type checking and lint pass.

Headless Chrome checks: a moving NB service displayed **160 km/h** in its label and follow card, with an independently labelled operating max of 160; regular train table rows showed changing speeds and zero at stations. An AX service displayed **120 km/h** with its separate operating maximum. No browser exceptions were reported.

## Limits and next step

These are simulated speeds, not live train telemetry. Caps do not encode local restrictions, curvature limits, gradients, signalling margins, coasting or temporary restrictions. Acceleration, dwell, waits and headways are nominal. Published maximum is a capability/operating ceiling, not an end-to-end average. Source links are available in the app for the factual limits.

```sh
npm test
npm run lint
npm run build
npm run preview -- --port 4173
```

Open `?view=3d` and follow an NB or AX train, or select an express-line station to inspect the sourced limit. Remaining journey-planner controls/alternatives, real timetables and fare work are separate. This speed revision stops here for review.

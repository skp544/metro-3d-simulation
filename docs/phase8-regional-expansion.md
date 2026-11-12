# Phase 8 extension: NCR regional networks and pedestrian interchanges

**Date:** 2026-11-12. Requested after the Phase 8 code review. Phase 9's journey-planner expansion remains separate.

## Goal and result

Add Noida Metro Aqua Line, Delhi–Meerut Namo Bharat RRTS and Meerut Metro to the shared 2D/3D dataset, with explicit passenger transfers. The result has **12 lines, 16 route branches, 288 stations, 30 shared-station interchanges, 5 pedestrian links and 378 infrastructure segments**. Every station is reachable from Rajiv Chowk, including journeys across all three new systems. There are 302 simulated trains.

| System | Operational stations | Passenger routes |
|---|---:|---|
| Aqua Line | 21 | Noida Sector 51–Depot Station |
| Namo Bharat | 15 unique | Sarai Kale Khan–Modipuram; Sarai Kale Khan–Duhai Depot |
| Meerut Metro | 12 | Meerut South–Modipuram |

RRTS serves 14 main-route stops and the additional Duhai Depot stop. It skips local-only Meerut Metro stops. Four stations serve both NCRTC services: Meerut South, Shatabdi Nagar, Begumpul and Modipuram. Planned Jangpura and Modipuram Depot stations are outside the active dataset.

## What was built

- `scripts/fetch-regional.ts`: eight canonical/reverse OSM passenger route relations, stop-area memberships and full station geometry, saved as a new immutable timestamped snapshot. It uses the main OSM API; Overpass was busy during this work.
- `data/manual/regional-lines.json`: system namespaces, colours with OSM source, branch relations, operational-status sources and expected station counts.
- `data/manual/transfers.json` → `station_transfers.geojson`: separate-station pedestrian connections, explicit sources, nominal walk times and schematic endpoint geometry.
- Shared loaders, search, filters, simulated trains and both views consume the expanded dataset. The header now identifies Delhi, Noida and Meerut; KPI line counts come from the dataset. RRTS-only names have a display suffix, retaining original names as aliases, to distinguish nearby DMRC names.
- Routing includes pedestrian edges and returns walking instructions in travel order, including journeys that only walk between two stations. Station details expose linked stations and separate-ticketing notes. Both views show dashed schematic connectors, highlighted when used by a route. Meerut's thinner 2D stroke allows the shared RRTS corridor colour to remain visible.
- Validation includes regional bounds and walking-edge integrity/connectivity. Regression tests cover all 288 destinations, stop counts/patterns, the four shared NCRTC stations, five bidirectional walking-only trips, a Greater Noida–Meerut local journey, and broken/missing connectors.

## Explicit pedestrian connections

| Endpoints | Nominal walk |
|---|---:|
| Noida Sector 52 (Blue) ↔ Noida Sector 51 (Aqua) | 8 min |
| Sarai Kale Khan–Nizamuddin (Pink) ↔ Sarai Kale Khan (Namo Bharat) | 5 min |
| New Ashok Nagar (Blue) ↔ New Ashok Nagar (Namo Bharat) | 4 min |
| Anand Vihar (Blue/Pink) ↔ Anand Vihar (Namo Bharat) | 5 min |
| Shaheed Sthal (Red) ↔ Ghaziabad (Namo Bharat) | 6 min |

Walking times are estimates, excluding a nominal three-minute train wait when another ride follows. Connectors join station-centre coordinates schematically; they are not surveyed walking routes or claims that a proposed skywalk/travelator is available.

## Sources and method

- OSM snapshot: `data/raw/regional/2026-11-12T06-02-28-701Z.json`, 2,235 elements, 91 directional stop nodes, 44 stop areas. ODbL; attribution retained. The existing DMRC and Wikipedia snapshots are preserved.
- Aqua relations 9268569/9268568; Namo Bharat 17337287/17337288 and 20268499/20268500; Meerut Metro 16661918/20268334. Track ways are chained in source relation order; stops snap forward to real track geometry. Existing gap/order checks remain active.
- [NMRC official network overview](https://www.nmrcnoida.com/) confirms 21 stations. [NMRC Sector 51/52 service document](https://www.nmrcnoida.com/Content/pdf/186/RFP.pdf) documents the separate-station connection.
- [NCRTC opening announcement, 22 February 2026](https://ncrtc.in/honble-pm-inaugurated-balance-sections-of-namo-bharat-corridor-meerut-metro/) establishes operational status. [Alstom opening release](https://www.alstom.com/sites/alstom.com/files/2026/02/23/20260223_PR_RRTS_Meerut_Metro_EN.pdf) confirms 12 operational Meerut stations and four integrated stations.
- [NCRTC interactive map](https://ncrtc.in/interactive-map/), [Oct–Nov 2025 commuter newsletter](https://ncrtc.in/wp-content/uploads/2025/12/Namo-Bharat-Times-Oct-Nov_compressed.pdf), and [Ghaziabad integration newsletter](https://ncrtc.in/wp-content/uploads/2025/10/Namo-Bharat-Times-Volume_4_NCRTC_Commuter.pdf) support the transfer pairs. These sources establish connectivity; walking durations remain nominal.

Station layouts remain unverified where there is no independent station-by-station cross-check. Source-backed status/count checks do not mark every feature verified.

## Validation and limits

`npm run data:build`: **0 errors**, **7 warnings**, 68 informational issues. The warnings are the two previously accepted length differences (Magenta/Grey) and five proximity warnings between distinct linked or nearby stations; no proximity warning is automatically converted to an interchange. All new station counts agree with the configured references. The independent validator reports one connected network.

`npm test`: **47/47** pass. TypeScript production build and lint pass. Structures remain below the existing one-million-triangle budget (approximately 744k before locally instanced sleepers). Real-GPU frame rate and a full imagery review remain pending.

Trains and journey times still use the existing generic 45 km/h cruise simulation. They are not NCRTC/NMRC schedules, and the RRTS estimate should not be treated as its real journey time. Trains and stations have generic models; shared corridor meshes may overlap. New-city surroundings were not fetched; existing city coverage remains around original DMRC stations. Rapid Metro Gurugram remains outside the dataset.

## Reproduce and next step

```sh
npm run data:fetch-regional # only when a new OSM snapshot is wanted; requires network
npm run data:build
npm test
npm run lint
npm run build
npm run preview -- --port 4173
```

Review `?view=2d&route=stn_nmrc_osm_w696191675,stn_ncrtc_a16` (Pari Chowk → Bhainsali), and switch to 3D. A walking-only example is `?view=3d&route=stn_osm_n6539894866,stn_nmrc_osm_n4950923222` (Sector 52 → Sector 51).

This extension stops here for review. No new phase, real-time feed, timetable or fare implementation was started.

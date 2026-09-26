# Architecture Specification: Golf Rounds & Index Tracker

## Overview
Golf Tracker is a local-first web application designed for recording golf rounds, tracking hole-by-hole scorecards and performance metrics (fairways, greens in regulation, putts, penalties), and automatically calculating an accurate World Handicap System (WHS) Handicap Index.

It follows the identical architectural design pattern as `vandy-pkm`:
1. **Frontend**: Lit custom web components running in Light DOM (`createRenderRoot() { return this; }`), modern fluid CSS layout (zero media queries, zero Tailwind, zero TypeScript), IndexedDB for instantaneous offline client storage, and reactive pub/sub store.
2. **Sync & Storage**: Multi-tier delta synchronization between local IndexedDB, Cloudflare D1 serverless edge endpoints (`functions/api/`), and Bun SQLite headless daemons (`headless/server.js`).
3. **Tooling & Dev Stack**: Bun runtime, Vite bundler with decorator support, local dev server (`dev-server.js`) with Better-SQLite3 emulating Cloudflare D1.

---

## Data Models

### 1. Round
```json
{
  "id": "rnd_1725984000000",
  "date": "2026-09-10",
  "course_id": "crs_pebble_beach",
  "course_name": "Pebble Beach Golf Links",
  "tee_name": "Blue",
  "course_rating": 74.7,
  "slope_rating": 143,
  "par": 72,
  "holes_played": 18,
  "score": 79,
  "differential": 3.4,
  "stats": {
    "putts": 31,
    "fairways_hit": 10,
    "fairways_total": 14,
    "gir_hit": 11,
    "gir_total": 18,
    "penalties": 1,
    "up_and_downs": 4,
    "up_and_down_attempts": 6,
    "holes": [
      { "hole": 1, "par": 4, "score": 4, "putts": 2, "fairway": true, "gir": true },
      { "hole": 2, "par": 5, "score": 5, "putts": 2, "fairway": true, "gir": true }
    ]
  },
  "notes": "Great iron play in the afternoon wind. Made birdie on #18.",
  "created_at": "2026-09-10T18:00:00.000Z",
  "updated_at": "2026-09-10T18:00:00.000Z"
}
```

### 2. Course
```json
{
  "id": "crs_pebble_beach",
  "name": "Pebble Beach Golf Links",
  "city": "Pebble Beach",
  "state": "CA",
  "tees": [
    { "name": "Black", "rating": 75.5, "slope": 145, "par": 72, "yardage": 7075 },
    { "name": "Blue", "rating": 74.7, "slope": 143, "par": 72, "yardage": 6828 },
    { "name": "Gold", "rating": 71.9, "slope": 136, "par": 72, "yardage": 6416 },
    { "name": "White", "rating": 69.8, "slope": 130, "par": 72, "yardage": 6059 }
  ],
  "created_at": "2026-09-10T18:00:00.000Z",
  "updated_at": "2026-09-10T18:00:00.000Z"
}
```

---

## World Handicap System (WHS) Handicap Index Engine

### Score Differential Formula:
$$\text{Differential} = \left(\frac{113}{\text{Slope Rating}}\right) \times (\text{Score} - \text{Course Rating})$$
*(Rounded to one decimal place)*

### WHS Calculation Matrix (Based on number of available 18-hole score differentials):
| Number of Differentials | Differentials Used | Adjustment |
|---|---|---|
| 3 | Lowest 1 | -2.0 |
| 4 | Lowest 1 | -1.0 |
| 5 | Lowest 1 | 0 |
| 6 | Average of Lowest 2 | -1.0 |
| 7 – 8 | Average of Lowest 2 | 0 |
| 9 – 11 | Average of Lowest 3 | 0 |
| 12 – 14 | Average of Lowest 4 | 0 |
| 15 – 16 | Average of Lowest 5 | 0 |
| 17 – 18 | Average of Lowest 6 | 0 |
| 19 | Average of Lowest 7 | 0 |
| 20+ | Average of Lowest 8 of most recent 20 | 0 |

---

## Application Navigation & Routes
- `#/feed` — Recent rounds list cards, quick stats overview (current index, last round, scoring avg), search & filter.
- `#/round/:id` — Detailed round reader / scorecard view with stats breakdown.
- `#/edit/:id` (or `#/edit/new`) — Round editor with auto-calculating score differential, tee selector, hole-by-hole stats.
- `#/stats` — Handicap index progression graph/table, low index, scoring breakdown (par 3/4/5 avgs, GIR %, FIR %, putts/round).
- `#/courses` — Course catalog manager to add/edit courses and tee ratings.
- `#/settings` — Sync status, manual sync triggers, export/import JSON data, debug info.

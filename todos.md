# Golf Tracker Implementation Tasks

## Phase 1: Foundation & Scaffold [x]
- [x] Create project structure and agent instructions (`AGENTS.md`, `GEMINI.md`)
- [x] Configure `package.json`, `vite.config.js`, `wrangler.toml`
- [x] Define SQLite database schema with triggers & tombstones (`schema.sql`)
- [x] Build local development server emulating Cloudflare D1 (`dev-server.js`)
- [x] Configure interactive TUI menu (`scripts/menu.js`)

## Phase 2: Core Data & Sync Engine [x]
- [x] Local-first IndexedDB storage client (`src/js/db.js`)
- [x] Reactive application store (`src/js/store.js`)
- [x] WHS Handicap Index calculation module (`src/js/handicap.js`)
- [x] Multi-tier sync engine with delta sync & broadcast channel (`src/js/sync.js`)
- [x] Router & navigation guard (`src/js/router.js`)
- [x] Cloudflare Pages serverless endpoints (`functions/api/`)
- [x] Headless Bun daemon server (`headless/server.js`)

## Phase 3: UI Web Components (Lit Light DOM) [x]
- [x] Modern fluid CSS stylesheet (`src/css/style.css`)
- [x] Micro-components: `app-btn`, `app-icon`, `app-dialog`, `app-drawer`
- [x] Rounds Feed (`app-feed`) and Round Card (`app-card`)
- [x] Scorecard & Round Editor with auto-differential calc (`app-editor`)
- [x] Round Reader / Scorecard view (`app-reader`)
- [x] Handicap Index & Performance Stats view (`app-stats`)
- [x] Course & Tees Management view (`app-courses`)
- [x] Root container (`app-home`) & App bootstrap (`src/js/main.js`)

## Next Steps / Future Enhancements [ ]
- [ ] 9-hole round combining rules (WHS 2024 expected score method)
- [x] CSV / GHIN round data import & export (`scripts/import-csv.js`)
- [ ] Advanced hole-by-hole shot tracking & strokes gained stats

# Golf Rounds & Handicap Index Tracker

A local-first, offline-capable Golf Rounds and Handicap Index tracking application built with Lit Light DOM web components, vanilla CSS fluid layouts, IndexedDB local caching, and multi-tier synchronization (Cloudflare Pages D1 + Headless Bun SQLite daemon).

## Features

- **Local-First Architecture**: Ultra-fast offline client storage powered by IndexedDB.
- **Accurate WHS Handicap Engine**: Real-time World Handicap System (WHS) Handicap Index calculation using best differentials of recent rounds.
- **Scorecard & Stats Tracking**: Track hole-by-hole scores, putts, fairways hit (FIR), greens in regulation (GIR), penalties, and round notes.
- **Course & Tee Directory**: Manage courses with multiple tee sets (Rating, Slope, Par, Yardage) for instant differential calculation.
- **Dual Server & Sync Engine**:
  - Cloudflare Pages edge functions (`functions/api/`) backed by Cloudflare D1.
  - Headless Bun daemon (`headless/server.js`) backed by local SQLite with automatic delta sync.
- **Modern Vanilla Web Standards**: Lit web components with Light DOM, modern fluid CSS (no media queries, no Tailwind), zero TypeScript compilation.
- **Interactive TUI CLI Menu**: Unified terminal dashboard for dev, building, deployment, and testing.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)

### Interactive Task Menu

Launch the interactive terminal menu to run dev servers, builds, deployments, and tests:

```bash
bun run menu
```

### Local Development

Start the development stack (Vite frontend + local backend):

```bash
bun run dev
```

Open `http://localhost:5173` in your browser.

### Headless Server Locally

To run the headless SQLite server on your local machine:

```bash
bun run server
```

## Repository Structure

- `src/` — Frontend web components (Lit Light DOM), app store, handicap engine, fluid CSS.
- `headless/` — Bun SQLite server daemon, D1 delta sync engine, automated test suite.
- `functions/` — Cloudflare Pages serverless API routes.
- `docs/` — Architecture specifications and feature planning documents.
- `todos.md` — Active task tracker and implementation checklist.
- `GEMINI.md` / `AGENTS.md` — AI assistant instructions and coding conventions.

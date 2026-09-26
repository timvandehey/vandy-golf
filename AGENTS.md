# Agent Guidelines for Golf Rounds & Index Tracker

You are a coding assistant working on Golf Tracker. Follow these rules strictly:

## Tech Stack & Code Conventions
- **Language & Frameworks**: Vanilla JS (ES Modules), Vanilla CSS, Vanilla HTML, Lit custom web components.
- **Strictly Prohibited**:
  - NO TypeScript
  - NO Tailwind or utility CSS libraries
  - NO Inline styles
  - NO CSS Media Queries (use modern fluid layouts: flexbox, CSS grid, `flex-wrap`, `minmax()`, `clamp()`, `min(95vw, ...)`)
- **Runtime**: Use `bun` as the default runtime and package manager for running servers, dev stack, and scripts.
- **Component Pattern**: Custom web components use Lit with Light DOM (`createRenderRoot() { return this; }`).
  - NO `<slot>` in Light DOM (slots do not work without Shadow DOM; use properties like `text`, `icon`, `label` or standard HTML rendering).

## Workflow Rules
- **One Technical Step at a Time**: Never give multiple steps at once. Focus purely on the current mechanics. Always provide clean copy/paste code blocks and verify before proceeding.
- **Keep Responses Concise**: Prefer short, direct answers with clickable `file://` links for modified files and symbols.
- **Task & Design Management**:
  - Active tasks/plans are tracked in `todos.md`.
  - Architecture and planning documents reside in `docs/`.
- **Behavior Rules**:
  - Ask before assuming when requirements are ambiguous.
  - Write minimum code to solve the stated problem — no preemptive abstraction.
  - Only modify files and functions directly involved in the current task.
  - Say "I'm not sure" when uncertain rather than confabulating.

## Shared Core Modules (`vandy-core`)
- Shared primitives live in `~/code/vandy-core/<module>/v<N>.js` (repo: `https://github.com/timvandehey/vandy-core.git`).
- Consumed via `@core` Vite alias (`@core/<module>/v<N>.js`).
- Never mutate active versions (e.g. `v1.js`) in-place if other apps rely on them; create `v2.js` when introducing changes.


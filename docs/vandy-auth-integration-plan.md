# Vandy Auth & SSO Integration Plan (`golf-tracker`)

## 1. Overview & Architectural Decisions

This document outlines the implementation plan to integrate **Golf Tracker** (`golf.thevandeheys.com`) into the centralized **`vandy-auth`** Single Sign-On (SSO) gateway.

### Current State vs Target Architecture

* **Current**: Relies on Cloudflare Access headers (`cf-access-authenticated-user-email`) checked solely in [`functions/api/auth/user.js`](file:///home/tim/code/golf/functions/api/auth/user.js). No local session token or role gating exists.
* **Target**:
  * Seamless Single Sign-On via the domain-wide `vandy_session` cookie (`Domain=.thevandeheys.com`).
  * Stateless HMAC-SHA256 verification via Web Crypto—zero database queries on API calls.
  * Role-based gating:
    * **`admin`**: Full access to all rounds, course catalog, player management, and settings.
    * **`editor`**: Standard read/write access (log rounds, manage courses).
    * **`viewer`**: Read-only access (view scorecards and handicap stats, mutations return 403).
    * **`none`**: Access blocked with `403 Forbidden`.
  * Automatic dev-mode bypass on `localhost`, `127.0.0.1`, and local dev hosts.

---

## 2. Backend Implementation (`functions/`)

### A. Pages Functions Middleware (`functions/_middleware.js`)
Intercepts all `/api/` requests:
1. **Dev Bypass**: If running locally, injects mock admin `{ email: 'dev@thevandeheys.com', role: 'admin' }`.
2. **Public Auth Exemption**: Allows `/api/auth/user` and `/api/auth/logout` without an active session.
3. **Cookie Verification**: Parses `vandy_session` and verifies signature using `env.AUTH_SESSION_SECRET || env.SESSION_SECRET`.
4. **App Role Gating**:
   * Evaluates role: `session.global_role === 'admin' ? 'admin' : (session.apps?.golf || 'none')`.
   * If `role === 'none'`, returns `403 Forbidden`.
   * If `role === 'viewer'` and request method is `POST`, `PUT`, or `DELETE`, returns `403 Read-Only`.
5. **Context Attachment**: Attaches `context.data.user = { userId, email, role }` and calls `context.next()`.

### B. User Identity Endpoint (`functions/api/auth/user.js`)
* Extracts session from `vandy_session` cookie statelessly.
* Returns:
  ```json
  {
    "authenticated": true,
    "email": "tim.vandehey@gmail.com",
    "role": "admin"
  }
  ```
* If unauthenticated, returns `{ "authenticated": false, "email": null, "role": null }`.

### C. Logout Endpoint (`functions/api/auth/logout.js`)
* Clears `vandy_session` with `Domain=.thevandeheys.com; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`.

---

## 3. Frontend Client Integration (`src/`)

### A. Gateway Redirect in App Bootstrap ([`src/js/main.js`](file:///home/tim/code/golf/src/js/main.js))
In `bootstrap()`:
* Fetch `/api/auth/user`.
* If `authData.authenticated === false` and on production domain (`thevandeheys.com`):
  ```javascript
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `https://auth.thevandeheys.com/login?returnUrl=${returnUrl}`;
  ```

### B. Navigation Drawer ([`src/js/components/app-drawer.js`](file:///home/tim/code/golf/src/js/components/app-drawer.js))
* Display signed-in user email in the drawer footer.
* Add a **"Sign Out"** link that calls `/api/auth/logout` and redirects to `https://auth.thevandeheys.com/login?returnUrl=...`.

### C. Settings UI ([`src/js/components/app-settings.js`](file:///home/tim/code/golf/src/js/components/app-settings.js))
* Add an **Account & Security** card displaying:
  * Signed-in user email and role badge (`admin` | `editor` | `viewer`).
  * Sign Out button.
  * For admins: button linking to `https://auth.thevandeheys.com` to manage user roles and suite apps.

---

## 4. Execution Steps

1. **Step 1: Add `_crypto.js` and `_middleware.js` to `golf/functions/`**
   * Web Crypto HMAC-SHA256 session verifier.
   * Middleware protecting `/api/rounds/*` and `/api/courses/*`.
2. **Step 2: Update `functions/api/auth/user.js` and add `logout.js`**
   * Stateless session endpoint + wildcard cookie clearer.
3. **Step 3: Update `src/js/main.js`**
   * Redirect unauthenticated visitors on `thevandeheys.com`.
4. **Step 4: Update Drawer & Settings UI**
   * Add user info badge and Sign Out button.
5. **Step 5: Build & Deploy**
   * Run `bun run deploy:prod` (`vite build && wrangler pages deploy dist`).

# D'Queens

D'Queens is a responsive bar-management app for inventory, sales, staff, notifications and audit history. The React/Vite client uses IndexedDB as its production data source and can queue work while offline. An Express API and PostgreSQL event ledger authenticate users and reconcile changes between devices.

## Requirements

- Node.js 20 or later
- PostgreSQL 14 or later (Neon is supported)
- A modern browser with IndexedDB and service-worker support

## Local setup

```sh
npm install
cp .env.example .env
```

Set `DATABASE_URL` to a **new or approved PostgreSQL database** and replace `JWT_SECRET` with a randomly generated secret of at least 32 characters. The migration creates namespaced `app_*` tables and does not alter other existing tables. Review and back up the target database before running it; do not run a schema change against an existing production database without authorization.

```sh
npm run db:migrate
```

Start the API and frontend in separate terminals:

```sh
npm run server
```

```sh
npm run dev
```

The Vite development server proxies `/api` to `http://localhost:3001`. Set `VITE_DATA_MODE=api` in `.env` for the frontend to use the API and IndexedDB in development. Without that setting, development uses the seeded mock repository. In production, API mode is the default.

Open the app, create the initial owner account, then use the owner/manager staff screen to create staff accounts. Staff do not have public registration. Owner registration also creates starter inventory categories. The first login and owner setup require an internet connection; a previously authenticated user can use their cached data offline while their offline session remains valid.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. Use the provider's SSL connection string for Neon. |
| `DATABASE_SSL` | No | `verify` (default; validate certificates) or `disable` for local PostgreSQL only. |
| `JWT_SECRET` | Yes | Random secret, at least 32 characters; used to sign access sessions. |
| `CORS_ORIGINS` | Yes for cross-origin API | Comma-separated exact frontend origins. Same-origin deployment is recommended. |
| `COOKIE_SAME_SITE` | No | `lax` by default. For a genuinely cross-site frontend/API deployment, use `none` and HTTPS, and configure credentialed CORS for the exact frontend origin. |
| `DATABASE_POOL_SIZE` | No | PostgreSQL pool maximum; defaults to `5`. |
| `PORT` | No | Local API port; defaults to `3001`. |
| `VITE_DATA_MODE` | No | Set to `api` to use the backend in development. Production uses API mode by default. |
| `VITE_API_BASE_URL` | No | API prefix; defaults to same-origin `/api`. Set only when the API is hosted separately. |

Never expose `DATABASE_URL` or `JWT_SECRET` as `VITE_*` variables.

## Deploying

For Vercel, configure the project environment variables above, use the repository's Vite build, and deploy the included `/api/[...path]` function. Point `DATABASE_URL` at the intended PostgreSQL database and run `npm run db:migrate` against that database from a trusted environment. Do not put database credentials in frontend environment variables. The recommended deployment is same-origin (`/api`), which keeps the HttpOnly session cookies and CORS configuration straightforward.

Images are compressed in the client and stored as PostgreSQL `bytea` data by this implementation; a separate object-storage provider is not configured.

## How offline data works

- The service worker precaches the app shell and displays an update prompt when a new build is available.
- In API mode, UI repository operations read and write Dexie/IndexedDB. Each queued action has a UUID, device ID, user ID and client timestamp.
- Sync starts on app launch, the browser `online` event, and every 30 seconds while online. Pending actions are sent in order and retried with backoff; the server deduplicates action UUIDs.
- Sales and stock updates are append-only events. The server sums stock events; a multi-device offline sale that produces negative stock is retained and flagged for review.
- Item images are stored as blobs locally, queued for upload, then downloaded into IndexedDB on other devices after sync.
- The API uses HttpOnly access/refresh cookies. An already-authenticated device can work offline for up to seven days; first login and reauthentication need connectivity.
- Rejected sync actions remain visible for owner review. Activity events are append-only at the database level.
- Clear Storage is owner-only, requires the app to be online with no pending or rejected actions, requires a prepared CSV/printable report, and verifies the owner's password. Sales are marked cleared; the activity and stock-event histories are retained.
- The owner can download a JSON backup of data currently on that device, including pending/rejected queue entries. This is a device-local backup, not a replacement for a server backup.

Existing prototype data in browser local storage is not automatically imported into the API/IndexedDB store. Export or preserve it before switching an active installation to API mode.

## Main file layout

```text
api/[...path].js             Vercel API entry point
server/app.js                Express routes, authentication, authorization and sync
server/schema.sql            New app_* PostgreSQL tables and append-only trigger
server/db.js                 PostgreSQL pool and transaction helper
server/migrate.js            Explicit schema migration command
src/data/localDatabase.ts    Dexie/IndexedDB schema
src/data/offlineRepository.ts
                              UI-facing local reads, writes and queue creation
src/data/syncService.ts      Queue delivery, snapshots, incremental sync and backup
src/data/apiClient.ts        Credentialed API and session refresh requests
src/components/SyncBadge.tsx Online/offline and pending-sync status
src/components/PWAUpdatePrompt.tsx
                              New-version prompt
vite.config.ts               Vite, service worker, manifest and image caching
```

## Verification

```sh
npm run lint
npm test -- --run
npm run server:test
npm run build
```

The backend validation tests do not require a database. A live API test requires an explicitly configured PostgreSQL database; the schema migration is not run automatically by the app.

## Manual offline and sync checklist

1. Install the PWA from a supported browser while online; sign in and wait for the initial sync.
2. Add items and stock as a manager. Confirm inventory, images, sales and notifications are visible after reload.
3. Open DevTools, switch to offline mode, reload the installed app, and verify it opens without a network request for app-shell assets.
4. As staff or owner, create a sale, adjust quantities and confirm it. As manager, add stock and edit an item. Verify each change is immediately visible locally and marked pending sync.
5. Reconnect. Verify pending counts clear, the server reflects the changes, and a second signed-in device receives the changes on sync.
6. For the concurrency check, use two devices with the same known stock quantity. Take both offline, sell the same remaining units on each, then reconnect both. Verify both sales are retained and the resulting negative stock is flagged for owner/manager review.
7. Test image upload while offline, then reconnect and verify the image appears on another device.
8. Deactivate a staff account as owner; when that device next syncs, verify its local session and data are cleared.
9. As owner, export a local backup and a sales CSV/print report. Verify Clear Storage is blocked offline and while actions are pending, and requires the report and correct owner password when online.

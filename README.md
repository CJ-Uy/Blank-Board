# Blank Board

A minimal personal scratchpad. No sign-up, no email, no profile. Just a quiet place for notes and ideas that syncs across all your devices in real time.

## How it works

### Authentication

Instead of a password, connect at least three dots, then tap five tiles. Patterns are sent over HTTPS and combined and hashed with SHA-256 by the login action. The resulting hash becomes your permanent user ID; raw patterns are not stored. There is no email or username to recover from -- your patterns are your key.

Sessions are stored in Cloudflare KV with a 30-day TTL.

### Real-time sync

Every user gets a dedicated [Cloudflare Durable Object](https://developers.cloudflare.com/durable-objects/) (`UserSync`). When you open Blank Board, the browser upgrades the HTTP connection to a WebSocket that routes through `/api/sync` to your personal Durable Object. The DO holds all active sockets for your account and broadcasts every change -- tab creates, updates, deletes, reorders, drops -- to every other connected window or tab instantly.

A 20-second ping keeps the connection alive since Cloudflare terminates idle WebSocket connections. If the socket drops, the client reconnects with exponential backoff (300ms up to 8s) and falls back to HTTP polling every 3 seconds to stay consistent in the meantime.

### Storage

- **Cloudflare D1** (SQLite) stores user records and tab/drop content.
- **Cloudflare KV** stores session tokens.
- **Cloudflare R2** stores file uploads.

### Stack

- [SvelteKit](https://svelte.dev/docs/kit/introduction) with the Cloudflare adapter
- [Drizzle ORM](https://orm.drizzle.team/) for database access
- [Tailwind CSS v4](https://tailwindcss.com/)
- Deployed to Cloudflare Workers

## Development

Notes save automatically, with a visible retry action if a request fails. Rich pastes show a
side-by-side styled/plain-text preview: keep the original, match the note style, or use plain
text. Continuing to type keeps the original. The toolbar also offers formatting, plain-text
copy, and `.txt` export. Unsafe HTML and page-level styles are removed using DOMPurify.

The first sign-in grid works like a phone pattern lock: drag through the dots, release, then
continue to the five-tap sequence. Number keys use the layout `7 8 9 / 4 5 6 / 1 2 3`;
Backspace undoes a step and Escape clears the current pattern. Existing patterns still work.

Find notes by title or content, pin frequently used notes, or sort by recent edits or name.
The Drop to self panel keeps a separate draft for each note, supports editable text drops,
and previews pasted images before sending. Image cards offer copy image, copy link, and download.

The top-right Pomodoro starts with 25/5/15-minute phases and a long break every four completed
focus sessions. After the initial Start, phases advance automatically with a ding. Pause/resume,
restart, skip, and durations are configurable; skipped focus sessions do not count. The active
timer and pending saves live in browser storage; completed history syncs to D1 and is charted
over 7, 30, or 90 days. Each browser/device has its own active timer. Enable sound after reload;
closed/suspended browsers cannot play timely alerts. On waking, only the elapsed phase is counted
and the next starts then, rather than manufacturing sessions during sleep.

Admin is at `/admin`, with the configured `ADMIN_USERNAME` (default `admin`) and `ADMIN_PASSWORD`.
Set `ADMIN_PASSWORD` as a Worker secret; there is no fallback password. Admin can assign private
labels to hashes, search labels/hashes, and compare per-account note/drop text bytes and actual
R2 file bytes. File totals include attachments retained for undo or shared references.

Install dependencies:

```sh
pnpm install
```

Start the dev server (runs via Wrangler to emulate the Cloudflare environment):

```sh
pnpm dev
```

Apply database migrations locally:

```sh
pnpm db:migrate:local
```

Run checks (browser tests use local D1/KV/R2 only):

```sh
pnpm check
pnpm exec vitest run --project server
pnpm exec playwright install chromium
pnpm test:e2e
```

## Building and deploying

```sh
pnpm build
wrangler deploy
```

Apply migrations to production:

```sh
pnpm exec wrangler d1 migrations apply DB --remote
```

## Infrastructure setup

Before first deploy, create the required Cloudflare resources:

```sh
wrangler d1 create blank-board
wrangler kv namespace create SESSIONS
wrangler r2 bucket create blank-board-files
```

Replace the placeholder IDs in `wrangler.jsonc` with the values returned by those commands, then set the admin password secret:

```sh
wrangler secret put ADMIN_PASSWORD
```

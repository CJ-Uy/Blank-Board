# Blank Board

A minimal personal scratchpad. No sign-up, no email, no profile. Just a quiet place for notes and ideas that syncs across all your devices in real time.

## How it works

### Authentication

Instead of a password, you draw two patterns on login. Those patterns are combined and hashed with SHA-256 on the client before anything is sent to the server. The resulting hash becomes your permanent user ID. The raw patterns never leave your device, and there is no email or username to recover from -- your patterns are your key.

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

## Building and deploying

```sh
pnpm build
wrangler deploy
```

Apply migrations to production:

```sh
pnpm db:migrate:prod
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

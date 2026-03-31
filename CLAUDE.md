You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Project: Blank Board

A minimal personal scratchpad deployed on Cloudflare Workers. No sign-up flow -- authentication uses two drawn patterns that are SHA-256 hashed on the client; the hash becomes the user ID.

### Stack

- SvelteKit with `@sveltejs/adapter-cloudflare`
- Svelte 5 (runes syntax)
- Tailwind CSS v4
- Drizzle ORM against Cloudflare D1 (SQLite)
- Cloudflare KV for session storage
- Cloudflare R2 for file uploads
- Cloudflare Durable Objects for per-user WebSocket sync
- Deployed via Wrangler

### Real-time sync architecture

Each user gets a dedicated `UserSync` Durable Object (`src/lib/server/do/UserSync.ts`). The SvelteKit route `src/routes/api/sync/+server.ts` upgrades incoming requests to WebSocket and proxies them to the user's DO instance (keyed by user ID). The DO holds all active sockets for that account and broadcasts messages between them.

The client socket logic lives in `src/lib/stores/socket.ts`. It sends a ping every 20 seconds to keep the connection alive (Cloudflare drops idle WebSocket connections), reconnects with exponential backoff on disconnect, and polls `/api/tabs` every 3 seconds as a fallback.

### Key directories

- `src/lib/server/` -- server-only code: auth, DB schema, Durable Object, R2 storage
- `src/lib/stores/` -- Svelte stores: board state, drops, socket
- `src/routes/` -- SvelteKit pages and API routes
- `drizzle/` -- SQL migration files
- `wrangler.jsonc` -- Cloudflare resource bindings (D1, KV, R2, Durable Objects)

### Dev commands

```sh
pnpm dev              # Wrangler dev server
pnpm db:migrate:local # Apply D1 migrations locally
pnpm build            # Production build
pnpm db:migrate:prod  # Apply D1 migrations to production
```

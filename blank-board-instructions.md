# Blank Board - Development Instructions

## Project Overview

Build a real-time collaborative clipboard/notepad app called **Blank Board**. Users create an account, log in, and get their own persistent board with multiple tabs. Content syncs live across devices—paste an image on your phone, see it instantly on your laptop.

## Tech Stack

- **Framework**: SvelteKit (already initialized)
- **Database**: SQLite via better-sqlite3
- **ORM**: Drizzle with drizzle-orm and drizzle-kit
- **Auth**: Lucia with @lucia-auth/adapter-drizzle
- **Real-time**: Socket.IO
- **Image Storage**: Local filesystem (./uploads) with presigned-style tokens
- **Styling**: Tailwind CSS
- **Package Manager**: pnpm

## Core Features

### 1. Authentication System

- Username/password registration and login
- Session-based auth via Lucia
- Protected routes (redirect to /login if unauthenticated)
- Logout functionality

### 2. User Board

Each authenticated user has ONE board containing:

- **Tabs** (left sidebar): Create, rename, delete, reorder tabs
- **Content Area** (center): Rich text + images for the active tab
- **Calendar Widget** (right sidebar or top-right): Shows current date/time, updates live

### 3. Tab System

- Tabs displayed vertically on the left side
- Each tab has a name (editable) and content
- "+" button to create new tab
- Right-click or icon to delete/rename
- Drag to reorder (optional, can be v2)
- Active tab highlighted

### 4. Content Editor

- Plain textarea or contenteditable div
- **Critical**: Support paste images from clipboard (Ctrl+V / Cmd+V)
  - Intercept paste event
  - If clipboard contains image, upload to server, insert inline
  - If clipboard contains text, insert normally
- Images stored as files, referenced by URL in content
- Content saves automatically on change (debounced, ~500ms)
- Content syncs in real-time across all devices logged into same account

### 5. Real-time Sync (Socket.IO)

- User connects to a room based on their user ID
- Events:
  - `tab:create` - new tab created
  - `tab:update` - tab renamed or content changed
  - `tab:delete` - tab removed
  - `tab:reorder` - tab order changed
  - `content:update` - content changed (include tab ID + new content)
- Server broadcasts to all sockets in user's room except sender
- Handle reconnection gracefully

### 6. Admin Dashboard (/admin)

Separate login (hardcoded admin credentials in env or separate admin table)

**Admin page shows:**
- Total registered users
- Total boards (same as users, 1:1)
- Total tabs across all users
- Active connections (Socket.IO connected clients)
- Database file size (to gauge when to migrate to Postgres)
- List of users with: username, tab count, last active timestamp
- Simple bar chart or stats showing activity over time (optional)

## Database Schema (Drizzle)

```typescript
// src/lib/server/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

export const tabs = sqliteTable('tabs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Untitled'),
  content: text('content').notNull().default(''),
  order: integer('order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

export const admins = sqliteTable('admins', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull()
});
```

```typescript
// src/lib/server/db.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('local.db');
export const db = drizzle(sqlite, { schema });
```

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'local.db'
  }
});
```

## File Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── db.ts           # Drizzle client instance
│   │   ├── schema.ts       # Drizzle table definitions
│   │   ├── auth.ts         # Lucia setup
│   │   ├── socket.ts       # Socket.IO server setup
│   │   └── upload.ts       # Image upload handling
│   ├── components/
│   │   ├── TabList.svelte      # Left sidebar tabs
│   │   ├── ContentEditor.svelte # Main editor with paste support
│   │   ├── Calendar.svelte     # Date/time widget
│   │   └── AdminStats.svelte   # Admin dashboard components
│   └── stores/
│       ├── board.ts        # Svelte store for tabs/content
│       └── socket.ts       # Socket.IO client store
├── routes/
│   ├── +layout.svelte
│   ├── +layout.server.ts   # Auth check, load user
│   ├── +page.svelte        # Main board (protected)
│   ├── login/
│   │   └── +page.svelte
│   ├── register/
│   │   └── +page.svelte
│   ├── logout/
│   │   └── +server.ts      # POST to logout
│   ├── admin/
│   │   ├── +page.svelte    # Admin dashboard
│   │   └── +page.server.ts # Load stats
│   └── api/
│       ├── tabs/
│       │   ├── +server.ts          # GET all, POST create
│       │   └── [id]/
│       │       └── +server.ts      # PATCH update, DELETE
│       └── upload/
│           └── +server.ts          # POST image upload
├── hooks.server.ts         # Lucia hooks, Socket.IO attach
└── app.html
drizzle/                    # Migration files (generated)
drizzle.config.ts           # Drizzle Kit config
```

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: "Blank Board" logo          [username] [Logout]        │
├────────────┬────────────────────────────────────┬───────────────┤
│            │                                    │               │
│  TABS      │         CONTENT EDITOR             │   CALENDAR    │
│            │                                    │               │
│  □ Notes   │  [editable content area]           │   December    │
│  □ Ideas   │                                    │   2024        │
│  □ Links   │  supports text + pasted images     │               │
│            │                                    │   24          │
│  [+ Add]   │                                    │   Wednesday   │
│            │                                    │               │
│            │                                    │   14:32:05    │
│            │                                    │               │
└────────────┴────────────────────────────────────┴───────────────┘

Approximate widths: Tabs 200px | Content flex-1 (max-width ~800px centered) | Calendar 200px
```

## Design Direction

**Aesthetic**: Clean, utilitarian, slightly editorial. Think Notion meets a minimal writing app.

- **Colors**: 
  - Light mode: Off-white background (#fafafa), near-black text (#1a1a1a), subtle gray borders
  - Accent: One muted color for active states (soft blue or warm amber)
- **Typography**: 
  - UI: System font stack or a clean sans like "IBM Plex Sans"
  - Content area: Slightly different feel—could use a serif or monospace for the actual notes
- **Spacing**: Generous padding, clear visual hierarchy
- **Tabs**: Minimal, text-only, subtle hover states, clear active indicator (left border or background)
- **Calendar**: Understated, large date number, smaller month/day/time

Avoid: Gradients, shadows everywhere, rounded-everything, generic SaaS look.

## Implementation Order

1. **Setup**: Install dependencies (pnpm add), configure Prisma, run initial migration
2. **Auth**: Lucia setup, login/register pages, protected routes
3. **Database**: Create Tab CRUD API routes
4. **Basic UI**: Layout with tabs sidebar, content area, calendar
5. **Tab Management**: Create, rename, delete tabs (no real-time yet)
6. **Content Editor**: Basic textarea with auto-save
7. **Image Paste**: Clipboard API integration, upload endpoint, inline display
8. **Socket.IO**: Server setup, client connection, real-time sync
9. **Admin Dashboard**: Stats page with separate auth
10. **Polish**: Loading states, error handling, responsive tweaks

## Key Implementation Details

### Image Paste Handler (ContentEditor.svelte)

```javascript
async function handlePaste(event) {
  const items = event.clipboardData?.items;
  if (!items) return;
  
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const { url } = await res.json();
      
      // Insert image at cursor position
      insertImageAtCursor(url);
      return;
    }
  }
}
```

### Socket.IO Integration with SvelteKit

Use a custom server (vite.config.ts or separate server.js) to attach Socket.IO:

```javascript
// src/lib/server/socket.ts
import { Server } from 'socket.io';

export function setupSocketIO(server) {
  const io = new Server(server, {
    cors: { origin: '*' } // Configure properly for production
  });
  
  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      socket.join(`user:${userId}`);
    });
    
    socket.on('content:update', (data) => {
      socket.to(`user:${data.userId}`).emit('content:update', data);
    });
    
    // ... other events
  });
  
  return io;
}
```

### Auto-save with Debounce

```javascript
import { debounce } from '$lib/utils';

const saveContent = debounce(async (tabId, content) => {
  await fetch(`/api/tabs/${tabId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
    headers: { 'Content-Type': 'application/json' }
  });
  socket.emit('content:update', { tabId, content, userId });
}, 500);
```

## Environment Variables (.env)

```
DATABASE_URL="local.db"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="changeme"
SOCKET_PORT=3001
```

## Commands Reference

```bash
# Install dependencies
pnpm install

# Add required packages
pnpm add drizzle-orm better-sqlite3 lucia @lucia-auth/adapter-drizzle socket.io socket.io-client
pnpm add -D drizzle-kit @types/better-sqlite3 tailwindcss postcss autoprefixer

# Generate migrations after schema changes
pnpm drizzle-kit generate

# Push schema directly to DB (dev only, no migration files)
pnpm drizzle-kit push

# Open Drizzle Studio (visual DB browser)
pnpm drizzle-kit studio

# Run dev server
pnpm dev

# Build for production
pnpm build
```

## Notes for Claude Code

- Start with getting auth working end-to-end before adding complexity
- Test image paste early—it's a core feature and can be tricky
- Socket.IO with SvelteKit requires custom server setup; don't fight the adapter, embrace it
- Keep the admin dashboard simple—it's for monitoring, not management
- Use Svelte stores for reactive state that needs to sync with Socket.IO events
- The calendar is decorative but functional—make it update every second for the time
- Drizzle queries look like: `db.select().from(tabs).where(eq(tabs.userId, userId))`
- Use `drizzle-kit push` during dev for fast iteration, `generate` for proper migrations before production
- Drizzle Studio (`pnpm drizzle-kit studio`) is great for debugging DB state

## Success Criteria

1. User can register, login, logout
2. User sees their tabs on the left, can create/rename/delete
3. Clicking a tab shows its content in the editor
4. Pasting an image uploads and displays it inline
5. Opening the app on another device shows the same content
6. Editing on one device updates the other in real-time
7. Admin can login to /admin and see usage stats
8. App runs in a Docker container deployable to Coolify

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

console.log('Running database migrations...');

const sql = postgres(DATABASE_URL);

// Create tables if they don't exist
await sql`
	CREATE TABLE IF NOT EXISTS "user" (
		id TEXT PRIMARY KEY NOT NULL,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)
`;

await sql`
	CREATE TABLE IF NOT EXISTS "session" (
		id TEXT PRIMARY KEY NOT NULL,
		user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
		expires_at TIMESTAMPTZ NOT NULL
	)
`;

await sql`
	CREATE TABLE IF NOT EXISTS "tab" (
		id TEXT PRIMARY KEY NOT NULL,
		user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
		name TEXT NOT NULL DEFAULT 'Untitled',
		content TEXT NOT NULL DEFAULT '',
		"order" INTEGER NOT NULL DEFAULT 0,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)
`;

await sql`
	CREATE TABLE IF NOT EXISTS "admin" (
		id TEXT PRIMARY KEY NOT NULL,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL
	)
`;

await sql.end();

console.log('Database migrations complete!');

// Start the server
await import('./server.js');

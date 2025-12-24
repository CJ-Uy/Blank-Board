import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

// Skip database initialization during build
if (!building) {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
}

// Ensure the directory exists for the database file
let client: Database.Database;

if (!building) {
	const dbDir = dirname(env.DATABASE_URL);
	if (dbDir && dbDir !== '.' && !existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true });
	}

	client = new Database(env.DATABASE_URL);

	// Enable WAL mode for better concurrent access
	client.pragma('journal_mode = WAL');

	// Create tables if they don't exist
	client.exec(`
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tab (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT NOT NULL DEFAULT '',
    'order' INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
);
`);
} else {
	// Create a dummy client during build to satisfy TypeScript
	client = null as unknown as Database.Database;
}

export const db = drizzle(client, { schema });

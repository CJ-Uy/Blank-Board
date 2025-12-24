import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

let db: PostgresJsDatabase<typeof schema>;

if (!building) {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

	const client = postgres(env.DATABASE_URL, {
		max: 10,
		idle_timeout: 20,
		connect_timeout: 10
	});

	db = drizzle(client, { schema });
} else {
	// Create a dummy db during build to satisfy TypeScript
	db = {} as PostgresJsDatabase<typeof schema>;
}

export { db };

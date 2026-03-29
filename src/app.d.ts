// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AppDb } from '$lib/server/db';

declare global {
	namespace App {
		interface Locals {
			user: import('$lib/server/auth').SessionValidationResult['user'];
			session: import('$lib/server/auth').SessionValidationResult['session'];
			db: import('$lib/server/db').AppDb;
		}

		interface Platform {
			env: {
				DB: D1Database;
				SESSIONS: KVNamespace;
				FILES: R2Bucket;
				USER_SYNC: DurableObjectNamespace;
				ADMIN_USERNAME?: string;
				ADMIN_PASSWORD?: string;
			};
			context: ExecutionContext;
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};

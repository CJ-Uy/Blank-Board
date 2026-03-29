import type { Handle } from '@sveltejs/kit';
// Durable Object classes must be exported from hooks.server.ts so adapter-cloudflare
// includes them in the worker bundle alongside the SvelteKit handler.
export { UserSync } from '$lib/server/do';
import * as auth from '$lib/server/auth';
import { createDb } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	// Initialise DB from D1 binding
	const d1 = event.platform?.env?.DB;
	if (!d1) {
		// In Vite dev mode (without wrangler) the binding isn't available.
		// Routes that need the DB will fail gracefully on their own.
		event.locals.db = null as unknown as typeof event.locals.db;
	} else {
		event.locals.db = createDb(d1);
	}

	// Validate session from KV
	const kv = event.platform?.env?.SESSIONS;
	const token = event.cookies.get(auth.sessionCookieName);

	if (!token || !kv || !event.locals.db) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await auth.validateSessionToken(token, kv, event.locals.db);

	if (session) {
		auth.setSessionTokenCookie(event, token);
	} else {
		auth.deleteSessionTokenCookie(event);
	}

	event.locals.user = user;
	event.locals.session = session;

	return resolve(event);
};

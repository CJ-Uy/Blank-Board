import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Upgrades the connection to a WebSocket and proxies it to the user's Durable Object.
// The DO maintains all sockets for a user and broadcasts messages between them.
export const GET: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const doNamespace = platform?.env?.USER_SYNC;
	if (!doNamespace) {
		error(503, 'Real-time sync unavailable');
	}

	const upgradeHeader = request.headers.get('Upgrade');
	if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
		error(426, 'Expected WebSocket upgrade');
	}

	// Each user gets their own Durable Object instance, keyed by userId
	const stub = doNamespace.get(doNamespace.idFromName(locals.user.id));
	return stub.fetch(request) as unknown as Response;
};

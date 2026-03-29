import { redirect } from '@sveltejs/kit';
import * as auth from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies, platform }) => {
	if (locals.session) {
		const kv = platform?.env?.SESSIONS;
		if (kv) await auth.invalidateSession(locals.session.id, kv);
		auth.deleteSessionTokenCookie({ cookies } as Parameters<typeof auth.deleteSessionTokenCookie>[0]);
	}
	redirect(302, '/login');
};

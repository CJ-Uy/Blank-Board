import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import * as auth from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		const db = createDb(platform!.env.DB);
		const kv = platform!.env.CACHE;

		const data = await request.formData();
		const patternA = data.get('patternA')?.toString().trim() ?? '';
		const patternB = data.get('patternB')?.toString().trim() ?? '';

		if (!patternA || !patternB) {
			return fail(400, { message: 'Both patterns are required' });
		}

		// Validate pattern formats (dash-separated numbers 1-9)
		if (!/^[1-9](-[1-9])+$/.test(patternA)) {
			return fail(400, { message: 'Pattern A must connect at least 3 dots' });
		}
		if (!/^[1-9](-[1-9]){4}$/.test(patternB)) {
			return fail(400, { message: 'Pattern B must have exactly 5 taps' });
		}

		// Derive the stable user key from the two patterns
		const userKey = auth.deriveUserKey(patternA, patternB);

		// Upsert user — first visit auto-creates the account
		const existing = await db
			.select({ id: table.user.id })
			.from(table.user)
			.where(eq(table.user.id, userKey));

		const now = new Date();

		if (existing.length === 0) {
			// New user — create account + default tab
			await db.insert(table.user).values({
				id: userKey,
				createdAt: now,
				lastActiveAt: now
			});
			await db.insert(table.tab).values({
				id: crypto.randomUUID(),
				userId: userKey,
				name: 'Notes',
				content: '',
				order: 0,
				createdAt: now,
				updatedAt: now
			});
		} else {
			await db
				.update(table.user)
				.set({ lastActiveAt: now })
				.where(eq(table.user.id, userKey));
		}

		const token = auth.generateSessionToken();
		await auth.createSession(token, userKey, kv);
		auth.setSessionTokenCookie({ cookies } as Parameters<typeof auth.setSessionTokenCookie>[0], token);

		redirect(302, '/');
	}
};

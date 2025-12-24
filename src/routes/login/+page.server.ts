import { fail, redirect } from '@sveltejs/kit';
import { verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import * as auth from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		if (!username || typeof username !== 'string') {
			return fail(400, { message: 'Username is required', username: '' });
		}
		if (!password || typeof password !== 'string') {
			return fail(400, { message: 'Password is required', username });
		}

		const [user] = await db.select().from(table.user).where(eq(table.user.username, username));

		if (!user) {
			return fail(400, { message: 'Invalid username or password', username });
		}

		const validPassword = await verify(user.passwordHash, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		if (!validPassword) {
			return fail(400, { message: 'Invalid username or password', username });
		}

		// Update last active timestamp
		await db
			.update(table.user)
			.set({ lastActiveAt: new Date() })
			.where(eq(table.user.id, user.id));

		const sessionToken = auth.generateSessionToken();
		const session = await auth.createSession(sessionToken, user.id);
		auth.setSessionTokenCookie({ cookies } as any, sessionToken, session.expiresAt);

		redirect(302, '/');
	}
};

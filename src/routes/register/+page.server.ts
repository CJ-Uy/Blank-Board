import { fail, redirect } from '@sveltejs/kit';
import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
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
		const confirmPassword = formData.get('confirmPassword');

		if (!username || typeof username !== 'string') {
			return fail(400, { message: 'Username is required', username: '' });
		}
		if (username.length < 3 || username.length > 31) {
			return fail(400, { message: 'Username must be between 3 and 31 characters', username });
		}
		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			return fail(400, {
				message: 'Username can only contain letters, numbers, hyphens, and underscores',
				username
			});
		}
		if (!password || typeof password !== 'string') {
			return fail(400, { message: 'Password is required', username });
		}
		if (password.length < 6) {
			return fail(400, { message: 'Password must be at least 6 characters', username });
		}
		if (password !== confirmPassword) {
			return fail(400, { message: 'Passwords do not match', username });
		}

		// Check if username already exists
		const [existingUser] = await db
			.select()
			.from(table.user)
			.where(eq(table.user.username, username));

		if (existingUser) {
			return fail(400, { message: 'Username already taken', username });
		}

		const passwordHash = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		const userId = uuid();
		const now = new Date();

		await db.insert(table.user).values({
			id: userId,
			username,
			passwordHash,
			createdAt: now,
			lastActiveAt: now
		});

		// Create a default tab for the new user
		await db.insert(table.tab).values({
			id: uuid(),
			userId,
			name: 'Notes',
			content: '',
			order: 0,
			createdAt: now,
			updatedAt: now
		});

		const sessionToken = auth.generateSessionToken();
		const session = await auth.createSession(sessionToken, userId);
		auth.setSessionTokenCookie({ cookies } as any, sessionToken, session.expiresAt);

		redirect(302, '/');
	}
};

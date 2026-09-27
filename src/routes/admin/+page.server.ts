import { fail, redirect } from '@sveltejs/kit';
import { count, sql, eq } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';
import { deriveUserKey, generateSessionToken } from '$lib/server/auth';

async function getR2StorageBytes(r2: R2Bucket) {
	let total = 0;
	const byUser = new Map<string, number>();
	let cursor: string | undefined;
	do {
		const listed: R2Objects = await r2.list({ limit: 1000, cursor });
		for (const obj of listed.objects) {
			total += obj.size;
			const userId = obj.key.split('/')[0];
			byUser.set(userId, (byUser.get(userId) ?? 0) + obj.size);
		}
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);
	return { total, byUser };
}

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const adminSession = cookies.get('admin-session');
	const kv = platform?.env?.CACHE;
	if (
		!adminSession ||
		!kv ||
		(await kv.get(`admin:${deriveUserKey(adminSession, 'admin')}`)) !== 'authenticated'
	)
		return { authenticated: false };

	const db = createDb(platform!.env.DB);

	const [userCount] = await db.select({ count: count() }).from(table.user);
	const [tabCount] = await db.select({ count: count() }).from(table.tab);

	const users = await db
		.select({
			id: table.user.id,
			label: table.user.label,
			createdAt: table.user.createdAt,
			lastActiveAt: table.user.lastActiveAt,
			tabCount: sql<number>`(SELECT COUNT(*) FROM tab WHERE tab.user_id = "user"."id")`,
			dropCount: sql<number>`(SELECT COUNT(*) FROM "drop" WHERE "drop".user_id = "user"."id")`,
			textBytes: sql<number>`coalesce((SELECT SUM(length(cast(content as blob))) FROM tab WHERE tab.user_id = "user"."id"), 0) + coalesce((SELECT SUM(length(cast(content as blob))) FROM "drop" WHERE "drop".user_id = "user"."id"), 0)`
		})
		.from(table.user)
		.orderBy(table.user.lastActiveAt);

	const storage = platform?.env?.FILES
		? await getR2StorageBytes(platform.env.FILES)
		: { total: 0, byUser: new Map<string, number>() };

	return {
		authenticated: true,
		stats: {
			totalUsers: userCount.count,
			totalTabs: tabCount.count,
			r2Bytes: storage.total
		},
		users: users.map((u) => ({
			...u,
			fileBytes: storage.byUser.get(u.id) ?? 0,
			createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
			lastActiveAt:
				u.lastActiveAt instanceof Date ? u.lastActiveAt.toISOString() : String(u.lastActiveAt)
		}))
	};
};

export const actions: Actions = {
	label: async ({ request, cookies, platform }) => {
		const token = cookies.get('admin-session');
		if (
			!token ||
			!platform?.env.CACHE ||
			(await platform.env.CACHE.get(`admin:${deriveUserKey(token, 'admin')}`)) !== 'authenticated'
		)
			return fail(401, { message: 'Please sign in as admin' });
		const data = await request.formData();
		const userId = data.get('userId');
		const label = data.get('label');
		if (typeof userId !== 'string' || typeof label !== 'string' || label.trim().length > 100)
			return fail(400, { message: 'Use a label of 100 characters or fewer' });
		const db = createDb(platform.env.DB);
		const updated = await db
			.update(table.user)
			.set({ label: label.trim() })
			.where(eq(table.user.id, userId))
			.returning({ id: table.user.id });
		if (!updated.length) return fail(404, { message: 'Account not found' });
		return { success: true, message: 'Label saved' };
	},
	login: async ({ request, cookies, platform }) => {
		const data = await request.formData();
		const username = data.get('username')?.toString().trim();
		const password = data.get('password')?.toString();

		if (!username || !password) {
			return fail(400, { message: 'Username and password are required' });
		}

		const adminUsername = platform?.env?.ADMIN_USERNAME ?? 'admin';
		const adminPassword = platform?.env?.ADMIN_PASSWORD;
		const kv = platform?.env?.CACHE;
		if (!adminPassword || !kv) return fail(503, { message: 'Admin sign-in is not configured' });

		if (username !== adminUsername || password !== adminPassword) {
			return fail(400, { message: 'Invalid credentials' });
		}

		const token = generateSessionToken();
		await kv.put(`admin:${deriveUserKey(token, 'admin')}`, 'authenticated', {
			expirationTtl: 86400
		});
		cookies.set('admin-session', token, {
			path: '/admin',
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24
		});

		return { success: true };
	},

	logout: async ({ cookies, platform }) => {
		const token = cookies.get('admin-session');
		if (token) await platform?.env?.CACHE.delete(`admin:${deriveUserKey(token, 'admin')}`);
		cookies.delete('admin-session', { path: '/admin' });
		redirect(302, '/admin');
	}
};

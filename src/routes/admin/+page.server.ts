import { fail, redirect } from '@sveltejs/kit';
import { count, sql } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

async function getR2StorageBytes(r2: R2Bucket): Promise<number> {
	let total = 0;
	let cursor: string | undefined;
	do {
		const listed: R2Objects = await r2.list({ limit: 1000, cursor });
		for (const obj of listed.objects) total += obj.size;
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);
	return total;
}

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const adminSession = cookies.get('admin-session');
	if (!adminSession) return { authenticated: false };

	const db = createDb(platform!.env.DB);

	const [userCount] = await db.select({ count: count() }).from(table.user);
	const [tabCount] = await db.select({ count: count() }).from(table.tab);

	const users = await db
		.select({
			id: table.user.id,
			createdAt: table.user.createdAt,
			lastActiveAt: table.user.lastActiveAt,
			tabCount: sql<number>`(SELECT COUNT(*) FROM tab WHERE tab.user_id = ${table.user.id})`
		})
		.from(table.user)
		.orderBy(table.user.lastActiveAt);

	const r2Bytes = platform?.env?.FILES ? await getR2StorageBytes(platform.env.FILES) : 0;

	return {
		authenticated: true,
		stats: {
			totalUsers: userCount.count,
			totalTabs: tabCount.count,
			r2Bytes
		},
		users: users.map((u) => ({
			...u,
			createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
			lastActiveAt: u.lastActiveAt instanceof Date ? u.lastActiveAt.toISOString() : String(u.lastActiveAt)
		}))
	};
};

export const actions: Actions = {
	login: async ({ request, cookies, platform }) => {
		const data = await request.formData();
		const username = data.get('username')?.toString().trim();
		const password = data.get('password')?.toString();

		if (!username || !password) {
			return fail(400, { message: 'Username and password are required' });
		}

		const adminUsername = platform?.env?.ADMIN_USERNAME ?? 'admin';
		const adminPassword = platform?.env?.ADMIN_PASSWORD ?? 'changeme';

		if (username !== adminUsername || password !== adminPassword) {
			return fail(400, { message: 'Invalid credentials' });
		}

		cookies.set('admin-session', 'authenticated', {
			path: '/admin',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24
		});

		return { success: true };
	},

	logout: async ({ cookies }) => {
		cookies.delete('admin-session', { path: '/admin' });
		redirect(302, '/admin');
	}
};

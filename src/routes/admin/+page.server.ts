import { fail, redirect } from '@sveltejs/kit';
import { count, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const adminSession = cookies.get('admin-session');

	if (!adminSession) {
		return { authenticated: false };
	}

	// Fetch stats
	const [userCount] = await db.select({ count: count() }).from(table.user);
	const [tabCount] = await db.select({ count: count() }).from(table.tab);

	// Get users with tab counts
	const users = await db
		.select({
			id: table.user.id,
			username: table.user.username,
			createdAt: table.user.createdAt,
			lastActiveAt: table.user.lastActiveAt,
			tabCount: sql<number>`(SELECT COUNT(*) FROM tab WHERE tab.user_id = ${table.user.id})`
		})
		.from(table.user)
		.orderBy(table.user.lastActiveAt);

	// Get database size from PostgreSQL
	let dbSize = 0;
	try {
		const result = await db.execute(sql`SELECT pg_database_size(current_database()) as size`);
		if (result.length > 0 && result[0].size) {
			dbSize = Number(result[0].size);
		}
	} catch {
		// Unable to get database size
	}

	// Get connected clients (from global if available)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const g = globalThis as any;
	const connectedClients = typeof g.getConnectedClients === 'function' ? g.getConnectedClients() : 0;

	return {
		authenticated: true,
		stats: {
			totalUsers: userCount.count,
			totalTabs: tabCount.count,
			connectedClients,
			dbSize
		},
		users: users.map((u) => ({
			...u,
			createdAt: u.createdAt.toISOString(),
			lastActiveAt: u.lastActiveAt.toISOString()
		}))
	};
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const formData = await request.formData();
		const username = formData.get('username')?.toString().trim();
		const password = formData.get('password')?.toString();

		if (!username || !password) {
			return fail(400, { message: 'Username and password are required' });
		}

		const adminUsername = env.ADMIN_USERNAME || 'admin';
		const adminPassword = env.ADMIN_PASSWORD || 'changeme';

		if (username !== adminUsername || password !== adminPassword) {
			return fail(400, { message: 'Invalid credentials' });
		}

		// Set a simple session cookie
		cookies.set('admin-session', 'authenticated', {
			path: '/admin',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 // 24 hours
		});

		return { success: true };
	},

	logout: async ({ cookies }) => {
		cookies.delete('admin-session', { path: '/admin' });
		redirect(302, '/admin');
	}
};

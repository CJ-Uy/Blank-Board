import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	const tabs = await db
		.select({
			id: table.tab.id,
			name: table.tab.name,
			content: table.tab.content,
			order: table.tab.order
		})
		.from(table.tab)
		.where(eq(table.tab.userId, locals.user.id))
		.orderBy(table.tab.order);

	return {
		tabs,
		user: locals.user
	};
};

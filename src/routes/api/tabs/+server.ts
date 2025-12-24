import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
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

	return json(tabs);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { id, name, content, order } = body;

	if (!id || typeof id !== 'string') {
		error(400, 'Invalid tab ID');
	}

	const now = new Date();

	await db.insert(table.tab).values({
		id,
		userId: locals.user.id,
		name: name ?? 'Untitled',
		content: content ?? '',
		order: order ?? 0,
		createdAt: now,
		updatedAt: now
	});

	// Update user's last active timestamp
	await db
		.update(table.user)
		.set({ lastActiveAt: now })
		.where(eq(table.user.id, locals.user.id));

	return json({ success: true });
};

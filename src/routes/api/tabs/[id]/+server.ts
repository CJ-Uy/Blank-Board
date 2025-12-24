import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const [tab] = await db
		.select({
			id: table.tab.id,
			name: table.tab.name,
			content: table.tab.content,
			order: table.tab.order
		})
		.from(table.tab)
		.where(and(eq(table.tab.id, params.id), eq(table.tab.userId, locals.user.id)));

	if (!tab) {
		error(404, 'Tab not found');
	}

	return json(tab);
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { name, content, order } = body;

	// Verify the tab belongs to the user
	const [existingTab] = await db
		.select()
		.from(table.tab)
		.where(and(eq(table.tab.id, params.id), eq(table.tab.userId, locals.user.id)));

	if (!existingTab) {
		error(404, 'Tab not found');
	}

	const updates: Partial<{
		name: string;
		content: string;
		order: number;
		updatedAt: Date;
	}> = {
		updatedAt: new Date()
	};

	if (name !== undefined) updates.name = name;
	if (content !== undefined) updates.content = content;
	if (order !== undefined) updates.order = order;

	await db.update(table.tab).set(updates).where(eq(table.tab.id, params.id));

	// Update user's last active timestamp
	await db
		.update(table.user)
		.set({ lastActiveAt: new Date() })
		.where(eq(table.user.id, locals.user.id));

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	// Verify the tab belongs to the user
	const [existingTab] = await db
		.select()
		.from(table.tab)
		.where(and(eq(table.tab.id, params.id), eq(table.tab.userId, locals.user.id)));

	if (!existingTab) {
		error(404, 'Tab not found');
	}

	await db.delete(table.tab).where(eq(table.tab.id, params.id));

	return json({ success: true });
};

import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import * as table from '$lib/server/db/schema';
import { deleteFile } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const [tab] = await locals.db
		.select({
			id: table.tab.id,
			name: table.tab.name,
			content: table.tab.content,
			pinned: table.tab.pinned,
			updatedAt: table.tab.updatedAt,
			order: table.tab.order
		})
		.from(table.tab)
		.where(and(eq(table.tab.id, params.id), eq(table.tab.userId, locals.user.id)));

	if (!tab) error(404, 'Tab not found');
	return json(tab);
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const body = (await request.json()) as {
		name?: string;
		content?: string;
		order?: number;
		pinned?: boolean;
	};
	const { name, content, order, pinned } = body;
	if (pinned !== undefined && typeof pinned !== 'boolean') error(400, 'Invalid pin state');
	if (name !== undefined && (typeof name !== 'string' || name.length > 200))
		error(400, 'Invalid tab name');
	if (content !== undefined && typeof content !== 'string') error(400, 'Invalid content');
	if (order !== undefined && (!Number.isInteger(order) || order < 0)) error(400, 'Invalid order');

	const [existing] = await locals.db
		.select({ id: table.tab.id, content: table.tab.content })
		.from(table.tab)
		.where(and(eq(table.tab.id, params.id), eq(table.tab.userId, locals.user.id)));

	if (!existing) error(404, 'Tab not found');

	// Editing a note must not delete attachments: undo and other notes may still reference them.

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (name !== undefined) updates.name = name;
	if (content !== undefined) updates.content = content;
	if (order !== undefined) updates.order = order;
	if (pinned !== undefined) updates.pinned = pinned;

	await locals.db.update(table.tab).set(updates).where(eq(table.tab.id, params.id));

	await locals.db
		.update(table.user)
		.set({ lastActiveAt: new Date() })
		.where(eq(table.user.id, locals.user.id));

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const [existing] = await locals.db
		.select({ id: table.tab.id, content: table.tab.content })
		.from(table.tab)
		.where(and(eq(table.tab.id, params.id), eq(table.tab.userId, locals.user.id)));

	if (!existing) error(404, 'Tab not found');

	if (platform?.env?.FILES) {
		// Clean up drop files attached to this tab
		const drops = await locals.db
			.select({ fileUrl: table.drop.fileUrl })
			.from(table.drop)
			.where(eq(table.drop.tabId, params.id));

		const dropKeys = drops
			.filter((d) => d.fileUrl?.startsWith(`/files/${locals.user!.id}/`))
			.map((d) => d.fileUrl!.replace(/^\/files\//, ''));

		await Promise.all(dropKeys.map((k) => deleteFile(platform.env!.FILES, k)));
	}

	await locals.db.delete(table.tab).where(eq(table.tab.id, params.id));
	return json({ success: true });
};

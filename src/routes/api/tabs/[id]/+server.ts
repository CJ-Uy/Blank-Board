import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import * as table from '$lib/server/db/schema';
import { deleteFile } from '$lib/server/storage';
import type { RequestHandler } from './$types';

function extractFileKeys(content: string): Set<string> {
	const keys = new Set<string>();
	const re = /\/files\/([^"'\s<>]+)/g;
	let m;
	while ((m = re.exec(content)) !== null) keys.add(m[1]);
	return keys;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const [tab] = await locals.db
		.select({ id: table.tab.id, name: table.tab.name, content: table.tab.content, order: table.tab.order })
		.from(table.tab)
		.where(and(eq(table.tab.id, params.id), eq(table.tab.userId, locals.user.id)));

	if (!tab) error(404, 'Tab not found');
	return json(tab);
};

export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const body = await request.json() as { name?: string; content?: string; order?: number };
	const { name, content, order } = body;

	const [existing] = await locals.db
		.select({ id: table.tab.id, content: table.tab.content })
		.from(table.tab)
		.where(and(eq(table.tab.id, params.id), eq(table.tab.userId, locals.user.id)));

	if (!existing) error(404, 'Tab not found');

	if (content !== undefined && platform?.env?.FILES) {
		const removed = [...extractFileKeys(existing.content ?? '')].filter(k => !extractFileKeys(content).has(k));
		await Promise.all(removed.map(k => deleteFile(platform.env.FILES, k)));
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (name !== undefined) updates.name = name;
	if (content !== undefined) updates.content = content;
	if (order !== undefined) updates.order = order;

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
		// Clean up note inline files
		if (existing.content) {
			await Promise.all([...extractFileKeys(existing.content)].map(k => deleteFile(platform.env!.FILES, k)));
		}

		// Clean up drop files attached to this tab
		const drops = await locals.db
			.select({ fileUrl: table.drop.fileUrl })
			.from(table.drop)
			.where(eq(table.drop.tabId, params.id));

		const dropKeys = drops
			.filter(d => d.fileUrl)
			.map(d => d.fileUrl!.replace(/^\/files\//, ''));

		await Promise.all(dropKeys.map(k => deleteFile(platform.env!.FILES, k)));
	}

	await locals.db.delete(table.tab).where(eq(table.tab.id, params.id));
	return json({ success: true });
};

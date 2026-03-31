import { json, error } from '@sveltejs/kit';
import { eq, and, asc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as table from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const tabId = url.searchParams.get('tabId');

	const query = locals.db
		.select({
			id: table.drop.id,
			tabId: table.drop.tabId,
			type: table.drop.type,
			content: table.drop.content,
			fileUrl: table.drop.fileUrl,
			fileName: table.drop.fileName,
			fileSize: table.drop.fileSize,
			mimeType: table.drop.mimeType,
			createdAt: table.drop.createdAt
		})
		.from(table.drop)
		.where(
			tabId
				? and(eq(table.drop.userId, locals.user.id), eq(table.drop.tabId, tabId))
				: eq(table.drop.userId, locals.user.id)
		)
		.orderBy(asc(table.drop.createdAt));

	const drops = await query;
	return json(drops);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const body = await request.json() as {
		tabId: string;
		type: string;
		content?: string;
		fileUrl?: string;
		fileName?: string;
		fileSize?: number;
		mimeType?: string;
	};

	const { tabId, type, content, fileUrl, fileName, fileSize, mimeType } = body;

	if (!tabId || !type) error(400, 'tabId and type are required');

	// Verify tab belongs to user
	const [tab] = await locals.db
		.select({ id: table.tab.id })
		.from(table.tab)
		.where(and(eq(table.tab.id, tabId), eq(table.tab.userId, locals.user.id)));

	if (!tab) error(404, 'Tab not found');

	const id = randomUUID();
	const now = new Date();

	await locals.db.insert(table.drop).values({
		id,
		tabId,
		userId: locals.user.id,
		type,
		content: content ?? null,
		fileUrl: fileUrl ?? null,
		fileName: fileName ?? null,
		fileSize: fileSize ?? null,
		mimeType: mimeType ?? null,
		createdAt: now
	});

	const created = {
		id,
		tabId,
		type,
		content: content ?? null,
		fileUrl: fileUrl ?? null,
		fileName: fileName ?? null,
		fileSize: fileSize ?? null,
		mimeType: mimeType ?? null,
		createdAt: now
	};

	return json(created, { status: 201 });
};

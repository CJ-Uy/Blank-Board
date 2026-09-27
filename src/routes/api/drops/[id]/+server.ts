import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import * as table from '$lib/server/db/schema';
import { deleteFile } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const body = (await request.json()) as { content?: unknown };
	if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 100_000)
		error(400, 'Enter text under 100,000 characters');
	const result = await locals.db
		.update(table.drop)
		.set({ content: body.content.trim() })
		.where(
			and(
				eq(table.drop.id, params.id),
				eq(table.drop.userId, locals.user.id),
				eq(table.drop.type, 'text')
			)
		)
		.returning({ id: table.drop.id });
	if (!result.length) error(404, 'Text drop not found');
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const [existing] = await locals.db
		.select({ id: table.drop.id, fileUrl: table.drop.fileUrl })
		.from(table.drop)
		.where(and(eq(table.drop.id, params.id), eq(table.drop.userId, locals.user.id)));

	if (!existing) error(404, 'Drop not found');

	if (existing.fileUrl?.startsWith(`/files/${locals.user.id}/`) && platform?.env?.FILES) {
		// fileUrl is like /files/userId/uuid.ext — extract the key after /files/
		const key = existing.fileUrl.replace(/^\/files\//, '');
		await deleteFile(platform.env.FILES, key);
	}

	await locals.db.delete(table.drop).where(eq(table.drop.id, params.id));

	return json({ success: true });
};

import { error, json } from '@sveltejs/kit';
import { and, eq, gte, desc } from 'drizzle-orm';
import { pomodoro } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const sessions = await locals.db
		.select({ id: pomodoro.id, seconds: pomodoro.seconds, completedAt: pomodoro.completedAt })
		.from(pomodoro)
		.where(
			and(
				eq(pomodoro.userId, locals.user.id),
				gte(pomodoro.completedAt, new Date(Date.now() - 366 * 86400000))
			)
		)
		.orderBy(desc(pomodoro.completedAt));
	return json(sessions);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const body = (await request.json()) as { id?: unknown; seconds?: unknown; completedAt?: unknown };
	if (
		typeof body.id !== 'string' ||
		!/^[0-9a-f-]{36}$/i.test(body.id) ||
		typeof body.seconds !== 'number' ||
		!Number.isInteger(body.seconds) ||
		body.seconds < 60 ||
		body.seconds > 10800 ||
		typeof body.completedAt !== 'number' ||
		!Number.isFinite(body.completedAt) ||
		body.completedAt < 1420070400000 ||
		body.completedAt > Date.now() + 60000
	)
		error(400, 'Invalid focus session');
	await locals.db
		.insert(pomodoro)
		.values({
			id: body.id,
			userId: locals.user.id,
			seconds: body.seconds,
			completedAt: new Date(body.completedAt)
		})
		.onConflictDoNothing();
	return json({ success: true });
};

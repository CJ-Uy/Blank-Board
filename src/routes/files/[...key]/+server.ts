import { error } from '@sveltejs/kit';
import { getFile } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const key = params.key;
	if (!key) error(400, 'Missing file key');

	const r2 = platform?.env?.FILES;
	if (!r2) error(503, 'Storage unavailable');

	try {
		const { body, contentType } = await getFile(r2, key);
		return new Response(body, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		error(404, 'File not found');
	}
};

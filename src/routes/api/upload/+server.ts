import { json, error } from '@sveltejs/kit';
import { uploadFile } from '$lib/server/storage';
import type { RequestHandler } from './$types';

const ALLOWED_TYPES: Record<string, string[]> = {
	'image/jpeg': ['jpg', 'jpeg'],
	'image/png': ['png'],
	'image/gif': ['gif'],
	'image/webp': ['webp'],
	'image/svg+xml': ['svg'],
	'application/pdf': ['pdf'],
	'video/mp4': ['mp4'],
	'video/webm': ['webm'],
	'video/quicktime': ['mov'],
	'audio/mpeg': ['mp3'],
	'audio/wav': ['wav'],
	'audio/ogg': ['ogg']
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const r2 = platform?.env?.FILES;
	if (!r2) error(503, 'Storage unavailable');

	const formData = await request.formData();
	const file = formData.get('image') ?? formData.get('file');

	if (!file || !(file instanceof File)) error(400, 'No file provided');
	if (!ALLOWED_TYPES[file.type]) error(400, `Invalid file type: ${file.type}`);
	if (file.size > MAX_FILE_SIZE) error(400, 'File too large (max 50 MB)');

	const ext = file.name.split('.').pop()?.toLowerCase() ?? ALLOWED_TYPES[file.type][0];
	const key = `${locals.user.id}/${crypto.randomUUID()}.${ext}`;

	const buffer = await file.arrayBuffer();
	const url = await uploadFile(r2, key, buffer, file.type);

	return json({ url });
};

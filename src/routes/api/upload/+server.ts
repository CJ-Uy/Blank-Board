import { json, error } from '@sveltejs/kit';
import { v4 as uuid } from 'uuid';
import { uploadFile } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// Allowed file types with their MIME types
const ALLOWED_TYPES: Record<string, string[]> = {
	// Images
	'image/jpeg': ['jpg', 'jpeg'],
	'image/png': ['png'],
	'image/gif': ['gif'],
	'image/webp': ['webp'],
	'image/svg+xml': ['svg'],
	// Documents
	'application/pdf': ['pdf'],
	// Videos
	'video/mp4': ['mp4'],
	'video/webm': ['webm'],
	'video/quicktime': ['mov'],
	// Audio
	'audio/mpeg': ['mp3'],
	'audio/wav': ['wav'],
	'audio/ogg': ['ogg']
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const formData = await request.formData();
	const file = formData.get('image') || formData.get('file');

	if (!file || !(file instanceof File)) {
		error(400, 'No file provided');
	}

	// Validate file type
	if (!ALLOWED_TYPES[file.type]) {
		error(400, `Invalid file type: ${file.type}`);
	}

	// Validate file size
	if (file.size > MAX_FILE_SIZE) {
		error(400, 'File too large (max 50MB)');
	}

	// Generate unique filename with user folder
	const ext = file.name.split('.').pop()?.toLowerCase() || ALLOWED_TYPES[file.type][0];
	const filename = `${locals.user.id}/${uuid()}.${ext}`;

	// Upload to MinIO
	const buffer = Buffer.from(await file.arrayBuffer());
	const url = await uploadFile(filename, buffer, file.type);

	return json({ url });
};

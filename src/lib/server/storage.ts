// File storage using Cloudflare R2

export async function uploadFile(
	r2: R2Bucket,
	key: string,
	body: ArrayBuffer,
	contentType: string
): Promise<string> {
	await r2.put(key, body, {
		httpMetadata: { contentType }
	});
	// R2 public URL — requires the bucket to have public access enabled
	// or serve through a Worker route /files/:key
	return `/files/${key}`;
}

export async function getFile(
	r2: R2Bucket,
	key: string
): Promise<{ body: ArrayBuffer; contentType: string }> {
	const object = await r2.get(key);
	if (!object) throw new Error('File not found');

	const body = await object.arrayBuffer();
	const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';

	return { body, contentType };
}

export async function deleteFile(r2: R2Bucket, key: string): Promise<void> {
	await r2.delete(key);
}

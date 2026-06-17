import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { HTTPException } from 'hono/http-exception';

/**
 * On-disk location for user uploads and the public URL prefix they're served
 * under. Kept in one place so the upload route and the static file handler
 * (see app.ts) agree. Paths are relative to the server's working directory.
 */
export const UPLOAD_DIR = './uploads';
export const UPLOAD_ROUTE = '/uploads';

// Accepted image content types and the file extension we store them under.
const IMAGE_TYPES: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validate and persist an uploaded image (news cover, profile avatar, …) to
 * {@link UPLOAD_DIR}, returning the public path ({@link UPLOAD_ROUTE}/…) to store.
 * Throws the standard HTTPException for a missing file, unsupported type, or one
 * that's too large.
 */
export async function saveUploadedImage(file: unknown): Promise<string> {
	if (!(file instanceof File)) throw new HTTPException(400, { message: 'No file provided' });

	const ext = IMAGE_TYPES[file.type];
	if (!ext) throw new HTTPException(415, { message: 'Unsupported image type (png, jpg, webp, gif)' });
	if (file.size > MAX_IMAGE_BYTES) throw new HTTPException(413, { message: 'Image too large (max 5 MB)' });

	await mkdir(UPLOAD_DIR, { recursive: true });
	const name = `${randomUUID()}.${ext}`;
	await writeFile(`${UPLOAD_DIR}/${name}`, Buffer.from(await file.arrayBuffer()));
	return `${UPLOAD_ROUTE}/${name}`;
}

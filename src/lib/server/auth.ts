import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import type { AppDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

export const sessionCookieName = 'auth-session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Derives a stable user ID from the two pattern sequences.
// Called client-side to avoid sending raw patterns to the server.
export function deriveUserKey(patternA: string, patternB: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(`${patternA}|${patternB}`)));
}

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	return encodeBase64url(bytes);
}

// Sessions are stored in KV: key = "session:{token_hash}", value = userId
export async function createSession(
	token: string,
	userId: string,
	kv: KVNamespace
): Promise<string> {
	const tokenHash = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	await kv.put(`session:${tokenHash}`, userId, { expirationTtl: SESSION_TTL_SECONDS });
	return tokenHash;
}

export async function validateSessionToken(
	token: string,
	kv: KVNamespace,
	db: AppDb
): Promise<SessionValidationResult> {
	const tokenHash = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const userId = await kv.get(`session:${tokenHash}`);

	if (!userId) {
		return { session: null, user: null };
	}

	const [user] = await db
		.select({ id: table.user.id })
		.from(table.user)
		.where(eq(table.user.id, userId));

	if (!user) {
		await kv.delete(`session:${tokenHash}`);
		return { session: null, user: null };
	}

	return {
		session: { id: tokenHash, userId },
		user: { id: user.id }
	};
}

export type SessionValidationResult =
	| { session: { id: string; userId: string }; user: { id: string } }
	| { session: null; user: null };

export async function invalidateSession(tokenHash: string, kv: KVNamespace): Promise<void> {
	await kv.delete(`session:${tokenHash}`);
}

export function setSessionTokenCookie(event: RequestEvent, token: string): void {
	event.cookies.set(sessionCookieName, token, {
		maxAge: SESSION_TTL_SECONDS,
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'strict'
	});
}

export function deleteSessionTokenCookie(event: RequestEvent): void {
	event.cookies.delete(sessionCookieName, { path: '/' });
}

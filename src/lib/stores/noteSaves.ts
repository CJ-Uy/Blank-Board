import { writable } from 'svelte/store';
import { emitContentUpdate } from './socket';

export const saveStates = writable<Record<string, 'saving' | 'error'>>({});
export const pendingNotes = new Map<string, string>();
export let editVersion = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Set<string>();

export function queueNote(tabId: string, content: string) {
	editVersion++;
	pendingNotes.set(tabId, content);
	saveStates.update((states) => ({ ...states, [tabId]: 'saving' }));
	clearTimeout(timers.get(tabId));
	timers.set(
		tabId,
		setTimeout(() => void saveNote(tabId), 500)
	);
}

export async function saveNote(tabId: string) {
	clearTimeout(timers.get(tabId));
	timers.delete(tabId);
	if (!pendingNotes.has(tabId) || inFlight.has(tabId)) return;
	const content = pendingNotes.get(tabId)!;
	inFlight.add(tabId);
	saveStates.update((states) => ({ ...states, [tabId]: 'saving' }));
	try {
		const body = JSON.stringify({ content });
		const response = await fetch(`/api/tabs/${tabId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body,
			// Browsers cap keepalive payloads at 64 KiB; larger notes use normal requests.
			keepalive: new TextEncoder().encode(body).byteLength < 60_000
		});
		if (!response.ok) throw new Error('Save failed');
		emitContentUpdate(tabId, content);
		if (pendingNotes.get(tabId) === content) {
			pendingNotes.delete(tabId);
			saveStates.update((states) => {
				const next = { ...states };
				delete next[tabId];
				return next;
			});
		}
	} catch {
		saveStates.update((states) => ({ ...states, [tabId]: 'error' }));
		// Keep the draft in memory; retry explicitly or when connectivity returns.
		return;
	} finally {
		inFlight.delete(tabId);
	}
	if (pendingNotes.has(tabId)) void saveNote(tabId);
}

export function flushNotes() {
	for (const tabId of pendingNotes.keys()) void saveNote(tabId);
}

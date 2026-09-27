import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
vi.mock('./socket', () => ({ emitContentUpdate: vi.fn() }));
import { queueNote, saveNote, pendingNotes, saveStates } from './noteSaves';

beforeEach(() => {
	vi.useFakeTimers();
	pendingNotes.clear();
	saveStates.set({});
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

test('large notes do not exceed the browser keepalive limit', async () => {
	const fetch = vi.fn().mockResolvedValue({ ok: true });
	vi.stubGlobal('fetch', fetch);
	queueNote('large', '字'.repeat(30000));
	await saveNote('large');
	expect(fetch.mock.calls[0][1].keepalive).toBe(false);
	expect(pendingNotes.size).toBe(0);
});

test('switching tabs does not cancel a pending save', async () => {
	const fetch = vi.fn().mockResolvedValue({ ok: true });
	vi.stubGlobal('fetch', fetch);
	queueNote('a', 'first');
	queueNote('b', 'second');
	await vi.advanceTimersByTimeAsync(500);
	expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/tabs/a', '/api/tabs/b']);
	expect(pendingNotes.size).toBe(0);
});

test('edits made during a request are saved in order', async () => {
	let complete!: (response: { ok: boolean }) => void;
	const fetch = vi
		.fn()
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					complete = resolve;
				})
		)
		.mockResolvedValue({ ok: true });
	vi.stubGlobal('fetch', fetch);
	queueNote('a', 'first');
	const saving = saveNote('a');
	queueNote('a', 'newest');
	complete({ ok: true });
	await saving;
	await vi.advanceTimersByTimeAsync(500);
	expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body).content)).toEqual([
		'first',
		'newest'
	]);
	expect(pendingNotes.size).toBe(0);
});

test('failed saves retain the draft and can be retried', async () => {
	const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true });
	vi.stubGlobal('fetch', fetch);
	queueNote('a', 'keep me');
	await saveNote('a');
	expect(pendingNotes.get('a')).toBe('keep me');
	expect(get(saveStates).a).toBe('error');
	await saveNote('a');
	expect(pendingNotes.size).toBe(0);
	expect(get(saveStates).a).toBeUndefined();
});

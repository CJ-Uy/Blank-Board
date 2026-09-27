import { expect, it, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { dropStore, type ClientDrop } from './drops';

afterEach(() => {
	dropStore.clear();
	vi.unstubAllGlobals();
});
it('reload removes drops deleted elsewhere and preserves edits arriving during a fetch', async () => {
	const drop: ClientDrop = {
		id: 'a',
		tabId: 'tab',
		type: 'text',
		content: 'old',
		createdAt: new Date()
	};
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([drop]))));
	await dropStore.loadDrops('tab');
	let finish!: (value: Response) => void;
	vi.stubGlobal(
		'fetch',
		vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					finish = resolve;
				})
		)
	);
	const loading = dropStore.loadDrops('tab');
	dropStore.updateDrop('a', 'new');
	finish(new Response(JSON.stringify([drop])));
	await loading;
	expect(get(dropStore).drops[0].content).toBe('new');
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]')));
	await dropStore.loadDrops('tab');
	expect(get(dropStore).drops).toEqual([]);
});

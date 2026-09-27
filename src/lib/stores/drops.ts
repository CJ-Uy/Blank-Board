import { writable } from 'svelte/store';

export type ClientDrop = {
	id: string;
	tabId: string;
	type: 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'file';
	content?: string | null;
	fileUrl?: string | null;
	fileName?: string | null;
	fileSize?: number | null;
	mimeType?: string | null;
	createdAt: Date;
};

type DropsState = {
	tabId: string | null;
	drops: ClientDrop[];
};

function createDropsStore() {
	const { subscribe, update, set } = writable<DropsState>({ tabId: null, drops: [] });
	let loadVersion = 0;

	async function loadDrops(tabId: string) {
		const version = ++loadVersion;
		let atStart = new Map<string, ClientDrop>();
		update((state) => {
			if (state.tabId !== tabId) return { tabId, drops: [] };
			atStart = new Map(state.drops.map((d) => [d.id, d]));
			return state;
		});
		const res = await fetch(`/api/drops?tabId=${encodeURIComponent(tabId)}`);
		if (!res.ok) throw new Error('Could not load drops');
		const raw = (await res.json()) as ClientDrop[];
		// Ensure createdAt is a Date
		const drops = raw.map((d) => ({ ...d, createdAt: new Date(d.createdAt) }));
		if (version === loadVersion)
			update((state) => {
				const current = new Map(state.drops.map((d) => [d.id, d]));
				return {
					tabId,
					drops: [
						...drops
							.filter((d) => !atStart.has(d.id) || current.has(d.id))
							.map((d) =>
								current.has(d.id) && current.get(d.id) !== atStart.get(d.id)
									? current.get(d.id)!
									: d
							),
						...state.drops.filter(
							(d) => !atStart.has(d.id) && !drops.some((item) => item.id === d.id)
						)
					]
				};
			});
	}

	function addDrop(drop: ClientDrop) {
		update((state) => {
			// Only add if it belongs to the currently loaded tab
			if (state.tabId !== drop.tabId) return state;
			// Avoid duplicates (own emit + server echo)
			if (state.drops.some((d) => d.id === drop.id)) return state;
			const normalized = { ...drop, createdAt: new Date(drop.createdAt) };
			return { ...state, drops: [...state.drops, normalized] };
		});
	}

	function removeDrop(id: string) {
		update((state) => ({ ...state, drops: state.drops.filter((d) => d.id !== id) }));
	}
	function updateDrop(id: string, content: string) {
		update((state) => ({
			...state,
			drops: state.drops.map((drop) => (drop.id === id ? { ...drop, content } : drop))
		}));
	}

	return {
		subscribe,
		loadDrops,
		addDrop,
		removeDrop,
		updateDrop,
		clear: () => {
			loadVersion++;
			set({ tabId: null, drops: [] });
		}
	};
}

export const dropStore = createDropsStore();

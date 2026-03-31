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

	async function loadDrops(tabId: string) {
		const res = await fetch(`/api/drops?tabId=${encodeURIComponent(tabId)}`);
		if (!res.ok) return;
		const raw = await res.json() as ClientDrop[];
		// Ensure createdAt is a Date
		const drops = raw.map(d => ({ ...d, createdAt: new Date(d.createdAt) }));
		set({ tabId, drops });
	}

	function addDrop(drop: ClientDrop) {
		update(state => {
			// Only add if it belongs to the currently loaded tab
			if (state.tabId !== drop.tabId) return state;
			// Avoid duplicates (own emit + server echo)
			if (state.drops.some(d => d.id === drop.id)) return state;
			const normalized = { ...drop, createdAt: new Date(drop.createdAt) };
			return { ...state, drops: [...state.drops, normalized] };
		});
	}

	function removeDrop(id: string) {
		update(state => ({ ...state, drops: state.drops.filter(d => d.id !== id) }));
	}

	return { subscribe, loadDrops, addDrop, removeDrop };
}

export const dropStore = createDropsStore();

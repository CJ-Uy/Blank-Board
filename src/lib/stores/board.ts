import { writable, derived, get } from 'svelte/store';
import type { Tab } from '$lib/server/db/schema';

export type ClientTab = Pick<Tab, 'id' | 'name' | 'content' | 'order'>;

function createBoardStore() {
	const tabs = writable<ClientTab[]>([]);
	const activeTabId = writable<string | null>(null);

	const activeTab = derived([tabs, activeTabId], ([$tabs, $activeTabId]) => {
		return $tabs.find((tab) => tab.id === $activeTabId) ?? null;
	});

	const sortedTabs = derived(tabs, ($tabs) => {
		return [...$tabs].sort((a, b) => a.order - b.order);
	});

	function setTabs(newTabs: ClientTab[]) {
		tabs.set(newTabs);
		const currentActiveId = get(activeTabId);
		if (!newTabs.find((t) => t.id === currentActiveId) && newTabs.length > 0) {
			activeTabId.set(newTabs[0].id);
		}
	}

	function addTab(tab: ClientTab) {
		tabs.update((current) => [...current, tab]);
		activeTabId.set(tab.id);
	}

	function updateTab(id: string, updates: Partial<Pick<ClientTab, 'name' | 'content'>>) {
		tabs.update((current) =>
			current.map((tab) => (tab.id === id ? { ...tab, ...updates } : tab))
		);
	}

	function removeTab(id: string) {
		tabs.update((current) => {
			const filtered = current.filter((tab) => tab.id !== id);
			const currentActiveId = get(activeTabId);
			if (currentActiveId === id && filtered.length > 0) {
				activeTabId.set(filtered[0].id);
			} else if (filtered.length === 0) {
				activeTabId.set(null);
			}
			return filtered;
		});
	}

	function setActiveTab(id: string) {
		activeTabId.set(id);
	}

	function reorderTabs(newOrder: ClientTab[]) {
		tabs.set(newOrder.map((tab, index) => ({ ...tab, order: index })));
	}

	return {
		tabs: { subscribe: tabs.subscribe },
		activeTabId: { subscribe: activeTabId.subscribe },
		activeTab,
		sortedTabs,
		setTabs,
		addTab,
		updateTab,
		removeTab,
		setActiveTab,
		reorderTabs
	};
}

export const boardStore = createBoardStore();

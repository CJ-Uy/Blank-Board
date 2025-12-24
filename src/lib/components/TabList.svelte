<script lang="ts">
	import { boardStore, type ClientTab } from '$lib/stores/board';
	import { emitTabCreate, emitTabDelete, emitTabUpdate } from '$lib/stores/socket';
	import { generateId } from '$lib/utils';

	let editingTabId = $state<string | null>(null);
	let editingName = $state('');
	let contextMenuTab = $state<string | null>(null);
	let contextMenuPosition = $state({ x: 0, y: 0 });

	const sortedTabs = boardStore.sortedTabs;
	const activeTabId = boardStore.activeTabId;

	async function createTab() {
		const newTab: ClientTab = {
			id: generateId(),
			name: 'Untitled',
			content: '',
			order: $sortedTabs.length
		};

		boardStore.addTab(newTab);

		const response = await fetch('/api/tabs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newTab)
		});

		if (response.ok) {
			emitTabCreate(newTab);
		}
	}

	function selectTab(id: string) {
		boardStore.setActiveTab(id);
	}

	function startEditing(tab: ClientTab, event: MouseEvent) {
		event.stopPropagation();
		editingTabId = tab.id;
		editingName = tab.name;
	}

	async function saveTabName() {
		if (!editingTabId) return;

		const trimmedName = editingName.trim() || 'Untitled';
		boardStore.updateTab(editingTabId, { name: trimmedName });

		await fetch(`/api/tabs/${editingTabId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: trimmedName })
		});

		emitTabUpdate(editingTabId, { name: trimmedName });
		editingTabId = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			saveTabName();
		} else if (event.key === 'Escape') {
			editingTabId = null;
		}
	}

	function showContextMenu(tabId: string, event: MouseEvent) {
		event.preventDefault();
		contextMenuTab = tabId;
		contextMenuPosition = { x: event.clientX, y: event.clientY };
	}

	function hideContextMenu() {
		contextMenuTab = null;
	}

	async function deleteTab(tabId: string) {
		hideContextMenu();
		boardStore.removeTab(tabId);

		await fetch(`/api/tabs/${tabId}`, {
			method: 'DELETE'
		});

		emitTabDelete(tabId);
	}

	function renameTab(tabId: string) {
		hideContextMenu();
		const tab = $sortedTabs.find((t) => t.id === tabId);
		if (tab) {
			editingTabId = tabId;
			editingName = tab.name;
		}
	}
</script>

<svelte:window onclick={hideContextMenu} />

<div class="flex h-full w-[200px] flex-col border-r border-gray-200 bg-white">
	<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
		<span class="text-xs font-medium tracking-wide text-gray-500 uppercase">Tabs</span>
		<button
			onclick={createTab}
			class="flex h-6 w-6 items-center justify-center text-gray-400 transition-colors hover:text-[#1a1a1a]"
			title="New tab"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
				></path>
			</svg>
		</button>
	</div>

	<nav class="flex-1 overflow-y-auto py-2">
		{#each $sortedTabs as tab (tab.id)}
			<button
				onclick={() => selectTab(tab.id)}
				oncontextmenu={(e) => showContextMenu(tab.id, e)}
				ondblclick={(e) => startEditing(tab, e)}
				class="group flex w-full items-center px-4 py-2 text-left text-sm transition-colors
					{$activeTabId === tab.id
					? 'border-l-2 border-[#1a1a1a] bg-gray-50 text-[#1a1a1a]'
					: 'border-l-2 border-transparent text-gray-600 hover:bg-gray-50 hover:text-[#1a1a1a]'}"
			>
				{#if editingTabId === tab.id}
					<input
						type="text"
						bind:value={editingName}
						onblur={saveTabName}
						onkeydown={handleKeydown}
						onclick={(e) => e.stopPropagation()}
						class="w-full border-0 bg-transparent p-0 text-sm focus:ring-0"
						autofocus
					/>
				{:else}
					<span class="truncate">{tab.name}</span>
				{/if}
			</button>
		{/each}
	</nav>
</div>

{#if contextMenuTab}
	<div
		class="fixed z-50 min-w-[120px] rounded border border-gray-200 bg-white py-1 shadow-lg"
		style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
	>
		<button
			onclick={() => renameTab(contextMenuTab!)}
			class="flex w-full items-center px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
		>
			Rename
		</button>
		<button
			onclick={() => deleteTab(contextMenuTab!)}
			class="flex w-full items-center px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
		>
			Delete
		</button>
	</div>
{/if}

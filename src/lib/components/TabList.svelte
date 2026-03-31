<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { boardStore, type ClientTab } from '$lib/stores/board';
	import { emitTabCreate, emitTabDelete, emitTabUpdate } from '$lib/stores/socket';
	import { generateId } from '$lib/utils';

	interface Props {
		onTabSelect?: () => void;
	}

	let { onTabSelect }: Props = $props();

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
		onTabSelect?.();
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

	async function deleteTab(tabId: string, event?: MouseEvent) {
		event?.stopPropagation();
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

	// Calendar / clock
	let now = $state(new Date());
	let clockInterval: ReturnType<typeof setInterval>;

	const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
	const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];

	const currentDay = $derived(now.getDate());
	const currentMonth = $derived(now.getMonth());
	const currentYear = $derived(now.getFullYear());
	const monthName = $derived(monthNames[currentMonth]);
	const time = $derived(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));

	const calendarDays = $derived.by(() => {
		const firstDay = new Date(currentYear, currentMonth, 1);
		const lastDay = new Date(currentYear, currentMonth + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDay = firstDay.getDay();
		const days: { day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
		const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
		for (let i = startingDay - 1; i >= 0; i--) {
			days.push({ day: prevMonthLastDay - i, isCurrentMonth: false, isToday: false });
		}
		for (let i = 1; i <= daysInMonth; i++) {
			days.push({ day: i, isCurrentMonth: true, isToday: i === currentDay });
		}
		const remaining = 42 - days.length;
		for (let i = 1; i <= remaining; i++) {
			days.push({ day: i, isCurrentMonth: false, isToday: false });
		}
		return days;
	});

	onMount(() => { clockInterval = setInterval(() => { now = new Date(); }, 1000); });
	onDestroy(() => { if (clockInterval) clearInterval(clockInterval); });
</script>

<svelte:window onclick={hideContextMenu} />

<div
	class="flex h-full w-[200px] flex-col border-r border-(--border-color) bg-(--bg-secondary)"
>
	<div
		class="flex items-center justify-between border-b border-(--border-color) px-4 py-3"
	>
		<span class="text-xs font-medium tracking-wide uppercase text-(--text-secondary)"
			>Tabs</span
		>
		<button
			onclick={createTab}
			class="flex h-6 w-6 items-center justify-center text-(--text-muted) transition-colors hover:text-(--text-primary)"
			title="New tab"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
				></path>
			</svg>
		</button>
	</div>

	<nav class="overflow-y-auto py-2 min-h-0" style="flex: 1 1 0;">
		{#each $sortedTabs as tab (tab.id)}
			<div
				class="group relative flex w-full items-center transition-colors
					{$activeTabId === tab.id
					? 'border-l-2 border-(--accent-color) bg-(--hover-bg) text-(--text-primary)'
					: 'border-l-2 border-transparent text-(--text-secondary) hover:bg-(--hover-bg) hover:text-(--text-primary)'}"
			>
				<button
					onclick={() => selectTab(tab.id)}
					oncontextmenu={(e) => showContextMenu(tab.id, e)}
					ondblclick={(e) => startEditing(tab, e)}
					class="flex-1 px-4 py-2 text-left text-sm"
				>
					{#if editingTabId === tab.id}
						<input
							type="text"
							bind:value={editingName}
							onblur={saveTabName}
							onkeydown={handleKeydown}
							onclick={(e) => e.stopPropagation()}
							class="w-full border-0 bg-transparent p-0 text-sm text-(--text-primary) focus:ring-0"
							autofocus
						/>
					{:else}
						<span class="truncate">{tab.name}</span>
					{/if}
				</button>

				<!-- Delete button - visible on hover -->
				<button
					onclick={(e) => deleteTab(tab.id, e)}
					class="mr-2 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-red-100 group-hover:opacity-100 dark:hover:bg-red-900/30"
					title="Delete tab"
				>
					<svg
						class="h-3.5 w-3.5 text-red-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		{/each}
	</nav>

	<!-- Calendar + clock -->
	<div class="shrink-0 border-t border-(--border-color) px-3 py-3">
		<div class="mb-1.5 flex items-baseline gap-1">
			<span class="text-xs font-medium text-(--text-primary)">{monthName}</span>
			<span class="text-xs text-(--text-muted)">{currentYear}</span>
		</div>
		<div class="mb-1 grid grid-cols-7">
			{#each dayNames as d}
				<div class="py-0.5 text-center text-[10px] font-medium text-(--text-muted)">{d}</div>
			{/each}
		</div>
		<div class="grid grid-cols-7">
			{#each calendarDays as { day, isCurrentMonth, isToday }}
				<div class="flex h-6 w-full items-center justify-center text-[10px]
					{isToday ? 'rounded-full bg-(--accent-color) font-medium text-(--bg-secondary)' : isCurrentMonth ? 'text-(--text-primary)' : 'text-(--text-muted)'}">
					{day}
				</div>
			{/each}
		</div>
		<p class="mt-2 text-center font-mono text-base tabular-nums text-(--text-primary)">{time}</p>
	</div>
</div>

{#if contextMenuTab}
	<div
		class="fixed z-50 min-w-[120px] rounded border border-(--border-color) bg-(--bg-secondary) py-1 shadow-lg"
		style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
	>
		<button
			onclick={() => renameTab(contextMenuTab!)}
			class="flex w-full items-center px-3 py-2 text-left text-sm text-(--text-primary) hover:bg-(--hover-bg)"
		>
			Rename
		</button>
		<button
			onclick={() => deleteTab(contextMenuTab!)}
			class="flex w-full items-center px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
		>
			Delete
		</button>
	</div>
{/if}

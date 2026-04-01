<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { boardStore, type ClientTab } from '$lib/stores/board';
	import { emitTabCreate, emitTabDelete, emitTabUpdate, emitTabsReorder } from '$lib/stores/socket';
	import { generateId } from '$lib/utils';

	interface Props {
		onTabSelect?: () => void;
	}

	let { onTabSelect }: Props = $props();

	let editingTabId = $state<string | null>(null);
	let editingName = $state('');

	// Three-dots dropdown
	let openMenuTabId = $state<string | null>(null);
	let menuRect = $state<DOMRect | null>(null);

	// Drag and drop
	let draggedTabId = $state<string | null>(null);
	let dragOverTabId = $state<string | null>(null);

	// Input ref for focusing on rename start
	let renameInputEl = $state<HTMLInputElement | null>(null);
	$effect(() => {
		if (editingTabId && renameInputEl) {
			renameInputEl.focus();
			renameInputEl.select();
		}
	});

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

	function startEditing(tab: ClientTab) {
		closeMenu();
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

	function handleRenameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			saveTabName();
		} else if (event.key === 'Escape') {
			editingTabId = null;
		}
	}

	function toggleMenu(tabId: string, event: MouseEvent) {
		event.stopPropagation();
		if (openMenuTabId === tabId) {
			openMenuTabId = null;
			menuRect = null;
		} else {
			openMenuTabId = tabId;
			menuRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		}
	}

	function closeMenu() {
		openMenuTabId = null;
		menuRect = null;
	}

	async function deleteTab(tabId: string) {
		closeMenu();
		boardStore.removeTab(tabId);

		await fetch(`/api/tabs/${tabId}`, {
			method: 'DELETE'
		});

		emitTabDelete(tabId);
	}

	function renameTab(tabId: string) {
		const tab = $sortedTabs.find((t) => t.id === tabId);
		if (tab) startEditing(tab);
	}

	// Drag and drop
	function handleDragStart(tabId: string, event: DragEvent) {
		draggedTabId = tabId;
		event.dataTransfer!.effectAllowed = 'move';
	}

	function handleDragOver(tabId: string, event: DragEvent) {
		event.preventDefault();
		event.dataTransfer!.dropEffect = 'move';
		dragOverTabId = tabId;
	}

	function handleDragLeave(event: DragEvent) {
		// Only clear if leaving to outside the list
		if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) {
			dragOverTabId = null;
		}
	}

	async function handleDrop(targetTabId: string, event: DragEvent) {
		event.preventDefault();
		if (!draggedTabId || draggedTabId === targetTabId) {
			draggedTabId = null;
			dragOverTabId = null;
			return;
		}

		const tabs = [...$sortedTabs];
		const fromIndex = tabs.findIndex((t) => t.id === draggedTabId);
		const toIndex = tabs.findIndex((t) => t.id === targetTabId);

		const [moved] = tabs.splice(fromIndex, 1);
		tabs.splice(toIndex, 0, moved);

		const reordered = tabs.map((tab, index) => ({ ...tab, order: index }));
		boardStore.reorderTabs(reordered);
		emitTabsReorder(reordered);

		await fetch('/api/tabs', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(reordered.map((t) => ({ id: t.id, order: t.order })))
		});

		draggedTabId = null;
		dragOverTabId = null;
	}

	function handleDragEnd() {
		draggedTabId = null;
		dragOverTabId = null;
	}

	// Calendar / clock
	let now = $state(new Date());
	let clockInterval: ReturnType<typeof setInterval>;

	const monthNames = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	const currentDay = $derived(now.getDate());
	const currentMonth = $derived(now.getMonth());
	const currentYear = $derived(now.getFullYear());
	const monthName = $derived(monthNames[currentMonth]);
	const time = $derived(
		now.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		})
	);

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

	onMount(() => {
		clockInterval = setInterval(() => {
			now = new Date();
		}, 1000);
	});
	onDestroy(() => {
		if (clockInterval) clearInterval(clockInterval);
	});
</script>

<svelte:window onclick={closeMenu} />

<div class="flex h-full w-[200px] flex-col border-r border-(--border-color) bg-(--bg-secondary)">
	<div class="flex items-center justify-between border-b border-(--border-color) px-4 py-3">
		<span class="text-xs font-medium tracking-wide uppercase text-(--text-secondary)">Tabs</span>
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
				class="group relative flex w-full select-none items-center transition-colors
					{$activeTabId === tab.id
					? 'border-l-2 border-(--accent-color) bg-(--hover-bg) text-(--text-primary)'
					: 'border-l-2 border-transparent text-(--text-secondary) hover:bg-(--hover-bg) hover:text-(--text-primary)'}
					{dragOverTabId === tab.id && draggedTabId !== tab.id ? 'border-t-2 border-t-(--accent-color)' : ''}"
				role="listitem"
				draggable="true"
				ondragstart={(e) => handleDragStart(tab.id, e)}
				ondragover={(e) => handleDragOver(tab.id, e)}
				ondragleave={handleDragLeave}
				ondrop={(e) => handleDrop(tab.id, e)}
				ondragend={handleDragEnd}
				>
				{#if editingTabId === tab.id}
					<div class="flex-1 px-4 py-2">
						<input
							type="text"
							bind:this={renameInputEl}
							bind:value={editingName}
							onblur={saveTabName}
							onkeydown={handleRenameKeydown}
							class="w-full border-0 bg-transparent p-0 text-sm text-(--text-primary) focus:ring-0 focus:outline-none"
							style="font-size: 16px;"
						/>
					</div>
				{:else}
					<button
						onclick={() => selectTab(tab.id)}
						ondblclick={() => startEditing(tab)}
						class="min-w-0 flex-1 cursor-pointer px-4 py-2 text-left text-sm"
					>
						<span class="block truncate">{tab.name}</span>
					</button>

					<!-- Three-dots menu button -->
					<div class="relative mr-2 shrink-0">
						<button
							onclick={(e) => toggleMenu(tab.id, e)}
							class="flex h-5 w-5 items-center justify-center rounded text-(--text-muted) transition-opacity hover:text-(--text-primary)
								{openMenuTabId === tab.id
								? 'opacity-100'
								: 'opacity-0 group-hover:opacity-100'}"
							title="Tab options"
						>
							<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<circle cx="12" cy="5" r="1.5" />
								<circle cx="12" cy="12" r="1.5" />
								<circle cx="12" cy="19" r="1.5" />
							</svg>
						</button>
					</div>
				{/if}
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
				<div
					class="flex h-6 w-full items-center justify-center text-[10px]
						{isToday
						? 'rounded-full bg-(--accent-color) font-medium text-(--bg-secondary)'
						: isCurrentMonth
							? 'text-(--text-primary)'
							: 'text-(--text-muted)'}"
				>
					{day}
				</div>
			{/each}
		</div>
		<p class="mt-2 text-center font-mono text-base tabular-nums text-(--text-primary)">{time}</p>
	</div>
</div>

<!-- Three-dots dropdown (rendered outside nav to avoid overflow clipping) -->
{#if openMenuTabId && menuRect}
	<div
		class="fixed z-50 min-w-[120px] rounded border border-(--border-color) bg-(--bg-secondary) py-1 shadow-lg"
		style="left: {menuRect.left}px; top: {menuRect.bottom + 4}px;"
	>
		<button
			onclick={() => renameTab(openMenuTabId!)}
			class="flex w-full items-center px-3 py-2 text-left text-sm text-(--text-primary) hover:bg-(--hover-bg)"
		>
			Rename
		</button>
		<button
			onclick={() => deleteTab(openMenuTabId!)}
			class="flex w-full items-center px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
		>
			Delete
		</button>
	</div>
{/if}

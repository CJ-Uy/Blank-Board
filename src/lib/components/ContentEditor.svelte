<script lang="ts">
	import { boardStore } from '$lib/stores/board';
	import { emitContentUpdate, markLocalEdit } from '$lib/stores/socket';
	import { debounce } from '$lib/utils';

	const activeTab = boardStore.activeTab;

	let editorRef = $state<HTMLDivElement | null>(null);
	let lastSavedContent = $state('');

	const saveContent = debounce(async (tabId: string, content: string) => {
		if (content === lastSavedContent) return;

		await fetch(`/api/tabs/${tabId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		});

		lastSavedContent = content;
	}, 500);

	function handleInput() {
		if (!$activeTab || !editorRef) return;

		const content = editorRef.innerHTML;
		boardStore.updateTab($activeTab.id, { content });
		emitContentUpdate($activeTab.id, content);
		markLocalEdit();
		saveContent($activeTab.id, content);
	}

	// Update editor content when active tab changes
	$effect(() => {
		if (editorRef && $activeTab) {
			if (editorRef.innerHTML !== $activeTab.content) {
				editorRef.innerHTML = $activeTab.content;
				lastSavedContent = $activeTab.content;
			}
		} else if (editorRef) {
			editorRef.innerHTML = '';
			lastSavedContent = '';
		}
	});
</script>

<div class="flex h-full flex-col">
	{#if $activeTab}
		<div class="flex items-center border-b border-(--border-color) px-4 py-3 md:px-8 md:py-4">
			<h2 class="text-base font-medium text-(--text-primary) md:text-lg">{$activeTab.name}</h2>
		</div>
		<div
			bind:this={editorRef}
			contenteditable="true"
			role="textbox"
			tabindex="0"
			oninput={handleInput}
			class="prose prose-sm dark:prose-invert flex-1 overflow-y-auto px-4 py-4 focus:outline-none md:px-8 md:py-6"
			style="font-family: 'IBM Plex Mono', ui-monospace, monospace; max-width: none; color: var(--text-primary);"
		></div>
	{:else}
		<div class="flex h-full items-center justify-center text-(--text-muted)">
			<div class="text-center">
				<p class="text-sm">No tab selected</p>
				<p class="mt-1 text-xs">Create a new tab to get started</p>
			</div>
		</div>
	{/if}
</div>

<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { boardStore } from '$lib/stores/board';
	import { dropStore, type ClientDrop } from '$lib/stores/drops';
	import { emitDropCreate, emitDropDelete } from '$lib/stores/socket';
	import DropCard from './DropCard.svelte';

	let feedEl: HTMLDivElement | undefined = $state();
	let drafts = $state<Record<string, string>>({});
	let uploading = $state(false);
	let sending = $state(false);
	let errorMessage = $state('');
	let pendingFile: {
		file: File;
		previewUrl: string | null;
		tabId: string;
		tabName: string;
	} | null = $state(null);
	let fileInputEl: HTMLInputElement | undefined = $state();

	const activeTab = boardStore.activeTab;
	const activeTabId = $derived($activeTab?.id);
	let textInput = $derived(activeTabId ? (drafts[activeTabId] ?? '') : '');
	let nearBottom = $state(true);
	const dropCount = $derived($dropStore.drops.length);

	// Reload drops whenever active tab changes
	$effect(() => {
		if (activeTabId) {
			dropStore
				.loadDrops(activeTabId)
				.then(() => scrollToBottom())
				.catch(() => {
					errorMessage = 'Could not load drops. Please try again.';
				});
		} else dropStore.clear();
	});

	// Auto-scroll when drops list grows
	$effect(() => {
		if (dropCount > 0 && nearBottom) {
			tick().then(scrollToBottom);
		}
	});

	function scrollToBottom() {
		if (feedEl) feedEl.scrollTop = feedEl.scrollHeight;
	}

	function getMimeCategory(mimeType: string): ClientDrop['type'] {
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		if (mimeType === 'application/pdf') return 'pdf';
		return 'file';
	}

	async function sendText() {
		const text = textInput.trim();
		if (!text || !$activeTab || sending) return;
		const tabId = $activeTab.id;
		sending = true;
		errorMessage = '';
		try {
			const res = await fetch('/api/drops', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tabId, type: 'text', content: text })
			});
			if (!res.ok) throw new Error('Send failed');
			if (drafts[tabId]?.trim() === text) drafts[tabId] = '';
			const drop: ClientDrop = await res.json();
			drop.createdAt = new Date(drop.createdAt);
			dropStore.addDrop(drop);
			emitDropCreate(drop);
		} catch {
			errorMessage = 'Could not send. Your text is still here; try again.';
		} finally {
			sending = false;
		}
	}

	async function sendFile(file: File, tabId: string) {
		uploading = true;
		errorMessage = '';

		try {
			const form = new FormData();
			form.append('file', file);
			const uploadRes = await fetch('/api/upload', { method: 'POST', body: form });
			if (!uploadRes.ok) throw new Error('Upload failed. Check the file type and 50 MB limit.');
			const { url } = (await uploadRes.json()) as { url: string };

			const type = getMimeCategory(file.type);
			const res = await fetch('/api/drops', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tabId,
					type,
					fileUrl: url,
					fileName: file.name,
					fileSize: file.size,
					mimeType: file.type
				})
			});
			if (!res.ok) throw new Error('Could not attach file. Please try again.');
			const drop: ClientDrop = await res.json();
			drop.createdAt = new Date(drop.createdAt);
			dropStore.addDrop(drop);
			emitDropCreate(drop);
			cancelPendingFile();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';
		} finally {
			uploading = false;
		}
	}

	function onFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';

		stageFile(file);
	}
	function stageFile(file: File) {
		if (!$activeTab || uploading) return;
		cancelPendingFile();
		pendingFile = {
			file,
			previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
			tabId: $activeTab.id,
			tabName: $activeTab.name
		};
	}
	function pasteImage(event: ClipboardEvent) {
		const file = Array.from(event.clipboardData?.files ?? []).find((file) =>
			file.type.startsWith('image/')
		);
		if (!file) return;
		event.preventDefault();
		stageFile(file);
	}

	async function confirmSendFile() {
		if (!pendingFile) return;
		await sendFile(pendingFile.file, pendingFile.tabId);
	}

	function cancelPendingFile() {
		if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
		pendingFile = null;
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			sendText();
		}
	}

	async function deleteDrop(drop: ClientDrop) {
		try {
			const res = await fetch(`/api/drops/${drop.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Delete failed');
			dropStore.removeDrop(drop.id);
			emitDropDelete(drop.id);
		} catch {
			errorMessage = 'Could not delete drop. Try again.';
		}
	}

	onMount(() => scrollToBottom());
	onDestroy(cancelPendingFile);
</script>

<div
	class="flex h-full w-[300px] max-w-[90vw] flex-col border-l border-(--border-color) bg-(--bg-secondary)"
>
	<!-- Header -->
	<div class="shrink-0 border-b border-(--border-color) px-4 py-4">
		<div class="flex justify-between">
			<span class="text-sm font-medium">Drop to self</span><span class="text-xs text-(--text-muted)"
				>{dropCount}</span
			>
		</div>
		<p class="mt-1 truncate text-xs text-(--text-secondary)">
			A pocket for {$activeTab?.name ?? 'your notes'}
		</p>
	</div>

	<!-- Feed -->
	<div
		bind:this={feedEl}
		onscroll={() => {
			if (feedEl) nearBottom = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 80;
		}}
		class="min-h-0 flex-1 overflow-y-auto px-3 py-3"
	>
		{#if $dropStore.drops.length === 0}
			<div class="flex h-full items-center justify-center">
				<p class="px-4 text-center text-xs leading-relaxed text-(--text-muted)">
					Keep the little things here.<br />Send a thought, paste an image,<br />or attach a file to
					this note.
				</p>
			</div>
		{:else}
			{#each $dropStore.drops as drop, index (drop.id)}
				{#if index === 0 || drop.createdAt.toDateString() !== $dropStore.drops[index - 1].createdAt.toDateString()}<p
						class="mt-2 mb-3 text-center text-[10px] text-(--text-muted)"
					>
						{drop.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
					</p>{/if}
				<DropCard {drop} onDelete={() => deleteDrop(drop)} />
			{/each}
		{/if}
	</div>
	{#if !nearBottom}<button class="py-2 text-xs text-(--text-secondary)" onclick={scrollToBottom}
			>↓ Latest drops</button
		>{/if}

	<!-- Pending file preview -->
	{#if pendingFile}
		<div class="mx-2 mb-1 rounded-lg border border-(--border-color) bg-(--bg-primary) p-2">
			<p class="mb-2 truncate text-xs text-(--text-secondary)">Send to {pendingFile.tabName}</p>
			{#if pendingFile.previewUrl}
				<img
					src={pendingFile.previewUrl}
					alt="preview"
					class="mb-1 max-h-24 w-full rounded object-cover"
				/>
			{:else}
				<p class="truncate text-xs text-(--text-primary)">{pendingFile.file.name}</p>
			{/if}
			<div class="mt-1 flex gap-1">
				<button
					onclick={confirmSendFile}
					disabled={uploading}
					class="flex-1 rounded bg-(--accent-color) px-2 py-1 text-xs text-(--bg-primary) disabled:opacity-50"
				>
					{uploading ? 'Sending…' : 'Send'}
				</button>
				<button
					onclick={cancelPendingFile}
					disabled={uploading}
					class="rounded px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--hover-bg)"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Input bar -->
	{#if errorMessage}<p role="alert" class="px-3 py-2 text-xs text-red-600">{errorMessage}</p>{/if}
	<div class="shrink-0 border-t border-(--border-color) p-2">
		<div class="flex items-center gap-1.5">
			<textarea
				value={textInput}
				oninput={(event) => {
					if (activeTabId) drafts[activeTabId] = event.currentTarget.value;
				}}
				onpaste={pasteImage}
				onkeydown={onKeyDown}
				placeholder="Drop something…"
				aria-label="New drop"
				rows={2}
				disabled={!$activeTab || sending || uploading || !!pendingFile}
				class="flex-1 resize-none rounded-lg border border-(--border-color) bg-(--bg-primary) px-2.5 py-1.5 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:ring-1 focus:ring-(--accent-color) focus:outline-none disabled:opacity-50"
				style="font-family: inherit; max-height: 80px; overflow-y: auto;"
			></textarea>

			<input
				bind:this={fileInputEl}
				type="file"
				accept="image/*,video/*,audio/*,.pdf,.txt,.md,.csv"
				onchange={onFileSelected}
				class="hidden"
			/>

			<button
				onclick={() => fileInputEl?.click()}
				disabled={uploading || !!pendingFile}
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-primary) text-(--text-secondary) hover:bg-(--hover-bg) hover:text-(--text-primary) disabled:opacity-50"
				title="Attach file"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
					/>
				</svg>
			</button>

			<button
				onclick={sendText}
				disabled={!$activeTab || sending || !textInput.trim() || uploading || !!pendingFile}
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--accent-color) text-(--bg-primary) hover:opacity-90 disabled:opacity-40"
				title="Send"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 10l7-7m0 0l7 7m-7-7v18"
					/>
				</svg>
			</button>
		</div>
		<p class="px-1 pt-2 text-[10px] text-(--text-muted)">
			Enter to send · Shift+Enter for a line · Paste images here
		</p>
	</div>
</div>

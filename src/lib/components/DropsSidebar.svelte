<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { boardStore } from '$lib/stores/board';
	import { dropStore, type ClientDrop } from '$lib/stores/drops';
	import { emitDropCreate, emitDropDelete } from '$lib/stores/socket';
	import DropCard from './DropCard.svelte';

	let feedEl: HTMLDivElement | undefined = $state();
	let textInput = $state('');
	let uploading = $state(false);
	let pendingFile: { file: File; previewUrl: string | null } | null = $state(null);
	let fileInputEl: HTMLInputElement | undefined = $state();

	const activeTab = boardStore.activeTab;

	// Reload drops whenever active tab changes
	$effect(() => {
		const tab = $activeTab;
		if (tab?.id) {
			dropStore.loadDrops(tab.id).then(() => scrollToBottom());
		}
	});

	// Auto-scroll when drops list grows
	$effect(() => {
		const drops = $dropStore.drops;
		if (drops.length > 0) {
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
		if (!text || !$activeTab) return;
		textInput = '';

		const res = await fetch('/api/drops', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tabId: $activeTab.id, type: 'text', content: text })
		});
		if (!res.ok) return;
		const drop: ClientDrop = await res.json();
		drop.createdAt = new Date(drop.createdAt);
		dropStore.addDrop(drop);
		emitDropCreate(drop);
	}

	async function sendFile(file: File) {
		if (!$activeTab) return;
		uploading = true;

		try {
			const form = new FormData();
			form.append('file', file);
			const uploadRes = await fetch('/api/upload', { method: 'POST', body: form });
			if (!uploadRes.ok) return;
			const { url } = await uploadRes.json();

			const type = getMimeCategory(file.type);
			const res = await fetch('/api/drops', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tabId: $activeTab.id,
					type,
					fileUrl: url,
					fileName: file.name,
					fileSize: file.size,
					mimeType: file.type
				})
			});
			if (!res.ok) return;
			const drop: ClientDrop = await res.json();
			drop.createdAt = new Date(drop.createdAt);
			dropStore.addDrop(drop);
			emitDropCreate(drop);
		} finally {
			uploading = false;
			pendingFile = null;
		}
	}

	function onFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';

		const isImage = file.type.startsWith('image/');
		const previewUrl = isImage ? URL.createObjectURL(file) : null;
		pendingFile = { file, previewUrl };
	}

	async function confirmSendFile() {
		if (!pendingFile) return;
		await sendFile(pendingFile.file);
	}

	function cancelPendingFile() {
		if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
		pendingFile = null;
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendText();
		}
	}

	async function deleteDrop(drop: ClientDrop) {
		const res = await fetch(`/api/drops/${drop.id}`, { method: 'DELETE' });
		if (!res.ok) return;
		dropStore.removeDrop(drop.id);
		emitDropDelete(drop.id);
	}

	onMount(() => scrollToBottom());
</script>

<div class="flex h-full w-[220px] flex-col border-l border-(--border-color) bg-(--bg-secondary)">
	<!-- Header -->
	<div class="flex h-10 shrink-0 items-center border-b border-(--border-color) px-3">
		<span class="text-xs font-medium tracking-wide text-(--text-secondary) uppercase">Drops</span>
	</div>

	<!-- Feed -->
	<div bind:this={feedEl} class="flex-1 overflow-y-auto px-2 py-2">
		{#if $dropStore.drops.length === 0}
			<div class="flex h-full items-center justify-center">
				<p class="text-center text-xs text-(--text-muted) leading-relaxed px-4">
					Drop something here.<br />Text, images, files.
				</p>
			</div>
		{:else}
			{#each $dropStore.drops as drop (drop.id)}
				<DropCard {drop} onDelete={() => deleteDrop(drop)} />
			{/each}
		{/if}
	</div>

	<!-- Pending file preview -->
	{#if pendingFile}
		<div class="mx-2 mb-1 rounded-lg border border-(--border-color) bg-(--bg-primary) p-2">
			{#if pendingFile.previewUrl}
				<img src={pendingFile.previewUrl} alt="preview" class="mb-1 max-h-24 w-full rounded object-cover" />
			{:else}
				<p class="truncate text-xs text-(--text-primary)">{pendingFile.file.name}</p>
			{/if}
			<div class="flex gap-1 mt-1">
				<button
					onclick={confirmSendFile}
					disabled={uploading}
					class="flex-1 rounded bg-(--accent-color) px-2 py-1 text-xs text-white disabled:opacity-50"
				>
					{uploading ? 'Sending…' : 'Send'}
				</button>
				<button
					onclick={cancelPendingFile}
					class="rounded px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--hover-bg)"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Input bar -->
	<div class="shrink-0 border-t border-(--border-color) p-2">
		<div class="flex items-end gap-1.5">
			<textarea
				bind:value={textInput}
				onkeydown={onKeyDown}
				placeholder="Drop something…"
				rows={1}
				disabled={uploading || !!pendingFile}
				class="flex-1 resize-none rounded-lg border border-(--border-color) bg-(--bg-primary) px-2.5 py-1.5 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-1 focus:ring-(--accent-color) disabled:opacity-50"
				style="font-family: inherit; max-height: 80px; overflow-y: auto;"
			></textarea>

			<input
				bind:this={fileInputEl}
				type="file"
				accept="image/*,video/*,audio/*,.pdf"
				onchange={onFileSelected}
				class="hidden"
			/>

			<button
				onclick={() => fileInputEl?.click()}
				disabled={uploading || !!pendingFile}
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--border-color) bg-(--bg-primary) text-(--text-secondary) hover:bg-(--hover-bg) hover:text-(--text-primary) disabled:opacity-50"
				title="Attach file"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
				</svg>
			</button>

			<button
				onclick={sendText}
				disabled={!textInput.trim() || uploading || !!pendingFile}
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--accent-color) text-white hover:opacity-90 disabled:opacity-40"
				title="Send"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
				</svg>
			</button>
		</div>
	</div>
</div>

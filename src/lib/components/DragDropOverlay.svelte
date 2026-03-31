<script lang="ts">
	import { boardStore } from '$lib/stores/board';
	import { dropStore, type ClientDrop } from '$lib/stores/drops';
	import { emitDropCreate } from '$lib/stores/socket';

	const activeTab = boardStore.activeTab;

	let dragCounter = $state(0);
	const isDragging = $derived(dragCounter > 0);

	function hasFiles(e: DragEvent): boolean {
		return Array.from(e.dataTransfer?.types ?? []).includes('Files');
	}

	function onDragEnter(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		dragCounter++;
	}

	function onDragLeave(e: DragEvent) {
		if (!hasFiles(e)) return;
		dragCounter = Math.max(0, dragCounter - 1);
	}

	function onDragOver(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
	}

	function getMimeCategory(mimeType: string): ClientDrop['type'] {
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		if (mimeType === 'application/pdf') return 'pdf';
		return 'file';
	}

	async function onDrop(e: DragEvent) {
		e.preventDefault();
		dragCounter = 0;

		const tab = $activeTab;
		if (!tab) return;

		const files = Array.from(e.dataTransfer?.files ?? []);
		if (!files.length) return;

		for (const file of files) {
			const form = new FormData();
			form.append('file', file);

			const uploadRes = await fetch('/api/upload', { method: 'POST', body: form });
			if (!uploadRes.ok) continue;
			const { url } = await uploadRes.json();

			const type = getMimeCategory(file.type);
			const res = await fetch('/api/drops', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tabId: tab.id,
					type,
					fileUrl: url,
					fileName: file.name,
					fileSize: file.size,
					mimeType: file.type
				})
			});
			if (!res.ok) continue;

			const drop: ClientDrop = await res.json();
			drop.createdAt = new Date(drop.createdAt);
			dropStore.addDrop(drop);
			emitDropCreate(drop);
		}
	}
</script>

<svelte:window
	ondragenter={onDragEnter}
	ondragleave={onDragLeave}
	ondragover={onDragOver}
	ondrop={onDrop}
/>

{#if isDragging}
	<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-(--bg-primary) opacity-80"></div>
		<!-- Drop zone indicator -->
		<div class="relative mx-8 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-(--accent-color) px-16 py-12">
			<svg class="h-12 w-12 text-(--accent-color)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
			</svg>
			<div class="text-center">
				<p class="text-lg font-medium text-(--text-primary)">Drop to send</p>
				{#if $activeTab}
					<p class="mt-1 text-sm text-(--text-muted)">→ {$activeTab.name}</p>
				{:else}
					<p class="mt-1 text-sm text-(--text-muted)">Select a tab first</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

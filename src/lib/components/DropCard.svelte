<script lang="ts">
	import type { ClientDrop } from '$lib/stores/drops';

	let { drop, onDelete }: { drop: ClientDrop; onDelete: () => void } = $props();

	function formatTime(date: Date) {
		return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
	}

	function formatSize(bytes: number | null | undefined) {
		if (!bytes) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	let copied = $state(false);

	async function copyUrl() {
		if (!drop.fileUrl) return;
		await navigator.clipboard.writeText(window.location.origin + drop.fileUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="drop-card group relative">
	<!-- Delete button -->
	<button
		onclick={onDelete}
		class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded text-(--text-muted) opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
		title="Delete"
	>
		<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
		</svg>
	</button>

	<!-- Content -->
	{#if drop.type === 'text'}
		<p class="whitespace-pre-wrap break-words text-sm text-(--text-primary) pr-6">{drop.content}</p>

	{:else if drop.type === 'image'}
		<img
			src={drop.fileUrl ?? ''}
			alt={drop.fileName ?? 'image'}
			class="max-w-full rounded-lg"
			style="max-height: 240px; object-fit: cover;"
		/>
		<div class="mt-1.5 flex items-center gap-2">
			<span class="truncate text-xs text-(--text-muted)">{drop.fileName ?? 'image'}</span>
			<a
				href={drop.fileUrl ?? ''}
				download={drop.fileName ?? 'image'}
				class="ml-auto shrink-0 text-xs text-(--text-secondary) hover:text-(--text-primary)"
				title="Download"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
			</a>
			<button
				onclick={copyUrl}
				class="shrink-0 text-xs text-(--text-secondary) hover:text-(--text-primary)"
				title={copied ? 'Copied!' : 'Copy URL'}
			>
				{#if copied}
					<svg class="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				{:else}
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
					</svg>
				{/if}
			</button>
		</div>

	{:else if drop.type === 'video'}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video src={drop.fileUrl ?? ''} controls class="max-w-full rounded-lg" style="max-height: 240px;"></video>
		<div class="mt-1.5 flex items-center gap-2">
			<span class="truncate text-xs text-(--text-muted)">{drop.fileName ?? 'video'}</span>
			<a
				href={drop.fileUrl ?? ''}
				download={drop.fileName ?? 'video'}
				class="ml-auto shrink-0 text-xs text-(--text-secondary) hover:text-(--text-primary)"
				title="Download"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
			</a>
		</div>

	{:else if drop.type === 'audio'}
		<audio src={drop.fileUrl ?? ''} controls class="w-full"></audio>
		<div class="mt-1.5 flex items-center gap-2">
			<span class="truncate text-xs text-(--text-muted)">{drop.fileName ?? 'audio'}</span>
			<a
				href={drop.fileUrl ?? ''}
				download={drop.fileName ?? 'audio'}
				class="ml-auto shrink-0 text-xs text-(--text-secondary) hover:text-(--text-primary)"
				title="Download"
			>
				<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
			</a>
		</div>

	{:else}
		<!-- pdf / file -->
		<div class="flex items-center gap-2.5 pr-6">
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-(--hover-bg) text-(--text-secondary)">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm text-(--text-primary)">{drop.fileName ?? 'file'}</p>
				{#if drop.fileSize}
					<p class="text-xs text-(--text-muted)">{formatSize(drop.fileSize)}</p>
				{/if}
			</div>
			<a
				href={drop.fileUrl ?? ''}
				download={drop.fileName ?? 'file'}
				class="shrink-0 text-(--text-secondary) hover:text-(--text-primary)"
				title="Download"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
			</a>
		</div>
	{/if}

	<p class="mt-1 text-right text-[10px] text-(--text-muted)">{formatTime(drop.createdAt)}</p>
</div>

<style>
	.drop-card {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 10px 12px 6px;
		margin-bottom: 6px;
	}
</style>

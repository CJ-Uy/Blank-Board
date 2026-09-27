<script lang="ts">
	import { resolve } from '$app/paths';
	import { dropStore, type ClientDrop } from '$lib/stores/drops';
	import { emitDropUpdate } from '$lib/stores/socket';
	let { drop, onDelete }: { drop: ClientDrop; onDelete: () => void | Promise<void> } = $props();
	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);
	let confirmDelete = $state(false);
	let message = $state('');
	let editRef = $state<HTMLTextAreaElement | null>(null);
	const fileKey = $derived(drop.fileUrl?.startsWith('/files/') ? drop.fileUrl.slice(7) : '');
	const fileHref = $derived(resolve('/files/[...key]', { key: fileKey }));
	$effect(() => {
		if (editing && editRef) editRef.focus();
	});
	function formatSize(bytes: number) {
		return bytes < 1024
			? `${bytes} B`
			: bytes < 1048576
				? `${(bytes / 1024).toFixed(1)} KB`
				: `${(bytes / 1048576).toFixed(1)} MB`;
	}
	async function saveEdit() {
		if (!draft.trim() || saving) return;
		saving = true;
		message = '';
		try {
			const content = draft.trim();
			const response = await fetch(`/api/drops/${drop.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content })
			});
			if (!response.ok) throw new Error('Save failed');
			dropStore.updateDrop(drop.id, content);
			emitDropUpdate(drop.id, content);
			editing = false;
		} catch {
			message = 'Could not save. Your edit is still here.';
		} finally {
			saving = false;
		}
	}
	async function copy(kind: 'text' | 'link' | 'image') {
		message = '';
		try {
			if (kind === 'image') {
				const png = (async () => {
					const response = await fetch(fileHref);
					if (!response.ok) throw new Error('Image unavailable');
					const bitmap = await createImageBitmap(await response.blob());
					const canvas = document.createElement('canvas');
					canvas.width = bitmap.width;
					canvas.height = bitmap.height;
					canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
					bitmap.close();
					return new Promise<Blob>((resolve, reject) =>
						canvas.toBlob(
							(blob) => (blob ? resolve(blob) : reject(new Error('Image unavailable'))),
							'image/png'
						)
					);
				})();
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
			} else
				await navigator.clipboard.writeText(
					kind === 'text' ? (drop.content ?? '') : new URL(fileHref, location.origin).href
				);
			message = kind === 'image' ? 'Image copied' : kind === 'text' ? 'Text copied' : 'Link copied';
		} catch {
			message = 'Copy unavailable in this browser. Select the text or download the file.';
		}
	}
</script>

<article class="drop-card" aria-label={drop.type === 'text' ? 'Text drop' : `${drop.type} drop`}>
	{#if drop.type === 'text'}
		{#if editing}
			<textarea
				bind:this={editRef}
				bind:value={draft}
				aria-label="Edit drop text"
				maxlength="100000"
				rows="4"
				disabled={saving}
				onkeydown={(event) => {
					if (event.key === 'Escape') editing = false;
					if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
						event.preventDefault();
						void saveEdit();
					}
				}}
			></textarea>
			<div class="actions">
				<button class="primary" disabled={saving || !draft.trim()} onclick={saveEdit}
					>{saving ? 'Saving…' : 'Save edit'}</button
				><button disabled={saving} onclick={() => (editing = false)}>Cancel</button>
			</div>
		{:else}<p class="drop-text">{drop.content}</p>{/if}
	{:else if drop.type === 'image'}
		<a
			href={resolve('/files/[...key]', { key: fileKey })}
			target="_blank"
			rel="noreferrer"
			title="Open image"
			><img src={fileHref} alt={drop.fileName ?? 'Pasted image'} loading="lazy" /></a
		>
	{:else if drop.type === 'video'}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video src={fileHref} controls preload="metadata"></video>
	{:else if drop.type === 'audio'}
		<audio src={fileHref} controls preload="metadata"></audio>
	{/if}
	{#if drop.type !== 'text'}<div class="file-info">
			<span>{drop.fileName ?? 'Attachment'}</span>{#if drop.fileSize}<small
					>{formatSize(drop.fileSize)}</small
				>{/if}
		</div>{/if}
	{#if !editing}
		<div class="actions">
			{#if drop.type === 'text'}<button onclick={() => copy('text')}>Copy</button><button
					onclick={() => {
						draft = drop.content ?? '';
						editing = true;
						message = '';
					}}>Edit</button
				>
			{:else}
				<a
					href={resolve('/files/[...key]', { key: fileKey })}
					download={drop.fileName ?? 'attachment'}>Download</a
				>
				{#if drop.type === 'image'}<button onclick={() => copy('image')}>Copy image</button>{/if}
				<button onclick={() => copy('link')}>Copy link</button>
			{/if}
			<button
				class="delete"
				onclick={() => (confirmDelete = !confirmDelete)}
				aria-label="Delete drop">×</button
			>
		</div>
	{/if}
	{#if confirmDelete}<div class="actions" role="group" aria-label="Confirm deletion">
			<span>Delete this drop?</span><button class="delete" onclick={onDelete}>Delete</button><button
				onclick={() => (confirmDelete = false)}>Cancel</button
			>
		</div>{/if}
	{#if message}<p class="message" role="status">{message}</p>{/if}
	<time datetime={drop.createdAt.toISOString()}
		>{drop.createdAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time
	>
</article>

<style>
	.drop-card {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 12px 12px 8px;
		margin-bottom: 10px;
	}
	.drop-text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 13px;
		line-height: 1.65;
	}
	img,
	video {
		max-width: 100%;
		max-height: 260px;
		object-fit: contain;
		border-radius: 8px;
	}
	audio {
		width: 100%;
		height: 36px;
	}
	.file-info {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin: 8px 0;
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	small {
		color: var(--text-muted);
	}
	.actions {
		display: flex;
		gap: 3px;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 8px;
		color: var(--text-secondary);
		font-size: 11px;
	}
	.actions button,
	.actions a {
		padding: 6px 7px;
		border-radius: 5px;
		min-height: 30px;
		cursor: pointer;
	}
	.actions button:hover,
	.actions a:hover {
		background: var(--hover-bg);
		color: var(--text-primary);
	}
	.actions .delete {
		margin-left: auto;
	}
	.actions .delete:hover {
		color: #c65442;
	}
	.actions .primary {
		background: var(--accent-color);
		color: var(--bg-primary);
	}
	textarea {
		width: 100%;
		resize: vertical;
		min-height: 100px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 8px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 13px;
	}
	.message {
		font-size: 11px;
		color: var(--text-secondary);
		margin-top: 6px;
	}
	time {
		display: block;
		text-align: right;
		font-size: 10px;
		color: var(--text-muted);
		margin-top: 4px;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>

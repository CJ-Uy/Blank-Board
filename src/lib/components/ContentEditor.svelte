<script lang="ts">
	import { boardStore } from '$lib/stores/board';
	import { emitContentUpdate } from '$lib/stores/socket';
	import { debounce } from '$lib/utils';

	const activeTab = boardStore.activeTab;

	let editorRef = $state<HTMLDivElement | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let lastSavedContent = $state('');
	let uploading = $state(false);

	const saveContent = debounce(async (tabId: string, content: string) => {
		if (content === lastSavedContent) return;

		await fetch(`/api/tabs/${tabId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		});

		emitContentUpdate(tabId, content);
		lastSavedContent = content;
	}, 500);

	function handleInput() {
		if (!$activeTab || !editorRef) return;

		const content = editorRef.innerHTML;
		boardStore.updateTab($activeTab.id, { content });
		saveContent($activeTab.id, content);
	}

	async function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
				event.preventDefault();
				const file = item.getAsFile();
				if (!file) continue;

				await uploadAndInsertFile(file);
				return;
			}
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		const files = event.dataTransfer?.files;
		if (!files?.length) return;

		for (const file of files) {
			await uploadAndInsertFile(file);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	function triggerFileUpload() {
		fileInputRef?.click();
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files?.length) return;

		for (const file of files) {
			await uploadAndInsertFile(file);
		}

		// Reset input so the same file can be selected again
		input.value = '';
	}

	async function uploadAndInsertFile(file: File) {
		uploading = true;

		const formData = new FormData();
		formData.append('file', file);

		try {
			const res = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});

			if (res.ok) {
				const { url } = await res.json();
				insertMediaAtCursor(url, file.type);
			} else {
				const err = await res.json();
				console.error('Upload failed:', err.message);
			}
		} catch (error) {
			console.error('Failed to upload file:', error);
		} finally {
			uploading = false;
		}
	}

	function insertMediaAtCursor(url: string, mimeType: string) {
		const selection = window.getSelection();
		if (!selection || !selection.rangeCount) return;

		const range = selection.getRangeAt(0);
		let element: HTMLElement;

		if (mimeType.startsWith('image/')) {
			const img = document.createElement('img');
			img.src = url;
			img.style.maxWidth = '100%';
			img.style.display = 'block';
			img.style.margin = '8px 0';
			img.style.borderRadius = '4px';
			element = img;
		} else if (mimeType.startsWith('video/')) {
			const video = document.createElement('video');
			video.src = url;
			video.controls = true;
			video.style.maxWidth = '100%';
			video.style.display = 'block';
			video.style.margin = '8px 0';
			video.style.borderRadius = '4px';
			element = video;
		} else if (mimeType.startsWith('audio/')) {
			const audio = document.createElement('audio');
			audio.src = url;
			audio.controls = true;
			audio.style.display = 'block';
			audio.style.margin = '8px 0';
			audio.style.width = '100%';
			element = audio;
		} else if (mimeType === 'application/pdf') {
			const link = document.createElement('a');
			link.href = url;
			link.target = '_blank';
			link.textContent = url.split('/').pop() || 'PDF Document';
			link.style.display = 'inline-block';
			link.style.padding = '8px 12px';
			link.style.background = 'var(--hover-bg)';
			link.style.borderRadius = '4px';
			link.style.textDecoration = 'none';
			link.style.color = 'var(--text-primary)';
			element = link;
		} else {
			// Generic file link
			const link = document.createElement('a');
			link.href = url;
			link.target = '_blank';
			link.textContent = url.split('/').pop() || 'Download File';
			element = link;
		}

		range.deleteContents();
		range.insertNode(element);

		// Move cursor after the element
		range.setStartAfter(element);
		range.setEndAfter(element);
		selection.removeAllRanges();
		selection.addRange(range);

		// Trigger save
		handleInput();
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
		<div
			class="flex items-center justify-between border-b border-(--border-color) px-4 py-3 md:px-8 md:py-4"
		>
			<h2 class="text-base font-medium text-(--text-primary) md:text-lg">{$activeTab.name}</h2>
			<div class="flex items-center gap-2">
				{#if uploading}
					<span class="text-xs text-(--text-muted)">Uploading...</span>
				{/if}
				<!-- Upload button -->
				<button
					onclick={triggerFileUpload}
					disabled={uploading}
					class="flex h-8 w-8 items-center justify-center rounded text-(--text-secondary) transition-colors hover:bg-(--hover-bg) hover:text-(--text-primary) disabled:opacity-50"
					title="Upload image or file"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
				</button>
				<input
					bind:this={fileInputRef}
					type="file"
					accept="image/*,video/*,audio/*,.pdf"
					onchange={handleFileSelect}
					class="hidden"
				/>
			</div>
		</div>
		<div
			bind:this={editorRef}
			contenteditable="true"
			role="textbox"
			tabindex="0"
			oninput={handleInput}
			onpaste={handlePaste}
			ondrop={handleDrop}
			ondragover={handleDragOver}
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

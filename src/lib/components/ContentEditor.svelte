<script lang="ts">
	import { boardStore } from '$lib/stores/board';
	import { emitContentUpdate } from '$lib/stores/socket';
	import { debounce } from '$lib/utils';

	const activeTab = boardStore.activeTab;

	let editorRef = $state<HTMLDivElement | null>(null);
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
			link.style.background = '#f3f4f6';
			link.style.borderRadius = '4px';
			link.style.textDecoration = 'none';
			link.style.color = '#1a1a1a';
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
		<div class="flex items-center justify-between border-b border-gray-200 px-8 py-4">
			<h2 class="text-lg font-medium text-[#1a1a1a]">{$activeTab.name}</h2>
			{#if uploading}
				<span class="text-xs text-gray-500">Uploading...</span>
			{/if}
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
			class="prose prose-sm flex-1 overflow-y-auto px-8 py-6 focus:outline-none"
			style="font-family: 'IBM Plex Mono', ui-monospace, monospace; max-width: none;"
		></div>
	{:else}
		<div class="flex h-full items-center justify-center text-gray-400">
			<div class="text-center">
				<p class="text-sm">No tab selected</p>
				<p class="mt-1 text-xs">Create a new tab to get started</p>
			</div>
		</div>
	{/if}
</div>

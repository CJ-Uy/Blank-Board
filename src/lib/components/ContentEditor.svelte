<script lang="ts">
	import { onDestroy } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { boardStore } from '$lib/stores/board';
	import { queueNote, saveNote, flushNotes, saveStates, pendingNotes } from '$lib/stores/noteSaves';
	import { cleanHTML, textHTML } from '$lib/editor';
	const activeTab = boardStore.activeTab;
	let editorRef = $state<HTMLDivElement | null>(null);
	let displayedTab = '';
	let focused = $state(false);
	let review = $state<{ id: string; html: string; text: string } | null>(null);
	let message = $state('');
	let words = $state(0);
	let savedSelection: Range | null = null;
	let inserting = false;
	const status = $derived($activeTab ? $saveStates[$activeTab.id] : undefined);
	function countWords() {
		words = editorRef?.innerText.trim().split(/\s+/).filter(Boolean).length ?? 0;
	}
	function handleInput() {
		if (!$activeTab || !editorRef) return;
		if (!inserting) review = null;
		boardStore.updateTab($activeTab.id, { content: editorRef.innerHTML });
		queueNote($activeTab.id, editorRef.innerHTML);
		countWords();
	}
	function rememberSelection() {
		const selection = window.getSelection();
		if (selection?.rangeCount && editorRef?.contains(selection.anchorNode))
			savedSelection = selection.getRangeAt(0).cloneRange();
	}
	function restoreSelection() {
		editorRef?.focus();
		if (savedSelection && editorRef?.contains(savedSelection.commonAncestorContainer)) {
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(savedSelection);
		}
	}
	function command(name: string) {
		restoreSelection();
		document.execCommand(name);
		handleInput();
	}
	function insertHTML(html: string) {
		// execCommand preserves native undo history; direct DOM insertion does not.
		inserting = true;
		document.execCommand('insertHTML', false, html);
		handleInput();
		inserting = false;
		rememberSelection();
	}
	function handlePaste(event: ClipboardEvent) {
		if (!event.clipboardData || !editorRef) return;
		const text = event.clipboardData.getData('text/plain');
		const html = event.clipboardData.getData('text/html');
		if (!text && !html) return;
		event.preventDefault();
		review = null;
		if (!html) {
			insertHTML(textHTML(text));
			return;
		}
		const safe = cleanHTML(html);
		const id = `paste-${crypto.randomUUID()}`;
		insertHTML(`<div data-paste-id="${id}">${safe}</div>`);
		if (editorRef.querySelector(`[data-paste-id="${id}"]`)) review = { id, html: safe, text };
	}
	function choosePaste(mode: 'original' | 'match' | 'plain') {
		if (!review || !editorRef) return;
		const block = editorRef.querySelector(`[data-paste-id="${review.id}"]`);
		if (mode !== 'original' && block) {
			const html = mode === 'plain' ? textHTML(review.text) : cleanHTML(review.html, true);
			const range = document.createRange();
			range.selectNode(block);
			savedSelection = range;
			restoreSelection();
			insertHTML(html);
		} else restoreSelection();
		review = null;
	}
	async function copyText() {
		try {
			await navigator.clipboard.writeText(editorRef?.innerText ?? '');
			message = 'Plain text copied';
		} catch {
			message = 'Copy unavailable. Select text and use your browser’s Copy command.';
		}
	}
	function downloadText() {
		const url = URL.createObjectURL(
			new Blob([editorRef?.innerText ?? ''], { type: 'text/plain;charset=utf-8' })
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${$activeTab?.name.replace(/[<>:"/\\|?*]/g, '-') || 'Notes'}.txt`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	function handleKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			flushNotes();
		}
		if (event.key === 'Escape') review = null;
	}
	function beforeUnload(event: BeforeUnloadEvent) {
		if (!pendingNotes.size) return;
		flushNotes();
		event.preventDefault();
		event.returnValue = '';
	}
	beforeNavigate(({ cancel }) => {
		if (pendingNotes.size) {
			flushNotes();
			cancel();
			message = 'Saving changes. Try again once saved.';
		}
	});
	onDestroy(flushNotes);
	$effect(() => {
		if (!editorRef) return;
		const tab = $activeTab;
		if (tab?.id !== displayedTab || !focused) {
			if (tab?.id !== displayedTab) {
				review = null;
				savedSelection = null;
				message = '';
			}
			if (tab?.id !== displayedTab || editorRef.innerHTML !== (tab?.content ?? '')) {
				// This empty contenteditable is owned by the browser, not Svelte child nodes.
				// eslint-disable-next-line svelte/no-dom-manipulating
				editorRef.innerHTML = tab ? cleanHTML(tab.content) : '';
			}
			displayedTab = tab?.id ?? '';
			countWords();
		}
	});
</script>

<svelte:window onbeforeunload={beforeUnload} ononline={flushNotes} />
<svelte:document onselectionchange={rememberSelection} />
<div class="editor-shell">
	{#if $activeTab}
		<div class="editor-heading">
			<h2>{$activeTab.name}</h2>
			<span class:error={status === 'error'} class="save-status" role="status"
				>{status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved' : 'Saved'}</span
			>
			{#if status === 'error'}<button class="tool" onclick={() => saveNote($activeTab!.id)}
					>Retry save</button
				>{/if}
		</div>
		<div class="editor-tools" role="group" aria-label="Note formatting">
			<button class="tool" title="Bold (Ctrl/Cmd+B)" onclick={() => command('bold')}
				><b>B</b><span class="sr-only">Bold</span></button
			>
			<button class="tool" title="Italic (Ctrl/Cmd+I)" onclick={() => command('italic')}
				><i>I</i><span class="sr-only">Italic</span></button
			>
			<button class="tool" title="Bulleted list" onclick={() => command('insertUnorderedList')}
				>≡<span class="sr-only">Bulleted list</span></button
			>
			<button
				class="tool"
				title="Remove formatting from selection"
				onclick={() => command('removeFormat')}>Clear style</button
			>
			<span class="tool-spacer"></span>
			<button class="tool" onclick={copyText}>Copy text</button>
			<button class="tool" onclick={downloadText}>Export .txt</button>
		</div>
		{#if review}
			<section class="paste-review" aria-label="Paste options">
				<div class="paste-heading">
					<strong>Your paste, your choice</strong><span
						>Original formatting kept. Keep typing to continue.</span
					>
				</div>
				<div class="paste-previews">
					<!-- HTML was sanitized with DOMPurify in handlePaste. -->
					<div>
						<span class="preview-label">Styled</span>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						<div class="paste-sample styled">{@html review.html}</div>
					</div>
					<div>
						<span class="preview-label">Plain text</span>
						<div class="paste-sample plain">{review.text}</div>
					</div>
				</div>
				<div class="paste-actions">
					<button class="tool selected" onclick={() => choosePaste('original')}
						>Keep original</button
					>
					<button class="tool" onclick={() => choosePaste('match')}>Match note style</button>
					<button class="tool" onclick={() => choosePaste('plain')}>Use plain text</button>
				</div>
			</section>
		{/if}
		<div
			bind:this={editorRef}
			contenteditable="true"
			role="textbox"
			aria-label="Note content"
			aria-multiline="true"
			tabindex="0"
			spellcheck="true"
			data-placeholder="A little space to think. Start writing, or paste something here…"
			oninput={handleInput}
			onpaste={handlePaste}
			onkeydown={handleKeydown}
			onfocus={() => {
				focused = true;
			}}
			onblur={() => {
				focused = false;
				flushNotes();
			}}
			class="note-content prose prose-sm dark:prose-invert"
		></div>
		<div class="editor-footer">
			<span role="status">{message || `${words} ${words === 1 ? 'word' : 'words'}`}</span><span
				>Changes save automatically</span
			>
		</div>
	{:else}
		<div class="empty-editor">
			<h2>A fresh page awaits</h2>
			<p>Create a tab to start writing.</p>
		</div>
	{/if}
</div>

<style>
	.editor-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-width: 0;
	}
	.editor-heading {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 20px 28px 12px;
	}
	h2 {
		font-size: 18px;
		font-weight: 500;
		overflow-wrap: anywhere;
	}
	.save-status {
		margin-left: auto;
		font-size: 11px;
		color: var(--text-secondary);
		white-space: nowrap;
	}
	.error {
		color: #c65442;
	}
	.editor-tools {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
		padding: 0 20px 12px;
		border-bottom: 1px solid var(--border-color);
	}
	.tool {
		min-height: 34px;
		min-width: 34px;
		padding: 6px 9px;
		border-radius: 6px;
		font-size: 12px;
		color: var(--text-secondary);
		cursor: pointer;
	}
	.tool:hover {
		background: var(--hover-bg);
		color: var(--text-primary);
	}
	.tool-spacer {
		flex: 1;
	}
	.note-content {
		flex: 1;
		min-height: 100px;
		overflow: auto;
		max-width: none;
		padding: 28px;
		color: var(--text-primary);
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 14px;
		line-height: 1.8;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
		outline: none;
	}
	.note-content:focus-visible {
		box-shadow: inset 2px 0 var(--border-color);
	}
	.note-content:empty::before {
		content: attr(data-placeholder);
		color: var(--text-muted);
		pointer-events: none;
	}
	.note-content :global(img) {
		max-width: 100%;
	}
	.note-content :global(strong),
	.note-content :global(b),
	.note-content :global(em),
	.note-content :global(h1),
	.note-content :global(h2),
	.note-content :global(h3),
	.note-content :global(h4),
	.note-content :global(code) {
		color: inherit;
	}
	.note-content :global(table) {
		display: block;
		overflow-x: auto;
	}
	.editor-footer {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 24px;
		border-top: 1px solid var(--border-color);
		color: var(--text-muted);
		font-size: 10px;
	}
	.paste-review {
		margin: 12px 20px 0;
		padding: 14px;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		border-radius: 12px;
		max-height: 42dvh;
		overflow: auto;
	}
	.paste-heading {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		font-size: 12px;
	}
	.paste-heading span {
		color: var(--text-secondary);
	}
	.paste-previews {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 12px;
		margin: 12px 0;
	}
	.preview-label {
		font-size: 10px;
		color: var(--text-secondary);
	}
	.paste-sample {
		margin-top: 4px;
		padding: 10px;
		height: 100px;
		overflow: auto;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.styled {
		background: white;
		color: #222;
	}
	.plain {
		white-space: pre-wrap;
		font-family: ui-monospace, monospace;
	}
	.paste-actions {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.selected {
		background: var(--accent-color);
		color: var(--bg-primary);
	}
	.empty-editor {
		margin: auto;
		padding: 24px;
		text-align: center;
	}
	.empty-editor p {
		margin-top: 8px;
		color: var(--text-secondary);
		font-size: 13px;
	}
	@media (max-width: 767px) {
		.editor-heading {
			padding: 16px;
		}
		.editor-tools {
			padding: 0 8px 10px;
		}
		.note-content {
			padding: 20px 16px;
			font-size: 16px;
		}
		.paste-review {
			margin: 8px;
		}
		.editor-footer {
			padding: 10px 16px;
		}
	}
</style>

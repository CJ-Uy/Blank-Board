<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
	const numbers = [7, 8, 9, 4, 5, 6, 1, 2, 3];
	const positions = [
		'top left',
		'top center',
		'top right',
		'middle left',
		'center',
		'middle right',
		'bottom left',
		'bottom center',
		'bottom right'
	];
	const dots = numbers.map((_, i) => ({ x: 50 + (i % 3) * 100, y: 50 + Math.floor(i / 3) * 100 }));
	let layer = $state<'A' | 'B'>('A');
	let patternA = $state<number[]>([]);
	let patternB = $state<number[]>([]);
	let dragging = $state(false);
	let pointerId: number | null = null;
	let pointer = $state({ x: 0, y: 0 });
	let gridRef = $state<HTMLDivElement>(null!);
	let formRef: HTMLFormElement;
	let submitting = $state(false);
	let flash = $state<number | null>(null);
	let flashTimer: ReturnType<typeof setTimeout>;
	const readyA = $derived(patternA.length >= 3);
	const readyB = $derived(patternB.length === 5);
	function addDot(index: number) {
		if (patternA.includes(index)) return;
		const last = patternA.at(-1);
		const next = [...patternA];
		if (last !== undefined) {
			const x = ((last % 3) + (index % 3)) / 2;
			const y = (Math.floor(last / 3) + Math.floor(index / 3)) / 2;
			const middle = y * 3 + x;
			if (Number.isInteger(x) && Number.isInteger(y) && !next.includes(middle)) next.push(middle);
		}
		patternA = [...next, index];
	}
	function coords(event: PointerEvent) {
		const rect = gridRef.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) * 300) / rect.width,
			y: ((event.clientY - rect.top) * 300) / rect.height
		};
	}
	function hitDot(point: { x: number; y: number }) {
		return dots.findIndex((dot) => Math.hypot(dot.x - point.x, dot.y - point.y) <= 32);
	}
	function startPattern(event: PointerEvent) {
		if (event.button !== 0 || !event.isPrimary || submitting) return;
		const point = coords(event);
		const index = hitDot(point);
		if (index < 0) return;
		event.preventDefault();
		gridRef.setPointerCapture(event.pointerId);
		pointerId = event.pointerId;
		dragging = true;
		pointer = point;
		patternA = [];
		addDot(index);
	}
	function movePattern(event: PointerEvent) {
		if (!dragging || pointerId !== event.pointerId) return;
		pointer = coords(event);
		const index = hitDot(pointer);
		if (index >= 0) addDot(index);
	}
	function endPattern() {
		dragging = false;
		pointerId = null;
	}
	function tapTile(index: number) {
		if (readyB || submitting) return;
		patternB = [...patternB, index];
		flash = index;
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => {
			flash = null;
		}, 180);
	}
	async function nextStep() {
		if (!readyA) return;
		endPattern();
		layer = 'B';
		await tick();
		formRef.querySelector<HTMLButtonElement>('.tile')?.focus();
	}
	function undo() {
		if (layer === 'A') patternA = patternA.slice(0, -1);
		else patternB = patternB.slice(0, -1);
	}
	function handleKeydown(event: KeyboardEvent) {
		if (submitting || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.key === 'Backspace') {
			event.preventDefault();
			undo();
			return;
		}
		if (event.key === 'Escape') {
			if (layer === 'A') patternA = [];
			else patternB = [];
			return;
		}
		const number = Number(event.code.replace(/^(Numpad|Digit)/, ''));
		const index = numbers.indexOf(number);
		if (index >= 0) {
			event.preventDefault();
			if (layer === 'A') addDot(index);
			else tapTile(index);
			return;
		}
		// Leave Enter on focused buttons to their native action (including dot selection).
		if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
			event.preventDefault();
			if (layer === 'A') void nextStep();
			else if (readyB) formRef.requestSubmit();
		}
	}
	function encode(pattern: number[]) {
		return pattern.map((index) => numbers[index]).join('-');
	}
</script>

<svelte:window onkeydown={handleKeydown} />
<svelte:head
	><title>Welcome — Blank Board</title><meta
		name="description"
		content="A quiet place for notes and ideas. Open your board with your two patterns."
	/></svelte:head
>

<main class="login-page">
	<div class="login-card">
		<header>
			<div class="brand-mark" aria-hidden="true">
				{#each numbers as n (n)}<span></span>{/each}
			</div>
			<h1>Blank Board</h1>
			<p>A little space for everything on your mind.</p>
		</header>
		<nav class="steps" aria-label="Sign-in progress">
			<span class:current={layer === 'A'} aria-current={layer === 'A' ? 'step' : undefined}
				><b>{layer === 'B' ? '✓' : '1'}</b> Connect</span
			><span class="step-line"></span><span
				class:current={layer === 'B'}
				aria-current={layer === 'B' ? 'step' : undefined}><b>2</b> Tap</span
			>
		</nav>
		<form
			bind:this={formRef}
			method="POST"
			use:enhance={({ cancel }) => {
				if (!readyA || !readyB || submitting) {
					cancel();
					return;
				}
				submitting = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						submitting = false;
					}
				};
			}}
		>
			<input type="hidden" name="patternA" value={encode(patternA)} /><input
				type="hidden"
				name="patternB"
				value={encode(patternB)}
			/>
			<div class="pattern-card">
				<div class="pattern-heading">
					<h2>{layer === 'A' ? 'Connect your dots' : 'Tap your sequence'}</h2>
					<span class="step-count">{layer === 'A' ? '01' : '02'} / 02</span>
				</div>
				<p id="pattern-help" class="pattern-help">
					{layer === 'A'
						? 'Draw through at least 3 dots to unlock your board.'
						: 'Tap 5 tiles in order. Repeating a tile is fine.'}
				</p>
				{#if layer === 'A'}
					<div
						bind:this={gridRef}
						class="pattern-grid"
						role="group"
						aria-label="Connect pattern"
						aria-describedby="pattern-help"
						onpointerdown={startPattern}
						onpointermove={movePattern}
						onpointerup={endPattern}
						onpointercancel={endPattern}
						onlostpointercapture={endPattern}
					>
						<svg viewBox="0 0 300 300" aria-hidden="true">
							{#each patternA.slice(0, -1) as index, i (i)}<line
									x1={dots[index].x}
									y1={dots[index].y}
									x2={dots[patternA[i + 1]].x}
									y2={dots[patternA[i + 1]].y}
								/>{/each}
							{#if dragging && patternA.length}<line
									class="trail"
									x1={dots[patternA[patternA.length - 1]].x}
									y1={dots[patternA[patternA.length - 1]].y}
									x2={pointer.x}
									y2={pointer.y}
								/>{/if}
						</svg>
						{#each dots as dot, index (dot.x + dot.y * 300)}
							<button
								type="button"
								class="dot-target"
								class:chosen={patternA.includes(index)}
								aria-label="Dot {numbers[index]}, {positions[index]}"
								aria-pressed={patternA.includes(index)}
								onclick={(event) => {
									if (event.detail === 0) addDot(index);
								}}><span class="dot"><span></span></span></button
							>
						{/each}
					</div>
				{:else}
					<div class="tap-progress" aria-label="{patternB.length} of 5 taps entered">
						{#each [0, 1, 2, 3, 4] as i (i)}<span class:filled={i < patternB.length}></span>{/each}
					</div>
					<div class="tile-grid" role="group" aria-label="Tap sequence">
						{#each numbers as number, index (index)}<button
								type="button"
								class="tile"
								class:flashed={flash === index}
								aria-label="Tile {number}, {positions[index]}"
								disabled={readyB || submitting}
								onclick={() => tapTile(index)}><span></span></button
							>{/each}
					</div>
				{/if}
				<div class="pattern-footer">
					<span role="status"
						>{layer === 'A'
							? readyA
								? `${patternA.length} dots · Ready`
								: `${patternA.length} of 3 dots minimum`
							: `${patternB.length} of 5 taps${readyB ? ' · Ready' : ''}`}</span
					>
					<div>
						<button
							type="button"
							onclick={undo}
							disabled={submitting || (layer === 'A' ? !patternA.length : !patternB.length)}
							>Undo</button
						><button
							type="button"
							onclick={() => {
								if (layer === 'A') patternA = [];
								else patternB = [];
							}}
							disabled={submitting || (layer === 'A' ? !patternA.length : !patternB.length)}
							>Clear</button
						>
					</div>
				</div>
			</div>
			{#if form?.message}<p class="login-error" role="alert">{form.message}</p>{/if}
			{#if layer === 'A'}<button
					type="button"
					class="continue"
					disabled={!readyA}
					onclick={nextStep}>Continue <span aria-hidden="true">→</span></button
				>
			{:else}<button type="submit" class="continue" disabled={!readyB || submitting}
					>{submitting ? 'Opening your board…' : 'Open my board'}
					<span aria-hidden="true">→</span></button
				>{/if}
		</form>
		<p class="keyboard-hint">Keyboard: 7 8 9 / 4 5 6 / 1 2 3 · Backspace to undo</p>
		<footer>
			{#if layer === 'B'}<button
					disabled={submitting}
					onclick={() => {
						layer = 'A';
						patternB = [];
					}}>← Back to dots</button
				>{:else}<a href={resolve('/about')}>About Blank Board</a>{/if}
			<p>
				New here? Choose two patterns to create a board.<br />Use the same pair to return. There’s
				no password reset.
			</p>
		</footer>
	</div>
</main>

<style>
	.login-page {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 40px 20px;
	}
	.login-card {
		width: 100%;
		max-width: 380px;
	}
	header {
		text-align: center;
		margin-bottom: 30px;
	}
	.brand-mark {
		display: grid;
		grid-template-columns: repeat(3, 4px);
		gap: 4px;
		width: max-content;
		margin: 0 auto 16px;
		transform: rotate(-8deg);
	}
	.brand-mark span {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--accent-color);
	}
	h1 {
		font-size: 30px;
		font-weight: 400;
		letter-spacing: -1.2px;
	}
	header p {
		color: var(--text-secondary);
		font-size: 13px;
		margin-top: 8px;
	}
	.steps {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		margin-bottom: 22px;
		color: var(--text-muted);
		font-size: 12px;
	}
	.steps > span {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.steps b {
		width: 23px;
		height: 23px;
		display: grid;
		place-items: center;
		border: 1px solid var(--border-color);
		border-radius: 50%;
		font-size: 10px;
	}
	.steps .current {
		color: var(--text-primary);
	}
	.current b {
		background: var(--accent-color);
		color: var(--bg-primary);
		border-color: transparent;
	}
	.step-line {
		width: 40px;
		height: 1px;
		background: var(--border-color);
	}
	.pattern-card {
		--pattern-ink: #367f91;
		border: 1px solid var(--border-color);
		border-radius: 20px;
		padding: 22px;
		background: var(--bg-secondary);
		box-shadow: 0 8px 30px #00000004;
	}
	:global(.dark) .pattern-card {
		--pattern-ink: #8bd4df;
	}
	.pattern-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h2 {
		font-size: 15px;
		font-weight: 500;
	}
	.step-count {
		font-family: monospace;
		font-size: 10px;
		color: var(--text-muted);
	}
	.pattern-help {
		font-size: 12px;
		color: var(--text-secondary);
		margin-top: 6px;
	}
	.pattern-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		aspect-ratio: 1;
		width: 100%;
		max-width: 270px;
		position: relative;
		touch-action: none;
		user-select: none;
		margin: 12px auto 0;
	}
	.pattern-grid svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	line {
		stroke: var(--pattern-ink);
		stroke-width: 5;
		stroke-linecap: round;
		opacity: 0.7;
	}
	line.trail {
		opacity: 0.45;
	}
	.dot-target {
		display: grid;
		place-items: center;
		z-index: 1;
		cursor: crosshair;
		border-radius: 12px;
	}
	.dot {
		width: 52px;
		height: 52px;
		border: 1px solid var(--border-color);
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--bg-secondary);
		transition:
			border-color 0.15s,
			box-shadow 0.15s,
			background 0.15s;
	}
	.dot > span {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--text-secondary);
		transition:
			background 0.15s,
			transform 0.15s;
	}
	.dot-target:hover .dot {
		border-color: var(--text-secondary);
	}
	.chosen .dot {
		border: 2px solid var(--pattern-ink);
		background: color-mix(in srgb, var(--pattern-ink) 12%, var(--bg-secondary));
		box-shadow:
			0 0 0 5px color-mix(in srgb, var(--pattern-ink) 8%, transparent),
			0 0 16px color-mix(in srgb, var(--pattern-ink) 12%, transparent);
	}
	.chosen .dot > span {
		background: var(--pattern-ink);
		transform: scale(1.35);
	}
	.tap-progress {
		display: flex;
		justify-content: center;
		gap: 9px;
		margin: 22px 0 18px;
	}
	.tap-progress span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--border-color);
		transition:
			background 0.15s,
			transform 0.15s;
	}
	.tap-progress .filled {
		background: var(--accent-color);
		transform: scale(1.2);
	}
	.tile-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		padding: 0 14px 14px;
	}
	.tile {
		aspect-ratio: 1.2;
		display: grid;
		place-items: center;
		border: 1px solid var(--border-color);
		border-radius: 12px;
		background: var(--bg-primary);
		cursor: pointer;
		touch-action: manipulation;
		transition:
			background 0.15s,
			transform 0.15s,
			border-color 0.15s;
	}
	.tile span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text-muted);
	}
	.tile:hover:not(:disabled) {
		border-color: var(--text-secondary);
		background: var(--hover-bg);
	}
	.tile:active:not(:disabled),
	.tile.flashed {
		background: var(--accent-color);
		transform: scale(0.94);
	}
	.tile.flashed span {
		background: var(--bg-primary);
	}
	.tile:disabled {
		cursor: default;
	}
	.pattern-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 36px;
		gap: 4px;
		font-size: 11px;
		color: var(--text-secondary);
	}
	.pattern-footer button {
		padding: 10px 7px;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.continue {
		width: 100%;
		display: flex;
		justify-content: space-between;
		margin-top: 16px;
		border-radius: 12px;
		padding: 15px 20px;
		background: var(--accent-color);
		color: var(--bg-primary);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition:
			opacity 0.15s,
			transform 0.15s;
	}
	.continue:active:not(:disabled) {
		transform: translateY(1px);
	}
	.keyboard-hint {
		text-align: center;
		color: var(--text-muted);
		font-size: 10px;
		margin-top: 16px;
	}
	footer {
		text-align: center;
		margin-top: 26px;
		color: var(--text-secondary);
		font-size: 12px;
	}
	footer p {
		font-size: 11px;
		line-height: 1.8;
		margin-top: 16px;
		color: var(--text-muted);
	}
	footer button,
	footer a {
		padding: 10px;
		cursor: pointer;
	}
	.login-error {
		color: #c65442;
		font-size: 12px;
		margin-top: 12px;
	}
	@media (max-width: 480px) {
		.login-page {
			padding: 24px 16px;
		}
		header {
			margin-bottom: 22px;
		}
		.pattern-card {
			padding: 18px;
		}
	}
</style>

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// ─── Numpad layout (same for both grids) ────────────────────────────────────
	// Numpad positions map to grid cell indices:
	//   7(0) 8(1) 9(2)
	//   4(3) 5(4) 6(5)
	//   1(6) 2(7) 3(8)
	const NUMPAD_TO_INDEX: Record<string, number> = {
		Numpad7: 0, Numpad8: 1, Numpad9: 2,
		Numpad4: 3, Numpad5: 4, Numpad6: 5,
		Numpad1: 6, Numpad2: 7, Numpad3: 8
	};
	const INDEX_TO_NUM = [7, 8, 9, 4, 5, 6, 1, 2, 3];

	// ─── Grid A — Pattern Lock ───────────────────────────────────────────────────
	const DOT_POSITIONS = [
		{ x: 50, y: 50 },  { x: 150, y: 50 },  { x: 250, y: 50 },
		{ x: 50, y: 150 }, { x: 150, y: 150 }, { x: 250, y: 150 },
		{ x: 50, y: 250 }, { x: 150, y: 250 }, { x: 250, y: 250 }
	];

	let patternA = $state<number[]>([]);
	let dragging = $state(false);
	let mousePos = $state({ x: 0, y: 0 });
	let svgRef = $state<SVGSVGElement | null>(null);

	function svgCoords(e: MouseEvent | Touch): { x: number; y: number } {
		const rect = svgRef!.getBoundingClientRect();
		return {
			x: ((e.clientX - rect.left) / rect.width) * 300,
			y: ((e.clientY - rect.top) / rect.height) * 300
		};
	}

	function nearestDot(x: number, y: number): number | null {
		for (let i = 0; i < DOT_POSITIONS.length; i++) {
			if (Math.hypot(DOT_POSITIONS[i].x - x, DOT_POSITIONS[i].y - y) < 28) return i;
		}
		return null;
	}

	function startPattern(e: MouseEvent) {
		e.preventDefault();
		dragging = true;
		patternA = [];
		const coords = svgCoords(e);
		mousePos = coords;
		const dot = nearestDot(coords.x, coords.y);
		if (dot !== null) patternA = [dot];
	}

	function movePattern(e: MouseEvent) {
		if (!dragging) return;
		e.preventDefault();
		const coords = svgCoords(e);
		mousePos = coords;
		const dot = nearestDot(coords.x, coords.y);
		if (dot !== null && !patternA.includes(dot)) patternA = [...patternA, dot];
	}

	function endPattern() { dragging = false; }

	function startPatternTouch(e: TouchEvent) {
		e.preventDefault();
		dragging = true;
		patternA = [];
		const coords = svgCoords(e.touches[0]);
		mousePos = coords;
		const dot = nearestDot(coords.x, coords.y);
		if (dot !== null) patternA = [dot];
	}

	function movePatternTouch(e: TouchEvent) {
		if (!dragging) return;
		e.preventDefault();
		const coords = svgCoords(e.touches[0]);
		mousePos = coords;
		const dot = nearestDot(coords.x, coords.y);
		if (dot !== null && !patternA.includes(dot)) patternA = [...patternA, dot];
	}

	// ─── Grid B — Among Us Keypad ────────────────────────────────────────────────
	const SYMBOLS = ['◆', '●', '▲', '★', '■', '✦', '♦', '✿', '⬟'];
	let patternB = $state<number[]>([]); // 5 tile taps, repeats allowed

	function tapTile(idx: number) {
		if (patternB.length < 5) patternB = [...patternB, idx];
	}

	// ─── Keyboard input (numpad) ─────────────────────────────────────────────────
	let activeGrid = $state<'A' | 'B'>('A');

	function handleKeydown(e: KeyboardEvent) {
		// Tab switches active grid
		if (e.code === 'Tab') {
			e.preventDefault();
			activeGrid = activeGrid === 'A' ? 'B' : 'A';
			return;
		}
		const idx = NUMPAD_TO_INDEX[e.code];
		if (idx === undefined) return;
		e.preventDefault();
		if (activeGrid === 'A') {
			if (!patternA.includes(idx)) patternA = [...patternA, idx];
		} else {
			tapTile(idx);
		}
	}

	// ─── Encode sequences for form submission ────────────────────────────────────
	function encode(indices: number[]): string {
		return indices.map((i) => INDEX_TO_NUM[i]).join('-');
	}

	const readyA = $derived(patternA.length >= 3);
	const readyB = $derived(patternB.length === 5);
	const canSubmit = $derived(readyA && readyB);
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Blank Board</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-(--bg-primary) px-4 py-8">
	<div class="w-full max-w-sm">
		<h1 class="mb-1 text-center text-2xl font-light tracking-tight text-(--text-primary)">
			Blank Board
		</h1>
		<p class="mb-8 text-center text-xs text-(--text-muted)">
			Draw your two patterns to enter
		</p>

		<form method="POST" use:enhance class="space-y-6">
			<input type="hidden" name="patternA" value={encode(patternA)} />
			<input type="hidden" name="patternB" value={encode(patternB)} />

			<!-- ── Grid A: Pattern Lock ── -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				role="group"
				class="cursor-pointer rounded-xl border-2 p-4 transition-colors
					{activeGrid === 'A' ? 'border-(--accent-color)' : 'border-(--border-color)'}"
				onclick={() => (activeGrid = 'A')}
				onkeydown={(e) => e.key === 'Enter' && (activeGrid = 'A')}
			>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-medium uppercase tracking-wide text-(--text-secondary)">
						Pattern A &nbsp;
						{#if readyA}<span class="text-green-500">✓</span>{:else}<span class="opacity-40">{patternA.length}/3+</span>{/if}
					</span>
					{#if patternA.length > 0}
						<button
							type="button"
							onclick={(e) => { e.stopPropagation(); patternA = []; }}
							class="text-xs text-(--text-muted) hover:text-(--text-primary)"
						>clear</button>
					{/if}
				</div>

					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<svg
					bind:this={svgRef}
					role="application"
					aria-label="Pattern A drawing area"
					viewBox="0 0 300 300"
					class="w-full touch-none select-none"
					style="cursor: crosshair; max-height: 200px;"
					onmousedown={startPattern}
					onmousemove={movePattern}
					onmouseup={endPattern}
					onmouseleave={endPattern}
					ontouchstart={startPatternTouch}
					ontouchmove={movePatternTouch}
					ontouchend={endPattern}
				>
					<!-- Lines between connected dots -->
					{#each patternA.slice(0, -1) as dotIdx, i}
						<line
							x1={DOT_POSITIONS[dotIdx].x} y1={DOT_POSITIONS[dotIdx].y}
							x2={DOT_POSITIONS[patternA[i + 1]].x} y2={DOT_POSITIONS[patternA[i + 1]].y}
							stroke="var(--accent-color)" stroke-width="3"
							stroke-linecap="round" opacity="0.7"
						/>
					{/each}

					<!-- Trailing dashed line to cursor -->
					{#if dragging && patternA.length > 0}
						<line
							x1={DOT_POSITIONS[patternA[patternA.length - 1]].x}
							y1={DOT_POSITIONS[patternA[patternA.length - 1]].y}
							x2={mousePos.x} y2={mousePos.y}
							stroke="var(--accent-color)" stroke-width="2"
							stroke-linecap="round" stroke-dasharray="5 5" opacity="0.4"
						/>
					{/if}

					<!-- Dots -->
					{#each DOT_POSITIONS as pos, i}
						{@const active = patternA.includes(i)}
						<circle
							cx={pos.x} cy={pos.y} r="18"
							fill={active ? 'var(--accent-color)' : 'var(--bg-secondary)'}
							stroke={active ? 'var(--accent-color)' : 'var(--border-color)'}
							stroke-width="2"
							opacity={active ? 1 : 0.5}
						/>
						{#if active}
							<text x={pos.x} y={pos.y} text-anchor="middle"
								dominant-baseline="central" font-size="11"
								fill="white" font-weight="bold">
								{patternA.indexOf(i) + 1}
							</text>
						{/if}
					{/each}
				</svg>
			</div>

			<!-- ── Grid B: Among Us Keypad ── -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				role="group"
				class="cursor-pointer rounded-xl border-2 p-4 transition-colors
					{activeGrid === 'B' ? 'border-(--accent-color)' : 'border-(--border-color)'}"
				onclick={() => (activeGrid = 'B')}
				onkeydown={null}
			>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-medium uppercase tracking-wide text-(--text-secondary)">
						Pattern B &nbsp;
						{#if readyB}<span class="text-green-500">✓</span>{:else}<span class="opacity-40">{patternB.length}/5</span>{/if}
					</span>
					{#if patternB.length > 0}
						<button
							type="button"
							onclick={(e) => { e.stopPropagation(); patternB = []; }}
							class="text-xs text-(--text-muted) hover:text-(--text-primary)"
						>clear</button>
					{/if}
				</div>

				<!-- Tap sequence display -->
				<div class="mb-3 flex gap-1.5">
					{#each Array(5) as _, i}
						<div class="flex h-8 flex-1 items-center justify-center rounded text-base
							{i < patternB.length
							? 'bg-(--accent-color) text-white'
							: 'border border-(--border-color) text-(--text-muted)'}">
							{i < patternB.length ? SYMBOLS[patternB[i]] : '·'}
						</div>
					{/each}
				</div>

				<!-- 3×3 symbol grid -->
				<div class="grid grid-cols-3 gap-2">
					{#each SYMBOLS as sym, i}
						{@const tapped = patternB.filter((t) => t === i).length}
						<button
							type="button"
							onclick={(e) => { e.stopPropagation(); tapTile(i); }}
							disabled={patternB.length >= 5}
							class="relative flex aspect-square items-center justify-center rounded-lg border
								text-2xl transition-all active:scale-95
								{tapped > 0
								? 'border-(--accent-color) bg-(--accent-color)/10 text-(--accent-color)'
								: 'border-(--border-color) bg-(--bg-secondary) text-(--text-secondary)'}
								hover:border-(--accent-color) hover:text-(--accent-color)
								disabled:cursor-not-allowed disabled:opacity-40"
						>
							{sym}
							{#if tapped > 0}
								<span class="absolute right-1 top-0.5 text-[9px] font-bold text-(--accent-color)"
									>{tapped}</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			{#if form?.message}
				<p class="text-center text-sm text-red-500">{form.message}</p>
			{/if}

			<button
				type="submit"
				disabled={!canSubmit}
				class="w-full rounded-lg bg-(--accent-color) py-3 text-sm font-medium
					text-white transition-opacity hover:opacity-90
					disabled:cursor-not-allowed disabled:opacity-40"
			>
				Enter
			</button>

			<p class="text-center text-xs text-(--text-muted)">
				Your patterns are your key — no account, no recovery.
				<br />Desktop: numpad 1–9 · Tab to switch grids.
			</p>
		</form>
	</div>
</div>

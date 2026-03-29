<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// ─── Numpad layout ────────────────────────────────────────────────────────────
	const NUMPAD_TO_INDEX: Record<string, number> = {
		Numpad7: 0, Numpad8: 1, Numpad9: 2,
		Numpad4: 3, Numpad5: 4, Numpad6: 5,
		Numpad1: 6, Numpad2: 7, Numpad3: 8
	};
	const INDEX_TO_NUM = [7, 8, 9, 4, 5, 6, 1, 2, 3];

	// ─── Layer control ────────────────────────────────────────────────────────────
	let layer = $state<'A' | 'B'>('A');

	// ─── Grid A — Pattern Lock ────────────────────────────────────────────────────
	const DOT_POSITIONS = [
		{ x: 50, y: 50 },  { x: 150, y: 50 },  { x: 250, y: 50 },
		{ x: 50, y: 150 }, { x: 150, y: 150 }, { x: 250, y: 150 },
		{ x: 50, y: 250 }, { x: 150, y: 250 }, { x: 250, y: 250 }
	];

	let patternA = $state<number[]>([]);
	let dragging = $state(false);
	let mousePos = $state({ x: 0, y: 0 });
	let svgRef = $state<SVGSVGElement | null>(null);
	let formRef = $state<HTMLFormElement | null>(null);

	function svgCoords(e: MouseEvent | Touch): { x: number; y: number } {
		const pt = svgRef!.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		const svgP = pt.matrixTransform(svgRef!.getScreenCTM()!.inverse());
		return { x: svgP.x, y: svgP.y };
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

	// ─── Grid B — Plain keypad ────────────────────────────────────────────────────
	// 9 plain buttons, no symbols — positions match numpad layout (7-8-9 / 4-5-6 / 1-2-3)
	const BUTTON_COUNT = 9;
	let patternB = $state<number[]>([]);
	let flashedTile = $state<number | null>(null);

	const readyA = $derived(patternA.length >= 3);
	const readyB = $derived(patternB.length === 5);

	function tapTile(idx: number) {
		if (patternB.length >= 5) return;
		patternB = [...patternB, idx];
		flashedTile = idx;
		setTimeout(() => { flashedTile = null; }, 150);
	}

	function goToLayerB() {
		if (readyA) layer = 'B';
	}

	// ─── Keyboard input (numpad) ──────────────────────────────────────────────────
	function handleKeydown(e: KeyboardEvent) {
		if (e.code === 'Enter' || e.code === 'NumpadEnter') {
			if (layer === 'A' && readyA) { e.preventDefault(); goToLayerB(); return; }
			if (layer === 'B' && readyB) { e.preventDefault(); formRef?.requestSubmit(); return; }
			return;
		}
		const idx = NUMPAD_TO_INDEX[e.code];
		if (idx === undefined) return;
		e.preventDefault();
		if (layer === 'A') {
			if (!patternA.includes(idx)) patternA = [...patternA, idx];
		} else {
			tapTile(idx);
		}
	}

	function encode(indices: number[]): string {
		return indices.map((i) => INDEX_TO_NUM[i]).join('-');
	}

	function goBackToLayerA() {
		patternA = [];
		patternB = [];
		layer = 'A';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Blank Board</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-(--bg-primary) px-4 py-8">
	<div class="w-full max-w-sm flex-1 flex flex-col justify-center">
		<h1 class="mb-1 text-center text-2xl font-light tracking-tight text-(--text-primary)">
			Blank Board
		</h1>
		<p class="mb-8 text-center text-xs text-(--text-muted)">
			{layer === 'A' ? 'Draw your pattern to continue' : 'Enter your second pattern'}
		</p>

		<form bind:this={formRef} method="POST" use:enhance class="space-y-6">
			<input type="hidden" name="patternA" value={encode(patternA)} />
			<input type="hidden" name="patternB" value={encode(patternB)} />

			{#if layer === 'A'}
				<!-- ── Layer 1: Pattern Lock ── -->
				<div role="group" class="rounded-xl border-2 border-(--accent-color) p-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-medium uppercase tracking-wide text-(--text-secondary)">
							Pattern &nbsp;
							{#if readyA}<span class="text-green-500">✓</span>{:else}<span class="opacity-40">{patternA.length}/3+</span>{/if}
						</span>
						{#if patternA.length > 0}
							<button
								type="button"
								onclick={() => (patternA = [])}
								class="text-xs text-(--text-muted) hover:text-(--text-primary)"
							>clear</button>
						{/if}
					</div>

					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<svg
						bind:this={svgRef}
						role="application"
						aria-label="Pattern drawing area"
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
						{#each patternA.slice(0, -1) as dotIdx, i (i)}
							<line
								x1={DOT_POSITIONS[dotIdx].x} y1={DOT_POSITIONS[dotIdx].y}
								x2={DOT_POSITIONS[patternA[i + 1]].x} y2={DOT_POSITIONS[patternA[i + 1]].y}
								stroke="var(--accent-color)" stroke-width="3"
								stroke-linecap="round" opacity="0.7"
							/>
						{/each}

						{#if dragging && patternA.length > 0}
							<line
								x1={DOT_POSITIONS[patternA[patternA.length - 1]].x}
								y1={DOT_POSITIONS[patternA[patternA.length - 1]].y}
								x2={mousePos.x} y2={mousePos.y}
								stroke="var(--accent-color)" stroke-width="2"
								stroke-linecap="round" stroke-dasharray="5 5" opacity="0.4"
							/>
						{/if}

						{#each DOT_POSITIONS as pos, i (i)}
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

				{#if form?.message}
					<p class="text-center text-sm text-red-500">{form.message}</p>
				{/if}

				<button
					type="button"
					onclick={goToLayerB}
					disabled={!readyA}
					class="w-full rounded-lg bg-(--accent-color) py-3 text-sm font-medium
						text-(--bg-primary) transition-opacity hover:opacity-90
						disabled:cursor-not-allowed disabled:opacity-40"
				>
					Continue
				</button>

			{:else}
				<!-- ── Layer 2: Plain 9-button keypad ── -->
				<div class="rounded-xl border-2 border-(--accent-color) p-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-medium uppercase tracking-wide text-(--text-secondary)">
							Second pattern &nbsp;
							{#if readyB}<span class="text-green-500">✓</span>{:else}<span class="opacity-40">{patternB.length}/5</span>{/if}
						</span>
						{#if patternB.length > 0}
							<button
								type="button"
								onclick={() => (patternB = [])}
								class="text-xs text-(--text-muted) hover:text-(--text-primary)"
							>clear</button>
						{/if}
					</div>

					<!-- 5-tap progress row -->
					<div class="mb-3 flex gap-1.5">
						{#each Array(5) as _, i (i)}
							<div class="flex h-8 flex-1 items-center justify-center rounded text-xs
								{i < patternB.length
								? 'bg-(--accent-color) text-(--bg-primary)'
								: 'border border-(--border-color) text-(--text-muted)'}">
								{i < patternB.length ? '·' : ''}
							</div>
						{/each}
					</div>

					<!-- 3×3 plain button grid -->
					<div class="grid grid-cols-3 gap-2">
						{#each Array(BUTTON_COUNT) as _, i (i)}
							<button
								type="button"
								aria-label="Button {i + 1}"
								onclick={() => tapTile(i)}
								disabled={patternB.length >= 5}
								class="aspect-square rounded-lg border transition-all active:scale-95
									disabled:cursor-not-allowed disabled:opacity-40
									{flashedTile === i
										? 'border-(--accent-color) bg-(--accent-color) scale-95'
										: 'border-(--border-color) bg-(--bg-secondary) hover:border-(--accent-color) hover:bg-(--accent-color)/10'}"
							></button>
						{/each}
					</div>
				</div>

				{#if form?.message}
					<p class="text-center text-sm text-red-500">{form.message}</p>
				{/if}

				<button
					type="submit"
					disabled={!readyB}
					class="w-full rounded-lg bg-(--accent-color) py-3 text-sm font-medium
						text-(--bg-primary) transition-opacity hover:opacity-90
						disabled:cursor-not-allowed disabled:opacity-40"
				>
					Enter
				</button>
			{/if}
		</form>
	</div>

	<!-- Bottom navigation -->
	<div class="w-full max-w-sm pb-4 text-center">
		{#if layer === 'A'}
			<a href="/about" class="text-xs text-(--text-muted) hover:text-(--text-secondary) transition-colors">
				about
			</a>
		{:else}
			<button
				type="button"
				onclick={goBackToLayerA}
				class="text-xs text-(--text-muted) hover:text-(--text-secondary) transition-colors"
			>
				← back
			</button>
		{/if}
	</div>
</div>

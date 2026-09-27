<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import {
		advance,
		defaults,
		freshTimer,
		remainingSeconds,
		phaseNames,
		validSettings,
		type Settings,
		type Session,
		type Timer
	} from '$lib/pomodoro';
	let { userId }: { userId: string } = $props();
	let settings = $state<Settings>({ ...defaults });
	let timer = $state<Timer>(freshTimer());
	let pending = $state<Session[]>([]);
	let history = $state<Session[]>([]);
	let now = $state(Date.now());
	let error = $state('');
	let storageError = $state('');
	let soundReady = $state(false);
	let period = $state(7);
	let panel: HTMLDetailsElement;
	let audio: AudioContext | undefined;
	let syncing = false;
	const key = $derived(`blank-board:pomodoro:${userId}`);
	const seconds = $derived(remainingSeconds(timer, now));
	const display = $derived(
		`${Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
	);
	const sessions = $derived([
		...history,
		...pending.filter((p) => !history.some((h) => h.id === p.id))
	]);
	const days = $derived.by(() =>
		Array.from({ length: period }, (_, i) => {
			const date = new SvelteDate(now);
			date.setHours(0, 0, 0, 0);
			date.setDate(date.getDate() - period + 1 + i);
			const end = new SvelteDate(date);
			end.setDate(end.getDate() + 1);
			const matches = sessions.filter(
				(s) => s.completedAt >= date.getTime() && s.completedAt < end.getTime()
			);
			return {
				label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
				count: matches.length,
				minutes: Math.round(matches.reduce((sum, s) => sum + s.seconds, 0) / 60)
			};
		})
	);
	const maxCount = $derived(Math.max(1, ...days.map((d) => d.count)));
	const count = $derived(days.reduce((sum, d) => sum + d.count, 0));
	const minutes = $derived(days.reduce((sum, d) => sum + d.minutes, 0));

	function persist() {
		try {
			localStorage.setItem(key, JSON.stringify({ settings, timer, pending }));
			storageError = '';
		} catch {
			storageError =
				'Browser storage is unavailable. Keep this page open until your sessions sync.';
		}
	}
	function restore(raw: string | null) {
		if (!raw) return;
		try {
			const saved = JSON.parse(raw);
			if (!validSettings(saved.settings)) return;
			const t = saved.timer;
			if (
				!t ||
				!['focus', 'short', 'long'].includes(t.phase) ||
				!Number.isFinite(t.duration) ||
				t.duration < 60 ||
				t.duration > 10800 ||
				!Number.isFinite(t.remaining) ||
				t.remaining < 0 ||
				t.remaining > t.duration ||
				(t.endsAt !== null && !Number.isFinite(t.endsAt)) ||
				!Number.isInteger(t.completed) ||
				t.completed < 0 ||
				typeof t.id !== 'string' ||
				typeof t.started !== 'boolean'
			)
				return;
			settings = saved.settings;
			timer = t;
			pending = Array.isArray(saved.pending)
				? saved.pending.filter(
						(s: Session) =>
							typeof s.id === 'string' &&
							Number.isFinite(s.seconds) &&
							Number.isFinite(s.completedAt)
					)
				: [];
		} catch {
			/* Leave a usable default if browser storage is corrupt. */
		}
	}
	async function enableSound(preview = false) {
		try {
			audio ??= new AudioContext();
			await audio.resume();
			soundReady = audio.state === 'running';
			if (preview) ding();
		} catch {
			soundReady = false;
		}
	}
	function ding() {
		if (!audio || audio.state !== 'running') {
			soundReady = false;
			return;
		}
		for (const [frequency, delay] of [
			[880, 0],
			[1320, 0.12]
		]) {
			const oscillator = audio.createOscillator();
			const gain = audio.createGain();
			oscillator.frequency.value = frequency;
			gain.gain.setValueAtTime(0.0001, audio.currentTime + delay);
			gain.gain.exponentialRampToValueAtTime(0.22, audio.currentTime + delay + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + delay + 1);
			oscillator.connect(gain);
			gain.connect(audio.destination);
			oscillator.start(audio.currentTime + delay);
			oscillator.stop(audio.currentTime + delay + 1.05);
			oscillator.onended = () => {
				oscillator.disconnect();
				gain.disconnect();
			};
		}
	}
	async function sync() {
		if (syncing) return;
		syncing = true;
		try {
			for (const session of [...pending]) {
				const response = await fetch('/api/pomodoros', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(session)
				});
				if (!response.ok) throw new Error();
				history = [...history.filter((s) => s.id !== session.id), session];
				pending = pending.filter((s) => s.id !== session.id);
				persist();
			}
			const response = await fetch('/api/pomodoros');
			if (!response.ok) throw new Error();
			history = (
				(await response.json()) as { id: string; seconds: number; completedAt: string }[]
			).map((s: { id: string; seconds: number; completedAt: string }) => ({
				...s,
				completedAt: new Date(s.completedAt).getTime()
			}));
			error = '';
		} catch {
			error = 'History could not sync. Completed sessions stay here for retry.';
		} finally {
			syncing = false;
		}
	}
	function next(skipped = false) {
		const result = advance(timer, settings, Date.now(), skipped);
		timer = result.timer;
		if (result.session) pending = [...pending, result.session];
		now = Date.now();
		persist();
		ding();
		void sync();
	}
	function toggle() {
		void enableSound();
		now = Date.now();
		if (timer.endsAt !== null && remainingSeconds(timer, now) === 0) next();
		if (timer.endsAt !== null)
			timer = { ...timer, remaining: remainingSeconds(timer, now), endsAt: null };
		else
			timer = {
				...timer,
				started: true,
				id: timer.id || crypto.randomUUID(),
				endsAt: now + timer.remaining * 1000
			};
		persist();
	}
	function restart() {
		void enableSound();
		now = Date.now();
		timer = {
			...timer,
			id: crypto.randomUUID(),
			remaining: timer.duration,
			endsAt: timer.endsAt === null ? null : now + timer.duration * 1000
		};
		persist();
	}
	function changeSettings(event: SubmitEvent) {
		event.preventDefault();
		const data = new FormData(event.currentTarget as HTMLFormElement);
		const nextSettings = Object.fromEntries(
			Object.keys(defaults).map((k) => [k, Number(data.get(k))])
		);
		if (!validSettings(nextSettings)) return;
		settings = nextSettings;
		if (!timer.started) timer = freshTimer(settings);
		persist();
	}
	onMount(() => {
		try {
			restore(localStorage.getItem(key));
		} catch {
			storageError = 'Browser storage is unavailable.';
		}
		void sync();
		const tick = () => {
			now = Date.now();
			if (timer.endsAt !== null && now >= timer.endsAt) {
				// One tab owns a transition; a stable session ID also makes server writes idempotent.
				void navigator.locks.request(key, { ifAvailable: true }, (lock) => {
					if (!lock) return;
					try {
						restore(localStorage.getItem(key));
					} catch {
						/* In-memory timer still works. */
					}
					if (timer.endsAt !== null && Date.now() >= timer.endsAt) next();
				});
			}
		};
		const interval = setInterval(tick, 500);
		const storage = (event: StorageEvent) => {
			if (event.key === key) {
				restore(event.newValue);
				now = Date.now();
			}
		};
		window.addEventListener('storage', storage);
		window.addEventListener('online', sync);
		document.addEventListener('visibilitychange', tick);
		return () => {
			clearInterval(interval);
			window.removeEventListener('storage', storage);
			window.removeEventListener('online', sync);
			document.removeEventListener('visibilitychange', tick);
			void audio?.close();
		};
	});
</script>

<svelte:window
	onclick={(event) => {
		if (panel?.open && event.target instanceof Node && !panel.contains(event.target))
			panel.open = false;
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape' && panel?.open) {
			panel.open = false;
			panel.querySelector('summary')?.focus();
		}
	}}
/>
<details
	bind:this={panel}
	class="pomodoro"
	ontoggle={() => {
		if (panel.open) void sync();
	}}
>
	<summary
		aria-label="Pomodoro timer"
		title={`${phaseNames[timer.phase]} · ${display}`}
		class:running={timer.endsAt !== null}
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.7"
			aria-hidden="true"><circle cx="12" cy="14" r="8" /><path d="M9 2h6M12 2v4M12 10v4l3 2" /></svg
		>
		<span>{display}</span><span class="phase-dot" class:break-phase={timer.phase !== 'focus'}
		></span>
	</summary>
	<section aria-label="Pomodoro" class="timer-panel">
		<div class="panel-heading">
			<h2>Focus timer</h2>
			<button
				class="quiet"
				aria-label="Close timer"
				onclick={() => {
					panel.open = false;
					panel.querySelector('summary')?.focus();
				}}>×</button
			>
		</div>
		<div class="phase-label" role="status">
			{phaseNames[timer.phase]}
			<span>· {(timer.completed % settings.rounds) + 1} / {settings.rounds}</span>
		</div>
		<div class="clock" aria-label={`${phaseNames[timer.phase]} time remaining`}>{display}</div>
		<progress max={timer.duration} value={timer.duration - seconds} aria-label="Phase progress"
		></progress>
		<div class="controls">
			<button
				class="secondary"
				onclick={restart}
				disabled={!timer.started}
				title="Restart this phase; no focus session is counted">Restart</button
			>
			<button class="primary" onclick={toggle}
				>{timer.endsAt !== null ? 'Pause' : timer.started ? 'Resume' : 'Start focus'}</button
			>
			<button
				class="secondary"
				onclick={() => {
					void enableSound();
					next(true);
				}}
				disabled={!timer.started}
				title="Skip this phase; skipped focus is not counted">Skip</button
			>
		</div>
		<p class="hint">Focus → break → focus, automatically.</p>
		<button class="sound" onclick={() => enableSound(true)}
			>{soundReady ? '♫ Test ding' : '♫ Enable sound'}</button
		>
		<p class="hint">
			Keep the board open for dings. After reload, enable sound again. Sleep may delay a ding; the
			next phase starts when the board wakes.
		</p>
		<details class="settings">
			<summary>Timer settings</summary>
			<form onsubmit={changeSettings}>
				<div class="setting-grid">
					{#each [['focus', 'Focus minutes'], ['short', 'Short break minutes'], ['long', 'Long break minutes'], ['rounds', 'Focus sessions per long break']] as [name, label] (name)}
						<label
							>{label}<input
								{name}
								aria-label={label}
								type="number"
								min="1"
								max={name === 'rounds' ? 12 : 180}
								step="1"
								required
								value={settings[name as keyof Settings]}
							/></label
						>
					{/each}
				</div>
				<button class="secondary" type="submit">Save settings</button>
				<p class="hint">Changes apply to the next phase.</p>
			</form>
		</details>
		<div class="history-heading">
			<h3>Your focus history</h3>
			<select aria-label="History period" bind:value={period}
				><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}
					>90 days</option
				></select
			>
		</div>
		<p class="totals"><strong>{count}</strong> pomodoros <span>· {minutes} focus minutes</span></p>
		<div
			class="chart"
			role="img"
			aria-label={`${count} completed pomodoros in the last ${period} days`}
		>
			{#each days as day (day.label)}<div
					class="bar"
					title={`${day.label}: ${day.count} pomodoros, ${day.minutes} minutes`}
					style:height={`${Math.max(3, (day.count / maxCount) * 100)}%`}
					class:empty={day.count === 0}
				></div>{/each}
		</div>
		<div class="chart-labels"><span>{days[0].label}</span><span>Today</span></div>
		{#if count === 0}<p class="hint">Finish a focus session to start your history.</p>{/if}
		<details class="daily">
			<summary>Daily totals</summary>
			<ul>
				{#each [...days].reverse() as day (day.label)}<li>
						<span>{day.label}</span><span>{day.count} sessions · {day.minutes} min</span>
					</li>{/each}
			</ul>
		</details>
		{#if pending.length}<p class="hint" role="status">
				{pending.length} session(s) waiting to sync
			</p>{/if}
		{#if error}<p class="error" role="alert">{error} <button onclick={sync}>Retry</button></p>{/if}
		{#if storageError}<p class="error" role="alert">{storageError}</p>{/if}
	</section>
</details>

<style>
	.pomodoro {
		position: relative;
		color: var(--text-primary);
		font-size: 13px;
	}
	.pomodoro > summary {
		list-style: none;
		display: flex;
		align-items: center;
		gap: 7px;
		cursor: pointer;
		padding: 7px 9px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		font-variant-numeric: tabular-nums;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.running {
		background: var(--hover-bg);
	}
	.phase-dot {
		width: 5px;
		height: 5px;
		background: #659888;
		border-radius: 50%;
	}
	.break-phase {
		background: #d59d55;
	}
	.timer-panel {
		position: absolute;
		top: calc(100% + 14px);
		right: 0;
		z-index: 50;
		width: 340px;
		max-height: calc(100dvh - 85px);
		overflow-y: auto;
		padding: 22px;
		border: 1px solid var(--border-color);
		border-radius: 14px;
		background: var(--bg-secondary);
		box-shadow: 0 16px 60px #0003;
	}
	.panel-heading,
	.history-heading,
	.chart-labels,
	.daily li {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		font-size: 15px;
		font-weight: 500;
	}
	h3 {
		font-weight: 500;
	}
	.quiet {
		font-size: 24px;
		color: var(--text-muted);
		padding: 0 6px;
	}
	.phase-label {
		text-align: center;
		margin-top: 12px;
		color: var(--text-secondary);
	}
	.phase-label span {
		color: var(--text-muted);
	}
	.clock {
		font-family: 'IBM Plex Mono', monospace;
		font-size: 56px;
		text-align: center;
		letter-spacing: -3px;
		font-variant-numeric: tabular-nums;
		margin: 8px 0 12px;
	}
	progress {
		width: 100%;
		height: 4px;
		accent-color: #659888;
		border: 0;
		border-radius: 3px;
		overflow: hidden;
		background: var(--border-color);
	}
	progress::-webkit-progress-bar {
		background: var(--border-color);
	}
	progress::-webkit-progress-value {
		background: #659888;
	}
	.controls {
		display: flex;
		gap: 8px;
		margin: 18px 0 10px;
	}
	button {
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.primary,
	.secondary {
		border-radius: 7px;
		padding: 9px 12px;
		border: 1px solid var(--border-color);
	}
	.primary {
		flex: 1;
		background: var(--text-primary);
		color: var(--bg-primary);
	}
	.secondary:hover {
		background: var(--hover-bg);
	}
	.hint {
		font-size: 11px;
		line-height: 1.5;
		color: var(--text-muted);
		margin: 8px 0;
	}
	.sound {
		color: var(--text-secondary);
		font-size: 12px;
		margin-top: 3px;
	}
	.settings,
	.daily {
		border-top: 1px solid var(--border-color);
		margin-top: 16px;
		padding-top: 12px;
	}
	.settings summary,
	.daily summary {
		cursor: pointer;
		color: var(--text-secondary);
	}
	.setting-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin: 14px 0;
	}
	label {
		font-size: 11px;
		color: var(--text-secondary);
	}
	input {
		width: 100%;
		display: block;
		margin-top: 5px;
		padding: 6px;
		border: 1px solid var(--border-color);
		border-radius: 5px;
		background: var(--bg-primary);
		color: var(--text-primary);
	}
	.history-heading {
		margin-top: 22px;
	}
	select {
		font-size: 11px;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 5px;
		padding: 4px;
	}
	.totals {
		margin: 12px 0;
		color: var(--text-secondary);
		font-size: 12px;
	}
	.totals strong {
		font-size: 20px;
		color: var(--text-primary);
	}
	.totals span {
		color: var(--text-muted);
	}
	.chart {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 72px;
		border-bottom: 1px solid var(--border-color);
	}
	.bar {
		flex: 1;
		min-width: 1px;
		background: #659888;
		border-radius: 3px 3px 0 0;
	}
	.empty {
		background: var(--border-color);
	}
	.chart-labels {
		font-size: 10px;
		color: var(--text-muted);
		margin-top: 6px;
	}
	.daily {
		font-size: 11px;
	}
	.daily ul {
		max-height: 150px;
		overflow: auto;
		margin-top: 10px;
	}
	.daily li {
		padding: 4px 0;
	}
	.error {
		color: #c35e56;
		font-size: 12px;
		margin-top: 10px;
	}
	.error button {
		text-decoration: underline;
	}
	@media (max-width: 640px) {
		.timer-panel {
			position: fixed;
			top: 64px;
			right: 12px;
			width: min(340px, calc(100vw - 24px));
		}
		.pomodoro > summary {
			padding: 6px;
			gap: 4px;
		}
	}
</style>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let now = $state(new Date());
	let interval: ReturnType<typeof setInterval>;

	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	const day = $derived(now.getDate());
	const month = $derived(monthNames[now.getMonth()]);
	const year = $derived(now.getFullYear());
	const weekday = $derived(dayNames[now.getDay()]);
	const time = $derived(
		now.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		})
	);

	onMount(() => {
		interval = setInterval(() => {
			now = new Date();
		}, 1000);
	});

	onDestroy(() => {
		if (interval) {
			clearInterval(interval);
		}
	});
</script>

<div class="flex h-full w-[200px] flex-col border-l border-gray-200 bg-white px-6 py-8">
	<div class="text-center">
		<p class="text-sm font-medium tracking-wide text-gray-500 uppercase">{month}</p>
		<p class="mt-1 text-sm text-gray-400">{year}</p>
	</div>

	<div class="my-8 text-center">
		<p class="text-6xl font-extralight tabular-nums text-[#1a1a1a]">{day}</p>
		<p class="mt-2 text-sm text-gray-500">{weekday}</p>
	</div>

	<div class="mt-auto text-center">
		<p class="font-mono text-2xl tabular-nums text-[#1a1a1a]">{time}</p>
	</div>
</div>

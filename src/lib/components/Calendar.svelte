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

	const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	const currentDay = $derived(now.getDate());
	const currentMonth = $derived(now.getMonth());
	const currentYear = $derived(now.getFullYear());
	const monthName = $derived(monthNames[currentMonth]);
	const time = $derived(
		now.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		})
	);

	// Get calendar days for the current month
	const calendarDays = $derived.by(() => {
		const firstDay = new Date(currentYear, currentMonth, 1);
		const lastDay = new Date(currentYear, currentMonth + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDay = firstDay.getDay();

		const days: { day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

		// Previous month days
		const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
		for (let i = startingDay - 1; i >= 0; i--) {
			days.push({
				day: prevMonthLastDay - i,
				isCurrentMonth: false,
				isToday: false
			});
		}

		// Current month days
		for (let i = 1; i <= daysInMonth; i++) {
			days.push({
				day: i,
				isCurrentMonth: true,
				isToday: i === currentDay
			});
		}

		// Next month days (fill to complete 6 rows = 42 cells)
		const remainingDays = 42 - days.length;
		for (let i = 1; i <= remainingDays; i++) {
			days.push({
				day: i,
				isCurrentMonth: false,
				isToday: false
			});
		}

		return days;
	});

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

<div
	class="flex h-full w-[220px] flex-col border-l border-(--border-color) bg-(--bg-secondary) px-4 py-4"
>
	<!-- Month and Year header -->
	<div class="mb-3 flex items-center justify-between">
		<div>
			<span class="text-sm font-medium text-(--text-primary)">{monthName}</span>
			<span class="ml-1 text-sm text-(--text-muted)">{currentYear}</span>
		</div>
	</div>

	<!-- Day names header -->
	<div class="mb-1 grid grid-cols-7 gap-0">
		{#each dayNames as dayName}
			<div class="py-1 text-center text-xs font-medium text-(--text-muted)">
				{dayName}
			</div>
		{/each}
	</div>

	<!-- Calendar grid -->
	<div class="grid grid-cols-7 gap-0">
		{#each calendarDays as { day, isCurrentMonth, isToday }}
			<div
				class="flex h-7 w-7 items-center justify-center text-xs
					{isToday
					? 'rounded-full bg-(--accent-color) font-medium text-(--bg-secondary)'
					: isCurrentMonth
						? 'text-(--text-primary)'
						: 'text-(--text-muted)'}"
			>
				{day}
			</div>
		{/each}
	</div>

	<!-- Current time -->
	<div class="mt-auto pt-4 text-center">
		<p class="font-mono text-2xl tabular-nums text-(--text-primary)">{time}</p>
	</div>
</div>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import TabList from '$lib/components/TabList.svelte';
	import ContentEditor from '$lib/components/ContentEditor.svelte';
	import Calendar from '$lib/components/Calendar.svelte';
	import { boardStore } from '$lib/stores/board';
	import { initSocket, disconnectSocket, connected } from '$lib/stores/socket';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(() => {
		boardStore.setTabs(data.tabs);
		if (data.user) {
			initSocket(data.user.id);
		}
	});

	onDestroy(() => {
		disconnectSocket();
	});
</script>

<svelte:head>
	<title>Blank Board</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="flex h-screen flex-col bg-[#fafafa]" style="font-family: 'IBM Plex Sans', sans-serif;">
	<!-- Header -->
	<header class="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
		<div class="flex items-center gap-3">
			<h1 class="text-lg font-light tracking-tight text-[#1a1a1a]">Blank Board</h1>
			{#if $connected}
				<span class="flex items-center gap-1 text-xs text-green-600">
					<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
					Live
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-4">
			<span class="text-sm text-gray-500">{data.user?.username}</span>
			<form method="POST" action="/logout" use:enhance>
				<button
					type="submit"
					class="text-sm text-gray-500 underline-offset-2 hover:text-[#1a1a1a] hover:underline"
				>
					Logout
				</button>
			</form>
		</div>
	</header>

	<!-- Main content -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Tab sidebar -->
		<TabList />

		<!-- Content editor -->
		<main class="flex-1 overflow-hidden bg-white">
			<ContentEditor />
		</main>

		<!-- Calendar sidebar -->
		<Calendar />
	</div>
</div>

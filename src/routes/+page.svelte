<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import TabList from '$lib/components/TabList.svelte';
	import ContentEditor from '$lib/components/ContentEditor.svelte';
	import Calendar from '$lib/components/Calendar.svelte';
	import { boardStore } from '$lib/stores/board';
	import { initSocket, disconnectSocket, connected } from '$lib/stores/socket';
	import { theme } from '$lib/stores/theme';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let leftSidebarOpen = $state(true);
	let rightSidebarOpen = $state(true);
	let isMobile = $state(false);

	function checkMobile() {
		isMobile = window.innerWidth < 768;
		if (isMobile) {
			leftSidebarOpen = false;
			rightSidebarOpen = false;
		}
	}

	function toggleLeftSidebar() {
		leftSidebarOpen = !leftSidebarOpen;
		if (isMobile && leftSidebarOpen) {
			rightSidebarOpen = false;
		}
	}

	function toggleRightSidebar() {
		rightSidebarOpen = !rightSidebarOpen;
		if (isMobile && rightSidebarOpen) {
			leftSidebarOpen = false;
		}
	}

	function getThemeIcon(currentTheme: string) {
		if (currentTheme === 'light') return 'sun';
		if (currentTheme === 'dark') return 'moon';
		return 'system';
	}

	onMount(() => {
		boardStore.setTabs(data.tabs);
		if (data.user) {
			initSocket(data.user.id);
		}
		checkMobile();
		window.addEventListener('resize', checkMobile);
	});

	onDestroy(() => {
		disconnectSocket();
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', checkMobile);
		}
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

<div
	class="flex h-screen flex-col bg-[var(--bg-primary)]"
	style="font-family: 'IBM Plex Sans', sans-serif;"
>
	<!-- Header -->
	<header
		class="flex h-14 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 md:px-6"
	>
		<div class="flex items-center gap-2 md:gap-3">
			<!-- Left sidebar toggle -->
			<button
				onclick={toggleLeftSidebar}
				class="flex h-8 w-8 items-center justify-center rounded text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] md:hidden"
				title="Toggle tabs"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</button>

			<h1 class="text-lg font-light tracking-tight text-[var(--text-primary)]">Blank Board</h1>
			{#if $connected}
				<span class="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
					<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
					<span class="hidden sm:inline">Live</span>
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-2 md:gap-4">
			<!-- Theme toggle -->
			<button
				onclick={() => theme.toggle()}
				class="flex h-8 w-8 items-center justify-center rounded text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
				title="Toggle theme ({$theme})"
			>
				{#if $theme === 'light'}
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
						/>
					</svg>
				{:else if $theme === 'dark'}
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
						/>
					</svg>
				{:else}
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
				{/if}
			</button>

			<span class="hidden text-sm text-[var(--text-secondary)] sm:inline">{data.user?.username}</span
			>

			<form method="POST" action="/logout" use:enhance>
				<button
					type="submit"
					class="text-sm text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
				>
					Logout
				</button>
			</form>

			<!-- Right sidebar toggle -->
			<button
				onclick={toggleRightSidebar}
				class="flex h-8 w-8 items-center justify-center rounded text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] md:hidden"
				title="Toggle calendar"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</button>
		</div>
	</header>

	<!-- Main content -->
	<div class="relative flex flex-1 overflow-hidden">
		<!-- Mobile overlay -->
		{#if isMobile && (leftSidebarOpen || rightSidebarOpen)}
			<button
				class="absolute inset-0 z-10 bg-black/50"
				onclick={() => {
					leftSidebarOpen = false;
					rightSidebarOpen = false;
				}}
				aria-label="Close sidebar"
			></button>
		{/if}

		<!-- Tab sidebar -->
		<div
			class="absolute left-0 top-0 z-20 h-full transform transition-transform duration-200 md:relative md:translate-x-0
				{leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
		>
			<TabList onTabSelect={() => isMobile && (leftSidebarOpen = false)} />
		</div>

		<!-- Content editor -->
		<main class="flex-1 overflow-hidden bg-[var(--bg-secondary)]">
			<ContentEditor />
		</main>

		<!-- Calendar sidebar -->
		<div
			class="absolute right-0 top-0 z-20 h-full transform transition-transform duration-200 md:relative md:translate-x-0
				{rightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}"
		>
			<Calendar />
		</div>
	</div>
</div>

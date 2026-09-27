<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);
	let search = $state('');
	let sort = $state('storage');
	const users = $derived(
		(data.users ?? [])
			.filter((u) => `${u.label} ${u.id}`.toLowerCase().includes(search.toLowerCase()))
			.sort((a, b) =>
				sort === 'storage'
					? b.fileBytes + b.textBytes - a.fileBytes - a.textBytes
					: b.lastActiveAt.localeCompare(a.lastActiveAt)
			)
	);

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	function timeAgo(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (seconds < 60) return 'just now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	}
</script>

<svelte:head>
	<title>Admin - Blank Board</title>
</svelte:head>

{#if !data.authenticated}
	<!-- Login form -->
	<div class="flex min-h-screen items-center justify-center bg-[#fafafa]">
		<div class="w-full max-w-md px-8">
			<div class="mb-8 text-center">
				<h1 class="text-2xl font-light tracking-tight text-[#1a1a1a]">Admin Login</h1>
				<p class="mt-2 text-sm text-gray-500">Blank Board Administration</p>
			</div>

			<form
				method="POST"
				action="?/login"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
				class="space-y-5"
			>
				{#if form?.message}
					<div class="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
						{form.message}
					</div>
				{/if}

				<div>
					<label for="username" class="block text-sm font-medium text-[#1a1a1a]">Username</label>
					<input
						type="text"
						id="username"
						name="username"
						required
						class="mt-1 block w-full border-0 border-b border-gray-300 bg-transparent px-0 py-2 text-[#1a1a1a] placeholder-gray-400 focus:border-[#1a1a1a] focus:ring-0"
						placeholder="Admin username"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-[#1a1a1a]">Password</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						class="mt-1 block w-full border-0 border-b border-gray-300 bg-transparent px-0 py-2 text-[#1a1a1a] placeholder-gray-400 focus:border-[#1a1a1a] focus:ring-0"
						placeholder="Admin password"
					/>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full border border-[#1a1a1a] bg-[#1a1a1a] py-3 text-sm font-medium text-white transition-colors hover:bg-transparent hover:text-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{loading ? 'Signing in...' : 'Sign in'}
				</button>
			</form>

			<p class="mt-6 text-center text-sm text-gray-500">
				<a
					href={resolve('/')}
					class="text-[#1a1a1a] underline underline-offset-2 hover:no-underline"
				>
					Back to app
				</a>
			</p>
		</div>
	</div>
{:else if data.stats && data.users}
	<!-- Dashboard -->
	<div class="min-h-screen bg-[#fafafa]">
		<header class="border-b border-gray-200 bg-white px-6 py-4">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-xl font-light text-[#1a1a1a]">Admin Dashboard</h1>
					<p class="text-sm text-gray-500">Blank Board Administration</p>
				</div>
				<form method="POST" action="?/logout" use:enhance>
					<button
						type="submit"
						class="text-sm text-gray-500 underline-offset-2 hover:text-[#1a1a1a] hover:underline"
					>
						Logout
					</button>
				</form>
			</div>
		</header>

		<main class="mx-auto max-w-6xl px-6 py-8">
			<!-- Stats grid -->
			<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div class="rounded border border-gray-200 bg-white p-6">
					<p class="text-sm font-medium text-gray-500 uppercase">Total Users</p>
					<p class="mt-2 text-3xl font-light text-[#1a1a1a]">{data.stats.totalUsers}</p>
				</div>
				<div class="rounded border border-gray-200 bg-white p-6">
					<p class="text-sm font-medium text-gray-500 uppercase">Total Tabs</p>
					<p class="mt-2 text-3xl font-light text-[#1a1a1a]">{data.stats.totalTabs}</p>
				</div>
				<div class="rounded border border-gray-200 bg-white p-6">
					<p class="text-sm font-medium text-gray-500 uppercase">R2 Storage</p>
					<p class="mt-2 text-3xl font-light text-[#1a1a1a]">{formatBytes(data.stats.r2Bytes)}</p>
				</div>
			</div>

			<!-- Users table -->
			{#if form?.message}<p class="mb-4 text-sm text-gray-600" role="status">{form.message}</p>{/if}
			<div class="mb-4 flex flex-wrap gap-3">
				<input
					aria-label="Find account by label or hash"
					type="search"
					bind:value={search}
					placeholder="Find label or hash…"
					class="min-w-64 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
				/>
				<select
					aria-label="Sort accounts"
					bind:value={sort}
					class="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
					><option value="storage">Largest storage first</option><option value="active"
						>Recently active</option
					></select
				>
			</div>
			<p class="mb-4 text-xs text-gray-500">
				Labels are visible only here. Text counts note HTML and drop text; files count actual R2
				objects, including retained attachments. These are content sizes, not database billing
				totals.
			</p>
			<div class="rounded border border-gray-200 bg-white">
				<div class="border-b border-gray-200 px-6 py-4">
					<h2 class="text-lg font-medium text-[#1a1a1a]">Users</h2>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50">
							<tr>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Label / account hash</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Notes / drops</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Storage</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Last Active</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each users as user (user.id)}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4 text-xs text-[#1a1a1a]">
										<form method="POST" action="?/label" use:enhance class="mb-2 flex gap-2">
											<input type="hidden" name="userId" value={user.id} /><input
												name="label"
												aria-label={`Label for ${user.id.slice(0, 12)}`}
												value={user.label}
												maxlength="100"
												placeholder="Name this account"
												class="rounded border border-gray-300 bg-white px-2 py-1"
											/><button class="rounded border border-gray-300 px-2 py-1">Save</button>
										</form>
										<details>
											<summary class="cursor-pointer font-mono">{user.id.slice(0, 12)}…</summary
											><span class="block max-w-72 font-mono break-all select-all">{user.id}</span>
										</details>
									</td>
									<td class="px-6 py-4 text-sm text-gray-500">{user.tabCount} / {user.dropCount}</td
									>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500"
										><strong class="text-gray-900"
											>{formatBytes(user.fileBytes + user.textBytes)}</strong
										><br /><span class="text-xs"
											>{formatBytes(user.textBytes)} text · {formatBytes(user.fileBytes)} files</span
										></td
									>
									<td
										class="px-6 py-4 text-sm text-gray-500"
										title={`Created ${formatDate(user.createdAt)}`}>{timeAgo(user.lastActiveAt)}</td
									>
								</tr>
							{/each}
							{#if users.length === 0}
								<tr>
									<td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">
										No matching accounts
									</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</main>
	</div>
{/if}

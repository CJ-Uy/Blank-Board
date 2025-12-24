<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Register - Blank Board</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[#fafafa]">
	<div class="w-full max-w-md px-8">
		<div class="mb-8 text-center">
			<h1 class="text-2xl font-light tracking-tight text-[#1a1a1a]">Blank Board</h1>
			<p class="mt-2 text-sm text-gray-500">Create your account</p>
		</div>

		<form
			method="POST"
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
					value={form?.username ?? ''}
					required
					autocomplete="username"
					class="mt-1 block w-full border-0 border-b border-gray-300 bg-transparent px-0 py-2 text-[#1a1a1a] placeholder-gray-400 focus:border-[#1a1a1a] focus:ring-0"
					placeholder="Choose a username"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-[#1a1a1a]">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					autocomplete="new-password"
					class="mt-1 block w-full border-0 border-b border-gray-300 bg-transparent px-0 py-2 text-[#1a1a1a] placeholder-gray-400 focus:border-[#1a1a1a] focus:ring-0"
					placeholder="Create a password"
				/>
			</div>

			<div>
				<label for="confirmPassword" class="block text-sm font-medium text-[#1a1a1a]"
					>Confirm Password</label
				>
				<input
					type="password"
					id="confirmPassword"
					name="confirmPassword"
					required
					autocomplete="new-password"
					class="mt-1 block w-full border-0 border-b border-gray-300 bg-transparent px-0 py-2 text-[#1a1a1a] placeholder-gray-400 focus:border-[#1a1a1a] focus:ring-0"
					placeholder="Confirm your password"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full border border-[#1a1a1a] bg-[#1a1a1a] py-3 text-sm font-medium text-white transition-colors hover:bg-transparent hover:text-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{loading ? 'Creating account...' : 'Create account'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-gray-500">
			Already have an account?
			<a href="/login" class="text-[#1a1a1a] underline underline-offset-2 hover:no-underline">
				Sign in
			</a>
		</p>
	</div>
</div>

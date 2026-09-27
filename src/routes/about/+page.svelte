<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>About — Blank Board</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-(--bg-primary) px-6 py-12">
	<div class="mx-auto w-full max-w-md flex-1">
		<h1 class="mb-1 text-2xl font-light tracking-tight text-(--text-primary)">Blank Board</h1>
		<p class="mb-10 text-sm text-(--text-muted)">A quiet place for your thoughts.</p>

		<div class="space-y-8 text-sm leading-relaxed text-(--text-secondary)">
			<section>
				<h2 class="mb-2 text-xs font-medium tracking-wider text-(--text-muted) uppercase">
					What it is
				</h2>
				<p>
					Blank Board is a minimal personal scratchpad. No sign-up, no email, no profile. Just a
					canvas for notes, ideas, and anything you want to keep around, available on every device
					you use.
				</p>
			</section>

			<section>
				<h2 class="mb-2 text-xs font-medium tracking-wider text-(--text-muted) uppercase">
					How you log in
				</h2>
				<p>
					Connect your dots, then tap five tiles. Your two patterns are sent over HTTPS and hashed
					by the server to identify your board. The raw patterns are not stored.
				</p>
				<p class="mt-3">
					Because there is no email or username, there is no recovery. Your patterns are your key.
					Keep them.
				</p>
			</section>

			<section>
				<h2 class="mb-2 text-xs font-medium tracking-wider text-(--text-muted) uppercase">
					Real-time sync
				</h2>
				<p>
					Open Blank Board in multiple windows or tabs and changes appear everywhere instantly. Each
					account has a dedicated Cloudflare Durable Object that holds all your active WebSocket
					connections and broadcasts updates between them the moment they happen. If a connection
					drops, the client reconnects automatically and catches up.
				</p>
			</section>

			<section>
				<h2 class="mb-2 text-xs font-medium tracking-wider text-(--text-muted) uppercase">
					Privacy
				</h2>
				<p>
					No analytics, no trackers, no ads. The server stores a hash of your patterns along with
					your notes, uploaded files, session records, and activity timestamps.
				</p>
			</section>
		</div>

		<div class="mt-12">
			<a
				href={resolve('/login')}
				class="text-sm text-(--accent-color) transition-opacity hover:opacity-80"
			>
				← Back to login
			</a>
		</div>
	</div>

	<!-- Secret admin entry — barely visible period in the bottom-right corner -->
	<div class="flex justify-end pr-1 pb-1">
		<a
			href={resolve('/admin')}
			class="text-[10px] text-(--text-muted) opacity-5 transition-opacity duration-300 select-none hover:opacity-40"
			tabindex="-1"
			aria-hidden="true">·</a
		>
	</div>
</div>

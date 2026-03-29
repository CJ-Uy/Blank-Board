<svelte:head>
	<title>About — Blank Board</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-(--bg-primary) px-6 py-12">
	<div class="mx-auto w-full max-w-md flex-1">
		<h1 class="mb-1 text-2xl font-light tracking-tight text-(--text-primary)">Blank Board</h1>
		<p class="mb-10 text-sm text-(--text-muted)">A quiet place for your thoughts.</p>

		<div class="space-y-8 text-sm text-(--text-secondary) leading-relaxed">
			<section>
				<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-(--text-muted)">What it is</h2>
				<p>
					Blank Board is a minimal personal scratchpad that lives in your browser.
					No sign-up, no email, no profile. Just a canvas for notes, ideas, and anything
					you want to keep around.
				</p>
			</section>

			<section>
				<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-(--text-muted)">How you log in</h2>
				<p>
					Instead of a password, you draw two patterns. Those patterns are combined and
					hashed — the result becomes your unique identity on the server. The raw patterns
					never leave your device.
				</p>
				<p class="mt-3">
					Because there's no email or username, there's no recovery. Your patterns are
					your key. Keep them.
				</p>
			</section>

			<section>
				<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-(--text-muted)">Multi-device sync</h2>
				<p>
					Open Blank Board in multiple windows or tabs — changes sync in real time over
					WebSockets. Your board stays consistent across every session as long as you use
					the same patterns.
				</p>
			</section>

			<section>
				<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-(--text-muted)">Privacy</h2>
				<p>
					No analytics, no trackers, no ads. The server stores a hash of your patterns
					and the content of your tabs — nothing else.
				</p>
			</section>
		</div>

		<div class="mt-12">
			<a
				href="/login"
				class="text-sm text-(--accent-color) hover:opacity-80 transition-opacity"
			>
				← Back to login
			</a>
		</div>
	</div>

	<!-- Secret admin entry — barely visible period in the bottom-right corner -->
	<div class="flex justify-end pb-1 pr-1">
		<a
			href="/admin"
			class="text-[10px] opacity-5 hover:opacity-40 transition-opacity duration-300 select-none text-(--text-muted)"
			tabindex="-1"
			aria-hidden="true"
		>·</a>
	</div>
</div>

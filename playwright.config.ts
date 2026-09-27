import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command:
			'pnpm build && pnpm exec wrangler d1 migrations apply DB --local && pnpm exec wrangler dev --port 4173 --var ADMIN_PASSWORD:local-e2e-only',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 180000
	},
	use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
	workers: 1,
	testDir: 'e2e'
});

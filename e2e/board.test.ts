import { expect, test, type Page } from '@playwright/test';

async function openBoard(page: Page) {
	// Disposable local accounts only; the test server always uses Wrangler's local storage.
	const patternB = Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 9)).join('-');
	const login = await page.request.post('/login', {
		headers: { Origin: 'http://localhost:4173' },
		form: { patternA: '7-8-9-6-3-2-1', patternB }
	});
	expect(login.ok()).toBe(true);
	await page.goto('/');
	await expect(page.getByRole('textbox', { name: 'Note content' })).toBeVisible();
}

async function pasteRich(page: Page) {
	const editor = page.getByRole('textbox', { name: 'Note content' });
	await editor.focus();
	await editor.evaluate((element) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData(
			'text/html',
			'<p style="color: rgb(180, 40, 60); font-family: Georgia; font-size: 24px"><strong>Rich heading</strong></p><p>Second line</p>'
		);
		clipboardData.setData('text/plain', 'Rich heading\nSecond line');
		element.dispatchEvent(
			new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
		);
	});
	await expect(page.getByRole('region', { name: 'Paste options' })).toBeVisible();
}

test('drops retain edits, paste images, and enforce account ownership', async ({
	page,
	browser
}) => {
	await openBoard(page);
	await page.getByRole('textbox', { name: 'New drop', exact: true }).fill('Remember this');
	await page.getByRole('textbox', { name: 'New drop', exact: true }).press('Enter');
	const card = page.getByRole('article', { name: 'Text drop', exact: true }).last();
	await expect(card).toContainText('Remember this');
	await card.getByRole('button', { name: 'Edit', exact: true }).click();
	await page.getByRole('textbox', { name: 'Edit drop text' }).fill('Updated thought');
	await page.getByRole('button', { name: 'Save edit' }).click();
	await expect(card).toContainText('Updated thought');
	await page.reload();
	await expect(card).toContainText('Updated thought');
	await page.getByRole('textbox', { name: 'New drop', exact: true }).evaluate(async (element) => {
		const canvas = document.createElement('canvas');
		canvas.width = 8;
		canvas.height = 8;
		canvas.getContext('2d')!.fillRect(0, 0, 8, 8);
		const bytes = await new Promise<Blob>((resolve) =>
			canvas.toBlob((blob) => resolve(blob!), 'image/png')
		);
		const clipboardData = new DataTransfer();
		clipboardData.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }));
		element.dispatchEvent(
			new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
		);
	});
	await expect(page.getByAltText('preview')).toBeVisible();
	await page.getByRole('button', { name: 'Send', exact: true }).first().click();
	await expect(page.getByRole('article', { name: 'image drop', exact: true })).toBeVisible();
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.getByRole('button', { name: 'Copy image', exact: true }).click();
	await expect(page.getByText('Image copied', { exact: true })).toBeVisible();
	const tabs = await (await page.request.get('/api/tabs')).json();
	const drops = await (await page.request.get(`/api/drops?tabId=${tabs[0].id}`)).json();
	const other = await browser.newContext();
	const otherPage = await other.newPage();
	await openBoard(otherPage);
	expect(
		(
			await otherPage.request.patch(`/api/drops/${drops[0].id}`, { data: { content: 'No access' } })
		).status()
	).toBe(404);
	await other.close();
});

test('notes can be found by content and pinned across reloads', async ({ page }) => {
	await openBoard(page);
	const tabs = await (await page.request.get('/api/tabs')).json();
	await page.request.patch(`/api/tabs/${tabs[0].id}`, {
		data: { name: 'Research', content: '<p>Unique comet notes</p>' }
	});
	await page.reload();
	await page.getByRole('searchbox', { name: 'Search notes' }).fill('comet');
	await expect(page.getByRole('button', { name: 'Pin Research', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Pin Research', exact: true }).click();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Unpin Research', exact: true })).toBeVisible();
	await page.getByRole('searchbox', { name: 'Search notes' }).fill('no such note');
	await expect(page.getByText('No matching notes. Try another word.')).toBeVisible();
});

test('pomodoro dings, advances automatically, pauses, skips, and saves stats once', async ({
	page
}) => {
	await page.clock.install({ time: new Date(Date.now() - 3600000) });
	await page.addInitScript(() => {
		const original = AudioContext.prototype.createOscillator;
		AudioContext.prototype.createOscillator = function () {
			const root = window as Window & { dingNotes?: number };
			root.dingNotes = (root.dingNotes ?? 0) + 1;
			return original.call(this);
		};
	});
	await openBoard(page);
	await page.getByLabel('Pomodoro timer', { exact: true }).click();
	await page.getByText('Timer settings', { exact: true }).click();
	await page.getByRole('spinbutton', { name: 'Focus minutes', exact: true }).fill('1');
	await page.getByRole('spinbutton', { name: 'Short break minutes', exact: true }).fill('1');
	await page.getByRole('button', { name: 'Save settings', exact: true }).click();
	await page.getByRole('button', { name: 'Start focus', exact: true }).click();
	await page.clock.fastForward(61000);
	await expect(page.getByRole('status').filter({ hasText: 'Short break' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => (window as Window & { dingNotes?: number }).dingNotes))
		.toBe(2);
	await expect
		.poll(async () => (await (await page.request.get('/api/pomodoros')).json()).length)
		.toBe(1);
	await page.clock.fastForward(61000);
	await expect(page.getByRole('status').filter({ hasText: 'Focus' })).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => (window as Window & { dingNotes?: number }).dingNotes))
		.toBe(4);
	await page.getByRole('button', { name: 'Skip', exact: true }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Short break' })).toBeVisible();
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	await page.reload();
	await page.locator('.pomodoro > summary').click();
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Restart', exact: true }).click();
	await expect(page.getByLabel('Short break time remaining')).toHaveText('01:00');
	const sessions = await (await page.request.get('/api/pomodoros')).json();
	expect(sessions).toHaveLength(1);
	expect(
		(
			await page.request.post('/api/pomodoros', {
				data: { ...sessions[0], completedAt: new Date(sessions[0].completedAt).getTime() }
			})
		).ok()
	).toBe(true);
	expect(await (await page.request.get('/api/pomodoros')).json()).toHaveLength(1);
	await page.screenshot({ path: 'test-results/pomodoro.png', animations: 'disabled' });
});

test('admin labels and per-account storage require a real admin session', async ({ page }) => {
	await openBoard(page);
	const tabList = await (await page.request.get('/api/tabs')).json();
	await page.request.patch(`/api/tabs/${tabList[0].id}`, {
		data: { content: '<p>Storage test</p>' }
	});
	await page.goto('/admin');
	await page.getByRole('textbox', { name: 'Username', exact: true }).fill('admin');
	await page.getByLabel('Password', { exact: true }).fill('local-e2e-only');
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
	const row = page.locator('tbody tr').first();
	await row.getByRole('textbox').fill('Local test account');
	await row.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Label saved');
	await page.reload();
	await page
		.getByRole('searchbox', { name: 'Find account by label or hash' })
		.fill('Local test account');
	await expect(page.locator('tbody').getByRole('textbox').first()).toHaveValue(
		'Local test account'
	);
	await expect(page.locator('tbody')).toContainText('text');
	await page.getByRole('button', { name: 'Logout', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Admin Login', exact: true })).toBeVisible();
	const response = await page.request.post('/admin?/label', {
		headers: { Origin: 'http://localhost:4173', Accept: 'application/json' },
		form: { userId: 'fake', label: 'blocked' }
	});
	expect(await response.json()).toMatchObject({ type: 'failure', status: 401 });
});

test('sign-in preserves skipped dots and repeated tiles, with undo and back', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.keyboard.press('7');
	await page.keyboard.press('9');
	await expect(page.locator('input[name="patternA"]')).toHaveValue('7-8-9');
	await page.getByRole('button', { name: 'Continue' }).click();
	for (let i = 0; i < 5; i++) await page.keyboard.press('5');
	await expect(page.locator('input[name="patternB"]')).toHaveValue('5-5-5-5-5');
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Open my board' })).toBeDisabled();
	await page.getByRole('button', { name: 'Back to dots' }).click();
	await expect(page.locator('input[name="patternA"]')).toHaveValue('7-8-9');
});

test('paste keeps source formatting, offers plain text, and supports undo', async ({ page }) => {
	await openBoard(page);
	await pasteRich(page);
	const editor = page.getByRole('textbox', { name: 'Note content' });
	await expect(editor.locator('strong')).toHaveText('Rich heading');
	await expect(editor.locator('strong')).toHaveCSS('color', 'rgb(180, 40, 60)');
	await page.getByRole('button', { name: 'Use plain text' }).click();
	await expect(editor).toContainText('Rich heading');
	await expect(editor.locator('strong')).toHaveCount(0);
	await editor.press('Control+z');
	await expect(editor.locator('strong')).toHaveText('Rich heading');
});

test('match note style retains meaning and strips foreign styles', async ({ page }) => {
	await openBoard(page);
	await pasteRich(page);
	await page.getByRole('button', { name: 'Match note style' }).click();
	const editor = page.getByRole('textbox', { name: 'Note content' });
	await expect(editor.locator('strong, b')).toHaveText('Rich heading');
	await expect(editor.locator('[style*="Georgia"], [style*="180"]')).toHaveCount(0);
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();
	await page.reload();
	await expect(editor).toContainText('Second line');
});

test('typing after paste dismisses review and preserves source formatting', async ({ page }) => {
	await openBoard(page);
	await pasteRich(page);
	const editor = page.getByRole('textbox', { name: 'Note content' });
	await editor.press('End');
	await page.keyboard.type(' plus a note');
	await expect(page.getByRole('region', { name: 'Paste options' })).toHaveCount(0);
	await expect(editor).toContainText('plus a note');
	await expect(editor.locator('[style*="Georgia"]')).not.toHaveCount(0);
});

test('failed save is visible and retry persists the draft', async ({ page }) => {
	await openBoard(page);
	await page.route('**/api/tabs/*', (route) =>
		route.request().method() === 'PATCH' ? route.fulfill({ status: 503 }) : route.continue()
	);
	const editor = page.getByRole('textbox', { name: 'Note content' });
	await editor.fill('Keep this draft');
	await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
	await page.unroute('**/api/tabs/*');
	await page.getByRole('button', { name: 'Retry save' }).click();
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();
	await page.reload();
	await expect(editor).toHaveText('Keep this draft');
});

test('mobile sign-in and board fit the viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/login');
	await expect(page.getByRole('heading', { name: 'Connect your dots' })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
	await openBoard(page);
	await expect(page.getByRole('textbox', { name: 'Note content' })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await expect(page.getByRole('button', { name: 'Toggle tabs' })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await expect(page.getByRole('button', { name: 'Toggle drops' })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await page.screenshot({
		path: 'test-results/board-mobile.png',
		fullPage: true,
		animations: 'disabled'
	});
});

test('forged admin cookies cannot access account data', async ({ request }) => {
	const response = await request.get('/admin', {
		headers: { Cookie: 'admin-session=authenticated' }
	});
	expect(await response.text()).not.toContain('Total Users');
	expect(await response.text()).toContain('password');
});

test('drawing feels like a pattern lock and each gesture starts fresh', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	const grid = await page.getByRole('group', { name: 'Connect pattern' }).boundingBox();
	if (!grid) throw new Error('Pattern grid missing');
	const point = (column: number, row: number) => ({
		x: grid.x + (grid.width * (column + 0.5)) / 3,
		y: grid.y + (grid.height * (row + 0.5)) / 3
	});
	const start = point(0, 0);
	const end = point(2, 2);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 12 });
	await page.mouse.up();
	await expect(page.locator('input[name="patternA"]')).toHaveValue('7-5-3');
	await page.screenshot({ path: 'test-results/pattern-lock.png', fullPage: true });
	const left = point(0, 2);
	const right = point(2, 2);
	await page.mouse.move(left.x, left.y);
	await page.mouse.down();
	await page.mouse.move(right.x, right.y, { steps: 12 });
	await page.mouse.up();
	await expect(page.locator('input[name="patternA"]')).toHaveValue('1-2-3');
});

test('rich paste stays styled after reload and unsafe markup is removed', async ({ page }) => {
	await openBoard(page);
	await pasteRich(page);
	await page.screenshot({ path: 'test-results/paste-review.png', fullPage: true });
	await page.getByRole('button', { name: 'Keep original' }).click();
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();
	await page.reload();
	const editor = page.getByRole('textbox', { name: 'Note content' });
	await expect(editor.locator('[style*="Georgia"]')).not.toHaveCount(0);
	await editor.focus();
	await editor.evaluate((element) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData(
			'text/html',
			'<p onclick="alert(1)" style="position:fixed; background-image:url(https://example.com/tracker)">Safe text</p><img src="x" onerror="alert(1)"><iframe src="https://example.com"></iframe><a href="javascript:alert(1)">Link</a>'
		);
		clipboardData.setData('text/plain', 'Safe text Link');
		element.dispatchEvent(
			new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
		);
	});
	await expect(
		editor.locator(
			'iframe, [onclick], [onerror], [href^="javascript:"], [style*="fixed"], [style*="url("]'
		)
	).toHaveCount(0);
});

test('one WebSocket per page and saved edits reach another window', async ({ page, context }) => {
	let sockets = 0;
	page.on('websocket', () => sockets++);
	await openBoard(page);
	const other = await context.newPage();
	await other.goto('/');
	await expect(other.getByText('Live', { exact: true })).toBeVisible();
	await page.getByRole('textbox', { name: 'Note content' }).fill('Synced across windows');
	await expect(other.getByRole('textbox', { name: 'Note content' })).toHaveText(
		'Synced across windows'
	);
	expect(sockets).toBe(1);
	await other.close();
});

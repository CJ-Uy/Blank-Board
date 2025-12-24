import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark' | 'system';

function createThemeStore() {
	const storedTheme = browser ? (localStorage.getItem('theme') as Theme) : null;
	const { subscribe, set, update } = writable<Theme>(storedTheme || 'system');

	function applyTheme(theme: Theme) {
		if (!browser) return;

		const root = document.documentElement;
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

		if (isDark) {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
	}

	return {
		subscribe,
		set: (theme: Theme) => {
			if (browser) {
				localStorage.setItem('theme', theme);
			}
			applyTheme(theme);
			set(theme);
		},
		toggle: () => {
			update((current) => {
				const newTheme = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
				if (browser) {
					localStorage.setItem('theme', newTheme);
				}
				applyTheme(newTheme);
				return newTheme;
			});
		},
		init: () => {
			if (!browser) return;
			const stored = localStorage.getItem('theme') as Theme;
			const theme = stored || 'system';
			applyTheme(theme);
			set(theme);

			// Listen for system theme changes
			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
				const currentTheme = localStorage.getItem('theme') as Theme;
				if (currentTheme === 'system') {
					applyTheme('system');
				}
			});
		}
	};
}

export const theme = createThemeStore();

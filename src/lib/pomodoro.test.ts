import { describe, it, expect } from 'vitest';
import { advance, defaults, freshTimer, remainingSeconds, validSettings } from './pomodoro';

describe('automatic pomodoro cycle', () => {
	it('counts completed focus only, auto-starts breaks and takes a long break every fourth', () => {
		let timer = { ...freshTimer(), id: crypto.randomUUID(), started: true, endsAt: 1500000 };
		for (let i = 1; i <= 4; i++) {
			const result = advance(timer, defaults, timer.endsAt!);
			expect(result.session?.seconds).toBe(1500);
			expect(result.timer.phase).toBe(i === 4 ? 'long' : 'short');
			expect(result.timer.endsAt).not.toBeNull();
			const rest = advance(result.timer, defaults, result.timer.endsAt!);
			expect(rest.session).toBeUndefined();
			timer = rest.timer as typeof timer;
		}
		const skipped = advance(timer, defaults, timer.endsAt!, true);
		expect(skipped.session).toBeUndefined();
		expect(skipped.timer.completed).toBe(4);
	});
	it('uses wall time and preserves pause; does not fabricate sessions after sleep', () => {
		const timer = { ...freshTimer(), id: crypto.randomUUID(), endsAt: 1500000 };
		expect(remainingSeconds(timer, 1499500)).toBe(1);
		expect(remainingSeconds(timer, 2000000)).toBe(0);
		expect(advance(timer, defaults, 2000000).timer.endsAt).toBe(2300000);
		expect(advance({ ...timer, endsAt: null }, defaults, 2000000, true).timer.endsAt).toBeNull();
		expect(validSettings({ ...defaults, focus: 0 })).toBe(false);
	});
});

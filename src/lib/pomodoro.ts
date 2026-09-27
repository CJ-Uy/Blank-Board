export type Phase = 'focus' | 'short' | 'long';
export const phaseNames = { focus: 'Focus', short: 'Short break', long: 'Long break' };
export const defaults = { focus: 25, short: 5, long: 15, rounds: 4 };
export type Settings = typeof defaults;
export type Session = { id: string; seconds: number; completedAt: number };
export type Timer = {
	phase: Phase;
	remaining: number;
	duration: number;
	endsAt: number | null;
	started: boolean;
	completed: number;
	id: string;
};
export function freshTimer(settings = defaults): Timer {
	return {
		phase: 'focus',
		remaining: settings.focus * 60,
		duration: settings.focus * 60,
		endsAt: null,
		started: false,
		completed: 0,
		id: ''
	};
}
export function remainingSeconds(timer: Timer, now: number) {
	return timer.endsAt === null
		? timer.remaining
		: Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}
export function advance(
	timer: Timer,
	settings: Settings,
	now: number,
	skipped = false
): { timer: Timer; session?: Session } {
	const completed = timer.completed + (timer.phase === 'focus' && !skipped ? 1 : 0);
	const phase: Phase =
		timer.phase !== 'focus'
			? 'focus'
			: !skipped && completed % settings.rounds === 0
				? 'long'
				: 'short';
	const duration = settings[phase] * 60;
	return {
		timer: {
			phase,
			duration,
			remaining: duration,
			endsAt: timer.endsAt === null ? null : now + duration * 1000,
			started: true,
			completed,
			id: crypto.randomUUID()
		},
		...(timer.phase === 'focus' && !skipped
			? { session: { id: timer.id, seconds: timer.duration, completedAt: timer.endsAt ?? now } }
			: {})
	};
}
export function validSettings(value: unknown): value is Settings {
	if (!value || typeof value !== 'object') return false;
	const s = value as Settings;
	return (
		[s.focus, s.short, s.long].every((n) => Number.isInteger(n) && n >= 1 && n <= 180) &&
		Number.isInteger(s.rounds) &&
		s.rounds >= 1 &&
		s.rounds <= 12
	);
}

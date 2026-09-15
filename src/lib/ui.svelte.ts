export type ContextChip = { label: string; personId?: string; threadId?: string; meetingId?: string };
export type Toast = { id: number; msg: string; undo?: () => void; secondsLeft?: number; done?: string };

export const ui = $state({
	toast: null as Toast | null,
	approvalDrawer: false,
	activityDrawer: false,
	palette: false,
	mobileMenu: false,
	context: null as ContextChip | null,
	voice: false
});

let seq = 0;
let timer: ReturnType<typeof setInterval> | null = null;

export function toast(msg: string, opts: { undo?: () => void; seconds?: number; done?: string } = {}) {
	if (timer) clearInterval(timer);
	const t: Toast = { id: ++seq, msg, undo: opts.undo, secondsLeft: opts.seconds, done: opts.done };
	ui.toast = t;
	const total = opts.seconds ?? 4;
	let left = total;
	timer = setInterval(() => {
		left -= 1;
		if (ui.toast?.id !== t.id) {
			clearInterval(timer!);
			return;
		}
		if (opts.seconds) ui.toast.secondsLeft = left;
		if (left <= 0) {
			clearInterval(timer!);
			// done があれば完了表示に差し替え、4 秒後に消す
			if (opts.done) {
				ui.toast = { id: t.id, msg: opts.done };
				setTimeout(() => {
					if (ui.toast?.id === t.id) ui.toast = null;
				}, 4000);
			} else ui.toast = null;
		}
	}, 1000);
}

export function dismissToast() {
	ui.toast = null;
}

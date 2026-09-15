export type ContextChip = { label: string; personId?: string; threadId?: string; meetingId?: string };
export type Toast = {
	id: number;
	msg: string;
	undo?: () => void;
	secondsLeft?: number;
	done?: string;
	leaving?: boolean;
};

export const ui = $state({
	toast: null as Toast | null,
	approvalDrawer: false,
	activityDrawer: false,
	palette: false,
	mobileMenu: false,
	context: null as ContextChip | null,
	voice: false
});

let overlays = 0;

/** app.css の body[data-overlay='on'] を生かす。ドロワーとモーダルが 1 枚でも出ている間だけ立てる */
export function markOverlay(open: boolean) {
	overlays = Math.max(0, overlays + (open ? 1 : -1));
	if (overlays > 0) document.body.dataset.overlay = 'on';
	else delete document.body.dataset.overlay;
}

let seq = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/** 退場の長さ。visual.md 4.12 の表 (退場 200ms) と app.css の --d-exit に合わせる */
const EXIT_MS = 200;

/** 退場のアニメーションを見せてから消す。先に leaving を立て、200 ミリ秒後に null にする */
function closeToast(id: number) {
	const t = ui.toast;
	if (!t || t.id !== id) return;
	t.leaving = true;
	setTimeout(() => {
		if (ui.toast?.id === id) ui.toast = null;
	}, EXIT_MS);
}

export function toast(msg: string, opts: { undo?: () => void; seconds?: number; done?: string } = {}) {
	if (timer) clearInterval(timer);
	const t: Toast = { id: ++seq, msg, undo: opts.undo, secondsLeft: opts.seconds, done: opts.done };
	ui.toast = t;
	let left = opts.seconds ?? 4;
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
				setTimeout(() => closeToast(t.id), 4000);
			} else closeToast(t.id);
		}
	}, 1000);
}

export function dismissToast() {
	if (ui.toast) closeToast(ui.toast.id);
}

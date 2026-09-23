export type ContextChip = { label: string; personId?: string; threadId?: string; meetingId?: string };
export type Toast = {
	id: number;
	msg: string;
	undo?: () => void;
	/** 取り消しの猶予秒数。CSS アニメーションの長さに使うので、カウントダウン中も変えない */
	seconds?: number;
	secondsLeft?: number;
	/** 取り消しの猶予を持って始まったトースト。猶予が切れたあとも立てたままにし、
	    デスクトップでは上部バーのピルの中で本文を出し続ける (Header.svelte) */
	island?: boolean;
	leaving?: boolean;
};

export const ui = $state({
	toast: null as Toast | null,
	approvalDrawer: false,
	activityDrawer: false,
	palette: false,
	mobileMenu: false,
	/** デモをリセットの確かめ。上部バーのメニューと ⌘K の両方から立てる (Task 10m) */
	demoReset: false,
	context: null as ContextChip | null,
	voice: false
});

/* 上部バーの板 (PillPanel) と「デモの操作」のメニュー (DemoMenu) は 1 つずつしか開かない。
   bits-ui の Popover / DropdownMenu は Root ごとに独立して開くので、開いている 1 つを
   ここで覚え、各 Root の open をこの値から引く。開き直すと他は閉じる */
export const panels = $state({ open: null as string | null });

/** 依頼バーの入力欄へ焦点を移す。'.chatbar input' の知識をここ 1 か所に閉じる */
export function focusChatbar() {
	document.querySelector<HTMLInputElement>('.chatbar input')?.focus();
}

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

/**
 * 送信は完了として即座に伝える (Gmail の送信取り消しと同じ順序、指摘 2)。取り消せる間だけ
 * ゲージと残り秒数を出す。ゲージの見た目は CSS アニメーション (app.css の toast-countdown)
 * が受け持ち、ここでは残り秒数の「数字」だけを 1 秒ごとに進める。数字は
 * prefers-reduced-motion でアニメーションが切れても残るので (components 3.7)、
 * 更新自体はやめない
 */
export function toast(msg: string, opts: { undo?: () => void; seconds?: number } = {}) {
	if (timer) clearInterval(timer);
	const t: Toast = { id: ++seq, msg, undo: opts.undo, seconds: opts.seconds, secondsLeft: opts.seconds, island: !!opts.seconds };
	ui.toast = t;
	if (!opts.seconds) return;
	let left = opts.seconds;
	timer = setInterval(() => {
		left -= 1;
		if (ui.toast?.id !== t.id) {
			clearInterval(timer!);
			return;
		}
		if (left <= 0) {
			clearInterval(timer!);
			// 取り消しボタンとゲージだけを引っ込める。本文は消さない (components 3.7)
			ui.toast = { id: t.id, msg: t.msg, island: true };
			/* 本文は取り消しなしのトーストの表示時間 (components 3.7 の 4000ms) だけ残して閉じる。
			   閉じないとデスクトップのピルが伸びたまま戻らない。取り消しは作業履歴からできるので、
			   消えても時間制限にはならない (同 3.7、WCAG 2.2.1) */
			setTimeout(() => closeToast(t.id), 4000);
		} else {
			ui.toast.secondsLeft = left;
		}
	}, 1000);
}

export function dismissToast() {
	if (ui.toast) closeToast(ui.toast.id);
}

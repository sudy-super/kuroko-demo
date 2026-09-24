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
	/** どの操作のトーストかを表す識別子 (承認の id など)。dismissToast(key) に渡すと、
	    今のトーストがその操作のものだったときだけ閉じる (レビュー M2) */
	key?: string;
};

export const ui = $state({
	toast: null as Toast | null,
	approvalDrawer: false,
	/** 承認待ちカードから開いたときの、カードの位置と寸法。Drawer.svelte がここから
	    広がる/ここへ縮むアニメーションの起点にする (開いた瞬間に Drawer が控える)。
	    閉じたら ApprovalDrawer が null に戻す。Today のカード以外 (上部バー・会議の案内など)
	    から開いたときは null のまま (docs/research/card-expand.md) */
	approvalFrom: null as DOMRect | null,
	/** 承認待ちカードを隠す (visibility: hidden) かどうか。approvalFrom は開いた瞬間に
	    使い切って null に戻すので、縮み終わるまでカードを隠し続けるにはこちらの寿命が要る
	    (レビュー C2/I1)。Today のカードの onclick で true、Drawer.svelte の後始末で false */
	approvalCardHidden: false,
	activityDrawer: false,
	palette: false,
	mobileMenu: false,
	/** デモをリセットの確かめ。上部バーのメニューと ⌘K の両方から立てる (Task 10m) */
	demoReset: false,
	context: null as ContextChip | null,
	voice: false,
	/** Today の環状配置が出ている間だけ立つ。立っている間の音声は全画面の覆いを出さず、
	    Today の上でカードを退かせて聞く (today/+page.svelte、docs/research/voice-orb.md) */
	voiceHere: false,
	/** サイドナビを格納しているか (961px 以上のみ意味を持つ)。初期値は localStorage から
	    ((app)/+layout.svelte の $effect で保存。docs/research/side-collapse.md) */
	sideHidden: typeof localStorage !== 'undefined' && localStorage.getItem('kuroko-side-hidden') === '1'
});

/* 上部バーの板 (PillPanel) と「デモの操作」のメニュー (DemoMenu) は 1 つずつしか開かない。
   bits-ui の Popover / DropdownMenu は Root ごとに独立して開くので、開いている 1 つを
   ここで覚え、各 Root の open をこの値から引く。開き直すと他は閉じる */
export const panels = $state({ open: null as string | null });

/** 音声の聞き取りを止めたときに、依頼バーの入力欄へ渡す文字 (KurokoBar が受け取って空にする)。
    ChatGPT の音声入力と同じく、止めたら聞き取った文字を入力欄に置き、直してから送れるようにする
    (ユーザー指摘 2026-09-24) */
export const dictated = $state({ text: '' });

/** 依頼バーの入力欄へ焦点を移す。'.chatbar input' の知識をここ 1 か所に閉じる */
export function focusChatbar() {
	document.querySelector<HTMLInputElement>('.chatbar input')?.focus();
}

let overlays = 0;

/** app.css の body[data-overlay='on'] を生かす。ドロワーとモーダルが 1 枚でも出ている間だけ立てる。
    Drawer/Modal は枠 (上部バー・サイドナビ・連携の列) を押せるよう trapFocus を外したので、
    本文と依頼バー・ボトムナビは覆いが開いている間 inert にして Tab を通さない
    (レビュー I3 — 外さないと覆いの後ろ・真下の要素に焦点が入り、見えないまま操作できてしまう) */
export function markOverlay(open: boolean) {
	overlays = Math.max(0, overlays + (open ? 1 : -1));
	if (overlays > 0) document.body.dataset.overlay = 'on';
	else delete document.body.dataset.overlay;
	document
		.querySelectorAll<HTMLElement>('.main, .chatbar, .bottomnav')
		.forEach((e) => (e.inert = overlays > 0));
}

/** 遷移で閉じる覆いの一覧をここ 1 か所に集める (レビュー I4)。新しい覆いを ui に足したら、
    ここにも足すこと */
export function closeOverlays() {
	ui.approvalDrawer = false;
	ui.activityDrawer = false;
	ui.palette = false;
	ui.demoReset = false;
	ui.voice = false;
	ui.mobileMenu = false;
}

/** Drawer/Modal の onInteractOutside で共通に使う判定 (レビュー M7)。枠 (上部バー・
    サイドナビ・連携の列) と枠から開く板を押しても覆いを閉じない (ユーザー指示 2026-09-23:
    枠はどの覆いが開いていても触れる)。サイドナビのリンクは遷移するので、覆いは遷移で閉じる */
export function keepOpenOnFrame(e: Event) {
	if ((e.target as Element | null)?.closest('.header.glass, .sidebar, .rail, .pill-panel, .demo-menu'))
		e.preventDefault();
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
export function toast(msg: string, opts: { undo?: () => void; seconds?: number; key?: string } = {}) {
	if (timer) clearInterval(timer);
	const t: Toast = {
		id: ++seq,
		msg,
		undo: opts.undo,
		seconds: opts.seconds,
		secondsLeft: opts.seconds,
		island: !!opts.seconds,
		key: opts.key
	};
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
			ui.toast = { id: t.id, msg: t.msg, island: true, key: t.key };
			/* 本文は取り消しなしのトーストの表示時間 (components 3.7 の 4000ms) だけ残して閉じる。
			   閉じないとデスクトップのピルが伸びたまま戻らない。取り消しは作業履歴からできるので、
			   消えても時間制限にはならない (同 3.7、WCAG 2.2.1) */
			setTimeout(() => closeToast(t.id), 4000);
		} else {
			ui.toast.secondsLeft = left;
		}
	}, 1000);
}

/** key を渡すと、今のトーストがその key のものだったときだけ閉じる (レビュー M2 —
    別の送信の取り消しが今表示中のトーストを誤って閉じないようにする)。渡さなければ従来どおり
    常に今のトーストを閉じる (ToastCountdown の「取り消す」ボタンなど) */
export function dismissToast(key?: string) {
	if (!ui.toast) return;
	if (key !== undefined && ui.toast.key !== key) return;
	closeToast(ui.toast.id);
}

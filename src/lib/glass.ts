/* Liquid Glass — apple-liquid-glass-webgl (WebGL2) を要素に載せる Svelte の attachment。角丸は CSS の
   border-radius を読む。WebGL2 が無い環境では backdrop-filter に落ち、data-liquid-glass="fallback" が付く */
import {
	LiquidGlass,
	type LiquidGlassElementOptions,
	type LiquidGlassBackdropPainter
} from 'apple-liquid-glass-webgl';
import { whileVisible } from './visible';

/* 反射の無い Liquid Glass の材質。面の中はほぼ素通しで、縁の帯だけ像を曲げる。
   hairline は背景の明暗で白か黒を選ぶ輪郭線で、光を映すものではないので残す。
   rim / reflection / highlight / echo は 0。そのとき lightAngle は使われないので置かない */
const LENS = {
	refraction: 110,
	edgeReach: 0.5,
	edgeWidth: 0.5,
	dispersion: 1.5,
	rim: 0,
	reflection: 0,
	highlight: 0,
	echo: 0,
	hairline: 0.45
} as const;

/* ナビ層のうち下を色や形だけが通るもの (CHROME_TIERS の `.sidebar, .rail`) の塗り。
   tint はライブラリの 0〜1.5 の目盛りで、CSS の不透明度とは一致しない */
export const CLEAR = { tint: 0.14 } as const;

/* 上部バーと依頼バーの下は本文の文字が通るので、iOS のバーと同じく下をぼかして溶かす */
export const BAR: LiquidGlassElementOptions = {
	tint: 0.8,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 14 }
};

/* ドロワー・シート・モーダル・ポップオーバー・メニュー。文字が多いので HIG Materials の regular 変種に
   沿い、ナビ層より塗りを濃く・ぼかしを強くする。塗りは上限 1.5 でも、オーブの直上では文字色側の
   調整が要る (styles/palette.css の .pal-src) */
export const SHEET: LiquidGlassElementOptions = {
	tint: 1.5,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 22 }
};

/* 内容カード。背後に来るオーブが面越しに屈折しつつ透けて見えるよう、塗りは薄く */
export const CARD: LiquidGlassElementOptions = {
	tint: 0.5,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 2 }
};

/* 表示の切り替え (Segmented.svelte) のつまみ。押している間だけガラスにする (WWDC25 "segmented pickers ...
   transform into liquid glass during interaction"、docs/research/segmented-liquid-glass.md) */
export const THUMB: LiquidGlassElementOptions = {
	tint: 0.1,
	tintTone: 'light',
	/* 下は平らな灰色の地で屈折が見えにくいので、輪郭の線だけライブラリの既定まで上げる。
	   反射 (rim / highlight) は枠のガラスと同じく付けない */
	material: { ...LENS, backdropBlur: 0, hairline: 0.92 }
};

/** 押している間だけつまみをガラスにする。描画面は押すたびに取り、離して settleMs 後に手放す
    (常駐させると 1 ページの上限 約 16 を食う)。選択は離したときの click で変わるので、すぐ戻すと
    つまみが動く間にもう普通の塗りになる。onchange には押している間かどうかを渡す */
export function pressGlass(onchange: (pressed: boolean) => void, settleMs = 360) {
	let instance: LiquidGlass | null = null;
	let settle: ReturnType<typeof setTimeout> | undefined;
	const release = () => {
		clearTimeout(settle);
		instance?.destroy();
		instance = null;
		onchange(false);
	};
	return {
		press(node: HTMLElement) {
			clearTimeout(settle);
			instance ??= new LiquidGlass(node, { live: true, respectReducedTransparency: false, ...THUMB });
			onchange(true);
		},
		lift() {
			if (!instance) return;
			clearTimeout(settle);
			settle = setTimeout(release, settleMs);
		},
		release
	};
}

/* カードのガラスの背後にオーブを届ける描き手。ライブラリの itemsBelow は宿主 (.bento) より DOM で
   後ろのものを除くので、子孫のオーブは 'auto' だけでは映らない (README の "point at it")。
   canvas は Orb.svelte が非同期に作るので、毎フレーム getCanvas() で最新を読む */
export function orbBackdrop(getCanvas: () => HTMLCanvasElement | null): LiquidGlassBackdropPainter {
	return (ctx) => {
		const canvas = getCanvas();
		if (!canvas || canvas.classList.contains('off')) return;
		const box = canvas.getBoundingClientRect();
		ctx.drawImage(canvas, box.left, box.top, box.width, box.height);
	};
}

/* live: true で毎フレーム描き直す。オーブの canvas の変化はライブラリに通知されないので、
   止めるとガラスの中だけ背景が止まる。maxDpr は既定の 2 (1 だと高密度の画面で解像度が半分)。
   respectReducedTransparency: false — OS 設定には応答しない */
export function glass(options: LiquidGlassElementOptions) {
	return (node: Element) => mount(node as HTMLElement, options, undefined, undefined, true);
}

/* 枠の 5 面 (サイドナビ、上部バー、連携の列、携帯のボトムナビと上部バー) を 1 枚の canvas にまとめる。
   面ごとに描画面 (WebGL context) を取ると、タブ 3 枚でブラウザの上限 (1 ページ約 16) に届く。
   面は層 (.chrome) の子ではなくきょうだいにする。入れ物の子孫は背後の絵から外れるので、子にすると
   上部バーが下の文字を溶かせない。層にまとめた面どうしは互いを映せないが、5 面は重ならない。
   ぼかしは描画面ごとの値なので 5 面すべてに BAR の値が当たる。bleed: 0 は層が画面いっぱいだから
   (既定の bleed だと広い canvas を毎フレーム塗り直す) */
const CHROME_TIERS = {
	'.sidebar, .rail, .side-toggle': CLEAR.tint as number,
	'.header.glass, .header.solid, .bottomnav': BAR.tint as number
};

/* 依頼バーは層に入れず、自分の描画面を持つ。層に乗せると自身の文字や塗りが背後の絵に入らなくなる */
export const barGlass = (node: Element) => mount(node as HTMLElement, BAR);

/* 50ms — 枠の層を毎フレーム描き直すと本文の文字を 60 回/秒描き起こし、カレンダーの月表示が 25fps まで落ちた。
   この間隔が要るのは知らせずに描き変わるオーブの canvas のためだけで、20 回/秒でも見た目は変わらない */
export const chromeGlass = (node: Element) =>
	mount(node as HTMLElement, { ...BAR, bleed: 0 }, 50, CHROME_TIERS);

/* Portal で <body> 直下に出るドロワー・シート・モーダル・ポップオーバー・メニューをまとめて描く層。
   chromeGlass と同じ「空の層 1 枚 + tiers」。scrim (70) と面 (75) の間の 71 に敷く。
   .select-menu (80) は含めない。モーダルの中で開くので、一覧のすぐ後ろはこの層ではなくモーダル自身になり、
   canvas の塗りが画面に出ない。CSS の backdrop-filter で真後ろを直接ぼかす */
/* .overlay-chrome-anchor — 常駐する幅 0 の印。targets が空だとライブラリは host 全体を 1 枚のガラスとして
   描き (dom.js buildElements)、覆いが無いときに画面全体がぼやける。幅 0 なので描画からは除かれる */
const OVERLAY_TIERS = {
	/* .panel-center — 承認待ちの中央寄り固定パネル (ApprovalDrawer だけが使う variant="center")。
	   .modal と同じ SHEET の塗り・ぼかしをそのまま使う */
	'.drawer, .sheet, .modal, .panel-center': SHEET.tint as number,
	/* トーストは入れない。この層の canvas はトースト (90) より後ろに来るので絵が画面に出ない */
	'.overlay-chrome-anchor': 0
};
/* .pill-panel と .demo-menu は 77 に出すので、この層 (71) の絵は板の後ろのドロワー等に隠れる。
   tiers から外し、自前の backdrop-filter で真後ろをぼかす */

export const overlayGlass = (node: Element) =>
	mount(node as HTMLElement, { ...SHEET, bleed: 0 }, 50, OVERLAY_TIERS);

/* 面は出入りするが、面ごとに塗りを変えるため selector ではなく要素の配列を自分で組み、host の直下の子の
   増減だけ見張る (subtree まで見ると時計が進むたびに解決し直す)。前提: 面の出入りは必ず scope の直下の
   子の増減として現れる。面を常駐する入れ物で包むと出入りに気付かない */
function mount(
	node: HTMLElement,
	options: LiquidGlassElementOptions,
	repaintMs?: number,
	tiers?: Record<string, number>,
	/** 覆いが開いている間は CSS で隠される面 (Today のカードのガラス)。下の covered を見よ */
	hiddenUnderOverlay = false
) {
	const scope = tiers ? node.parentElement! : node;
	const targets = () =>
		Object.entries(tiers ?? {}).flatMap(([selector, tint]) =>
			[...scope.querySelectorAll(selector)].map((element) => ({ element, tint }))
		);
	let instance: LiquidGlass | null = null;
	let timer: ReturnType<typeof setInterval> | undefined;
	let overlayWatch: MutationObserver | undefined;
	const watcher = tiers
		? new MutationObserver(() => instance?.update({ targets: targets() }))
		: null;

	const acquire = () => {
		instance = new LiquidGlass(node, {
			live: !repaintMs,
			respectReducedTransparency: false,
			...options,
			...(tiers ? { targets: targets() } : null),
			/* 描画面を失ったら backdrop-filter へ倒す。ライブラリは属性を動かさないので、放っておくと
			   data-liquid-glass="webgl" のまま透明な板が残る。webglcontextrestored が来なければこのまま */
			onContextLost: () => node.setAttribute('data-liquid-glass', 'fallback'),
			onContextRestored: () => node.setAttribute('data-liquid-glass', 'webgl')
		});
		watcher?.observe(scope, { childList: true });
		/* 覆いが開いている間は CSS で隠したカードのガラスも live で描き直し続け、GPU からの読み戻し
		   (1 回 7〜70ms) が承認パネルの動きを落とす。隠れている間はフレームの輪から外す (visible は
		   frame-loop.js の tick が見る旗)。覆いの層・枠の層・依頼バーは覆いの間も見えるので止めない */
		if (hiddenUnderOverlay) {
			const covered = () => {
				if (!instance) return;
				const off = document.body.dataset.overlay === 'on';
				(instance as unknown as { visible: boolean }).visible = !off;
				// 戻ったときは背後の絵がパネルの間に変わっているので描き直させる
				if (!off) instance.refresh();
			};
			overlayWatch = new MutationObserver(covered);
			overlayWatch.observe(document.body, { attributes: true, attributeFilter: ['data-overlay'] });
			covered();
		}
		/* 引数なしの refresh() は targets と観測子まで付け直す。背後の描き直しだけなので backdrop: false
		   (.d.ts には無いが dom.js の refresh は受け取る)。隠れているタブでは飛ばす */
		const repaint = instance.refresh as (o?: { backdrop?: boolean }) => void;
		if (repaintMs)
			timer = setInterval(() => {
				if (!document.hidden) repaint.call(instance!, { backdrop: false });
			}, repaintMs);
	};

	/* destroy() は属性を外して style を戻すので、同期にガラスは backdrop-filter の経路に戻る */
	const release = () => {
		watcher?.disconnect();
		overlayWatch?.disconnect();
		overlayWatch = undefined;
		clearInterval(timer);
		timer = undefined;
		instance?.destroy();
		instance = null;
	};

	return whileVisible(acquire, release);
}

/* Liquid Glass — apple-liquid-glass-webgl (WebGL2) を要素に載せる Svelte の attachment。
   ライブラリは要素の背後にあるページの内容 (背景、文字、<canvas>) を自前で描き直し、
   角丸長方形の符号付き距離場を使って塗り・下ぼかし・縁の光沢を描く。角丸は CSS の
   border-radius を読む。WebGL2 が無い環境では backdrop-filter に落ち、要素に
   data-liquid-glass="fallback" が付く */
import {
	LiquidGlass,
	type LiquidGlassElementOptions,
	type LiquidGlassBackdropPainter
} from 'apple-liquid-glass-webgl';
import { whileVisible } from './visible';

/* Task 10v — ユーザー裁定「求めてたのはすりガラスではなくて反射を無くした liquid glass」を
   受け、Task 10u (iOS のタブバー、写真の上に浮く) 以前の Liquid Glass の材質 (Task 10s まで
   承認されていた値) に戻し、そこから反射だけを外した。
   refraction / edgeReach / edgeWidth / dispersion は Task 10s の値のまま — 面の中はほぼ素通し、
   縁の帯だけ像を曲げ、色ずれはごく薄く残す (境目に来たら屈折する、というユーザーの生きた
   指示)。hairline も Task 10f 以来の値のまま — 縁の輪郭を保つための背景コントラスト適応の線で、
   光を映し込むものではない (v2-shaders.js の interfaceColor、背景の明暗で白 or 黒を選ぶだけ)。
   rim / reflection / highlight / echo は 0 — rim は縁に背景を薄く映し返す反射
   (v2-shaders.js の rimMix)、highlight/echo も面の上に光が乗る効果で、今回の裁定でまとめて消す。
   lightAngle は rim・highlight が両方 0 のとき一切使われない (uRim/uHighlight の係数が
   すべて 0 になるため、eea7a85 の検証どおり) ので置かない。
   backdropBlur と tint は BAR / CARD 側で個別に持つ (下を見よ) */
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

/* ナビ層のうち、下を通るのが色や形だけのもの。渡し先は下の CHROME_TIERS の
   `.sidebar, .rail` (サイドナビと連携アイコンの列) の 2 つだけ。
   塗り (tint)だけが面ごとに違うので、ここは CHROME_TIERS に渡す tint の置き場でしかない
   (ぼかしは描画面ごとの値なので BAR の backdropBlur が当たる。下の CHROME_TIERS の注記を見よ)。
   Task 10v — Task 10u 以前の Liquid Glass の値に戻す。tint はライブラリの 0〜1.5 の目盛りで、
   CSS の不透明度とは一致しない */
export const CLEAR = { tint: 0.14 } as const;

/* 上部バーと依頼バーの段、およびナビ層 (サイドナビ・連携アイコンの列)。
   上部バーと依頼バーの下は本文の文字が通るので、素通しにすると下の文字とバー自身の文字が
   重なって読めない。iOS のバーと同じく下をぼかして溶かす。
   Task 10v — Task 10u 以前の値 (目安 8〜14px の上限) に戻す */
export const BAR: LiquidGlassElementOptions = {
	tint: 0.8,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 14 }
};

/* Task 10w (glass-scope.md 5 節) — ドロワー・シート・モーダル・ポップオーバー・メニュー。
   HIG Materials の regular 変種「部品が相当量の文字を含む場合は regular を使う」に沿い、
   ナビ層 (BAR、tint 0.8) より塗りを一段濃く・ぼかしを強くして、可読性をナビ層より優先する。
   反射 (rim/reflection/highlight) は付けない、縁の屈折 (LENS) はナビ層と同じ。
   SelectField の一覧 (.select-menu) だけはこの host を使わない (下の CSS 側の注記を見よ)。
   Task 10w 修正ラウンド 1 (review-task-10w.md C1) — tint 1.1 では、Today のオーブ (濃い青) の
   上に開いた ⌘K のモーダルで `--ink-3` (薄い補助文字) やリンクの青が実測 3.2〜3.9:1 まで
   落ちる。ライブラリの目盛りの上限 1.5 まで塗りを上げても、最も濃い背景 (オーブの塊の直上)
   では届かない場合がある (app.css の `.palette-src` の注記を見よ。文字色を一段濃くして
   余裕を作った) */
export const SHEET: LiquidGlassElementOptions = {
	tint: 1.5,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 22 }
};

/* 内容カード (Today のカード、Inbox/People/Projects/Companies の一覧カード)。縁の作りは
   ナビ層と同じ。Task 10v — Task 10s で承認されていた値 (tint 0.5、backdropBlur 2、
   両立する中の上限として選んだ組。判断根拠は task-10s-report.md) に戻す。背後に来るオーブが
   面越しに屈折しつつ透けて見えるのが狙いで、Task 10u の「色だけ透ける」濃い白塗りとは逆方向 */
export const CARD: LiquidGlassElementOptions = {
	tint: 0.5,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 2 }
};

/* 表示の切り替え (Segmented.svelte) のつまみ。押している間だけガラスにする。WWDC25「Build a
   SwiftUI app with the new design」の "Controls like toggles, segmented pickers, and sliders now
   transform into liquid glass during interaction"、HIG Materials の「スライダーやトグルのように
   操作の間だけ現れる部品は内容の層でもガラスにしてよい」に当たる
   (docs/research/segmented-liquid-glass.md)。塗りは薄く、下の文字と地が透けて見える程度 */
export const THUMB: LiquidGlassElementOptions = {
	tint: 0.1,
	tintTone: 'light',
	/* 下は平らな灰色の地で屈折が見えにくいので、輪郭の線だけライブラリの既定まで上げる。
	   反射 (rim / highlight) は枠のガラスと同じく付けない */
	material: { ...LENS, backdropBlur: 0, hairline: 0.92 }
};

/** 押している間だけ使う描画面。握りっぱなしにしないので whileVisible は通さない */
export function pressGlass(node: HTMLElement) {
	const instance = new LiquidGlass(node, { live: true, respectReducedTransparency: false, ...THUMB });
	return () => instance.destroy();
}

/* Task 10r — カードのガラスの背後にオーブを届ける描き手。
   ライブラリの itemsBelow (dom-content.js) は、宿主 (`.bento`) より DOM の描画順で
   後にあるものを一律に除外する。オーブ (`.hole > .orb`) は `.bento` の子孫なので、
   `backdrop: 'auto'` だけでは一度もカードの背後の絵に入らない。
   README の「A <video> or <canvas> below the glass … To refract only that source,
   point at it」に沿い、`backdrop: ['auto', orbBackdrop(...)]` として 'auto' の上に
   専用の描き手を重ねる。オーブを `.bento` の外へ動かす案 (b) は、Today の環状配置が
   カードとオーブの重なりに依存している (visual 2.8 の 6、app.css の .hole) ため取らない。
   getCanvas() は今握っている <canvas> を返す関数を呼び元 (today/+page.svelte) から渡す。
   id セレクタで探さないのは、オーブが onMount の後で非同期に canvas を作る
   (Orb.svelte の onCanvas) ため、解決のタイミングを合わせる必要が生まれるから。
   毎フレーム呼ばれる描き手の中で最新の canvas を読むだけなら、そのタイミング合わせが要らない。
   getBoundingClientRect() だけで足りるのは `.orb canvas` が border/padding を持たない
   (app.css) ため。'off' クラス (描画面を手放して canvas を隠している間、Task 10i) は
   実際のページ表示にも何も見えないので、同じく描かない */
export function orbBackdrop(getCanvas: () => HTMLCanvasElement | null): LiquidGlassBackdropPainter {
	return (ctx) => {
		const canvas = getCanvas();
		if (!canvas || canvas.classList.contains('off')) return;
		const box = canvas.getBoundingClientRect();
		ctx.drawImage(canvas, box.left, box.top, box.width, box.height);
	};
}

/* live: true で毎フレーム描き直す。オーブは <canvas> の中で毎フレーム描き変わり、
   ライブラリには変化の通知が来ないので、静止させるとガラスの中だけ背景が止まって見える。
   maxDpr は指定しない (ライブラリの既定 2)。一度 1 に落としていたが、画素の密度が高い
   ディスプレイでガラスの中だけ解像度が半分になる。
   respectReducedTransparency: false — OS 設定には応答しない (裁定済み) */
/* Task 10w 修正ラウンド 5 (rereview5-glass-batch.md I1) — 以前は描き直す間隔 (repaintMs)を
   受け取れたが、使っていたカレンダーの面のガラスが 1fc776a で外れて呼び元が無くなったので
   引数ごと消した。まとめて描く 2 つの層 (chromeGlass / overlayGlass)は mount を直に呼び、
   今も 50ms の間隔を渡している */
export function glass(options: LiquidGlassElementOptions) {
	return (node: Element) => mount(node as HTMLElement, options, undefined, undefined, true);
}

/* 画面の枠のガラスのうち 5 面 (サイドナビ、上部バー、連携の列、携帯のボトムナビ、
   携帯の上部バー)を 1 枚の canvas にまとめる。依頼バーだけは別 (下の barGlass を見よ)。
   面ごとに 1 つずつ描画面 (WebGL context)を取ると、タブ 3 枚でブラウザの上限 (1 ページ約 16)に
   届いてしまう。まとめ先は本文の上・覆いの下に敷いた空の層 (.chrome。デスクトップ
   [961px 以上] は覆い 75 より前の 76、モバイル [960px 以下] は元の重なりのまま 50)で、
   5 面はその層の子ではなく、きょうだいのまま動かさない。ライブラリは面の位置を
   入れ物の箱を基準に測るだけなので、画面いっぱいの層からなら画面のどこの面でも指せる。
   子にしないのは、入れ物の子孫がガラスの背後の絵から外れる決まりだからで、
   子にすると上部バーが下の文字を溶かせなくなる。逆に 5 面は層より後に描かれる
   ので (同じ z-index で DOM の順が後)、面自身の文字や塗りは背後の絵に入らない。
   裏返すと、層にまとめた面どうしは互いの絵を映せない。今の 5 面は互いに重ならないので
   影響しない (サイドナビ・連携の列は左右の端、上部バーは上端、ボトムナビは下端)。

   面ごとに違うのは塗り (tint)だけで、塗りは面ごとに渡せる。ぼかし (backdropBlur)は
   描画面ごとの値なので 5 面すべてに BAR の値 (今は 14、上の BAR を見よ)が当たる。サイドナビと連携の列の
   背後を通るのは地の階調だけ (本文は左右の margin で避けてあり、オーブも届かない)なので、
   ぼかしの強さが変わっても見た目への影響は小さい。
   bleed: 0 — 入れ物が画面いっぱいなので、外へはみ出す分はそもそも画面の外にある。
   既定の bleed (材質から決まる。今の値では 71px)を足すと、縦も横もその 2 倍 (142px)ずつ
   広い canvas を毎フレーム塗り直すことになる。

   Task 10w (glass-scope.md 1 節) — 携帯のボトムナビ (タブバー) と携帯の上部バーは
   HIG Tab bars / Toolbars がガラスを持つと明記する部品なので、描画面を増やさずこの層の
   tiers に加える。どちらも下を本文が通るので BAR と同じ塗り (.header.glass と同じ扱い) */
const CHROME_TIERS = {
	'.sidebar, .rail, .side-toggle': CLEAR.tint as number,
	'.header.glass, .header.solid, .bottomnav': BAR.tint as number
};

/* 依頼バー (段 55) だけはこの層に入れず、自分の描画面を持つ。
   まとめて描く層の背後の絵は層そのものの位置で切られるので、層に乗せた面どうしは
   互いを映せない。依頼バーはサイドナビ・上部バー・連携の列と横に重ならない
   (依頼バーの左端 = サイドナビの右端 + 32px、右端も連携の列の左)ので、段の前後関係
   (今は .chrome が 76 で依頼バーの 55 より後ろ)に関わらず、互いを映す・映さないの
   問題はそもそも起きない。それでも分けるのは、層に乗せると依頼バー自身の文字や塗りが
   背後の絵に入らなくなる (上の CHROME_TIERS の注記を見よ) ため。描画面は 1 つ増えて
   2 つになるが、ブラウザの上限 (1 ページおよそ 16) に対しては余裕がある。
   他の 5 面は互いに重なるものが無く (サイドナビ・連携の列は左右の端、上部バーは
   上端、ボトムナビは下端)、層にまとめたままでよい */
export const barGlass = (node: Element) => mount(node as HTMLElement, BAR);

/* 50 — 枠の層は画面いっぱいなので、毎フレーム描き直すと本文の文字をまるごと 1 枚に
   描き起こす処理が 60 回/秒 走る。カレンダーの月表示で 25 フレーム/秒まで落ちた。
   下の内容が動いたとき (スクロール、大きさや DOM の変化)はライブラリ側が別に描き直すので、
   この間隔が要るのはオーブのように何も知らせずに描き変わる canvas のためだけ。
   20 回/秒 に落としても見た目は変わらず、Today とカレンダーの週・月がすべて 60 に戻る */
export const chromeGlass = (node: Element) =>
	mount(node as HTMLElement, { ...BAR, bleed: 0 }, 50, CHROME_TIERS);

/* Task 10w (glass-scope.md 1〜3 節) — Portal で <body> 直下に出るドロワー・シート・
   モーダル・ポップオーバー・メニューをまとめて描く層。chromeGlass (.chrome) と同じ
   「空の層 1 枚 + tiers」の仕組みを再利用する。この層自身も bits-ui の Portal で <body> の
   直接の子として足す ((app)/+layout.svelte)。Dialog/Popover/DropdownMenu/Select の Portal は
   既定で <body> 直下に出るので、host の scope (= node.parentElement = <body>) の
   querySelectorAll でどの面も (入れ物の div が 1 枚挟まる面も含め) 深さに関係なく見つかる。

   scrim (70) より上、覆いの面 (drawer/sheet/modal/panel-center 75)より下の 71 に
   描画面を敷く。tiers の面は 75 で層の 71 より高いので、DOM 順に関わらず面が上に乗る。
   pill-panel と demo-menu はこの層の対象に含めない。枠 (.header.glass、76) から開く板
   として 77 に出しており、この層 (71) より前面にあるため (すぐ下の OVERLAY_TIERS の
   コメントを見よ)。

   どの面も SHEET の塗り・ぼかしをそのまま使う。

   .select-menu (z-index 80) はここに含めない。SelectField は常に Modal の中のフォームで
   使うので、一覧は「すでにこのガラス化で透明にしたモーダル (z-index 75)」の上に開く。
   一覧の位置から見て「すぐ後ろ」にあるのはこの層の canvas (z-index 71、モーダルより後ろ) では
   なく、モーダル自身の実体 (文字などの中身、モーダルの背景だけを透明にしたのでこちらは残る)に
   なり、canvas の塗りが画面に出ない (readPixels で canvas 自体は正しく塗り変わっている一方、
   スクリーンショットは変わらないことを確認した。task-10w-report.md)。.select-menu だけは
   この canvas 方式を使わず、CSS の backdrop-filter で自分の真後ろを直接ぼかす
   (app.css 側 .select-menu の注記を見よ) */
/* .overlay-chrome-anchor — 常駐する幅・高さ 0 の印。ライブラリは targets が空配列だと
   「targets を使っていない」ときと同じ扱いに倒し、host (画面いっぱいの .overlay-chrome) を
   丸ごと 1 枚のガラスとして描いてしまう (apple-liquid-glass-webgl の dom.js buildElements、
   `if (!this.targets.length) return [{ ...host 全体 }]`)。覆いが 1 つも開いていない
   (今回の既定の状態)ときに画面全体がぼやける不具合になるので、常に 1 件以上の要素が
   targets に残るよう幅 0 の印を混ぜておく。幅 0 なので描画の対象からは
   (buildElements 側の `width > 0 && height > 0` の絞り込みで) 除かれる */
const OVERLAY_TIERS = {
	/* .panel-center — 承認待ちの中央寄り固定パネル (ApprovalDrawer だけが使う variant="center")。
	   .modal と同じ SHEET の塗り・ぼかしをそのまま使う */
	'.drawer, .sheet, .modal, .panel-center': SHEET.tint as number,
	/* Task 10w 修正ラウンド 2 (review-glass-batch.md I1) — トーストはここに入れない。
	   .select-menu と同じ理由で、この層の canvas はトースト (z-index 90)より後ろに来るうえ、
	   トースト自身が濃紺の塗りを持つので、canvas が描いた絵は一度も画面に出ない
	   (実測: トーストの下に縞を敷いてもまったくぼけない)。見えない絵を毎フレーム描くだけ
	   無駄なので層から外し、app.css の .toast の backdrop-filter でぼかす */
	'.overlay-chrome-anchor': 0
};
/* レビュー I5 — .pill-panel と .demo-menu は枠 (.header.glass、76) から開くので、覆いの面
   (drawer/sheet/modal 75) より前の 77 に出している。この層 (.overlay-chrome) は 71 で
   77 より後ろなので、板がドロワー等と横に重なる場面では板の地 (canvas が描く塗り) がその
   覆いの後ろに隠れ、板の文字が下の覆いの文字に直接乗ってしまう。板を tiers から外し、
   .select-menu と同じく自分の backdrop-filter (app.css) で描くことで、段の前後関係に
   関わらず自分の真後ろだけを確実にぼかす */

export const overlayGlass = (node: Element) =>
	mount(node as HTMLElement, { ...SHEET, bleed: 0 }, 50, OVERLAY_TIERS);

/* 面は出入りする (連携の列は連携が 0 件だと消え、上部バーは画面幅で solid と入れ替わる)。
   targets を文字列の selector で渡せばライブラリが自分で見張ってくれるが、それだと面ごとに
   塗りを変えられないので、要素の配列を自分で組み立て、host の直下の子の増減だけ見張る
   (subtree まで見ると上部バーの時計が進むたびに解決し直しになる)。
   前提: 面の出入りは必ず scope の直下の子の増減として現れる。面そのものは孫でもよい
   (探すのは querySelectorAll なので深さを問わない。覆いの層の .pill-panel / .demo-menu は
   floating-ui の入れ物を 1 枚挟んだ孫だが、その入れ物ごと <body> の直下に出入りする)。
   面を常駐する入れ物で包むと、探せはするのに出入りに気付かない壊れ方をする。
   scope の node.parentElement! も同じ前提 — tiers を使う層は必ず親を持つ場所に置く。
   tiers の値は面ごとの塗り (tint)。塗りの向き (light/dark)を面ごとに変える仕組みも持っていたが、
   使っていたのはトーストだけで、そのトーストが層から外れたので消した
   (Task 10w 修正ラウンド 2、上の OVERLAY_TIERS の注記を見よ) */
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
			/* 描画面を失ったらガラスを CSS の backdrop-filter へ倒す (オーブの代替表示とは別で、
			   こちらは Task 10x の後も残る)。ライブラリは属性を動かさないので、
			   放っておくと data-liquid-glass="webgl" のまま塗りが消えた透明な板が残る
			   (2026-09-16 にユーザーが見た壊れ方)。GPU のプロセスごと落ちて
			   webglcontextrestored が来ない場合は、この代替のまま保つ */
			onContextLost: () => node.setAttribute('data-liquid-glass', 'fallback'),
			onContextRestored: () => node.setAttribute('data-liquid-glass', 'webgl')
		});
		watcher?.observe(scope, { childList: true });
		/* 覆いが開いている間は、カードのガラス (Today の .bento、完了画面) を CSS で隠している
		   (app.css の body[data-overlay='on'] ... [data-liquid-glass-layer])。隠しても live: true の
		   描き直しは毎フレーム続き、背後の絵の明るさを GPU から読み戻す処理 (1 回 7〜70ms) が
		   承認パネルの広がる・縮む動きを 1 秒に数フレームまで落としていた (実測: パネルを
		   開いている 1 秒のうち 942ms がこの面の描き直し。ユーザー指摘 2026-09-24)。
		   隠れている間はライブラリのフレームの輪から外す (visible は frame-loop.js の tick が
		   見る旗。IntersectionObserver も同じ旗を書くが、画面内にあるかしか見ないので覆いでは
		   倒れない)。覆いの層 (overlayGlass)・枠の層・依頼バーは、覆いの間も見えるので止めない */
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
		/* 引数なしの refresh() は targets の解決と観測子 (ResizeObserver / MutationObserver) の
		   付け直しまでやり直す。ここで要るのは背後の描き直しだけなので backdrop: false を渡す。
		   ライブラリの .d.ts はこの引数を宣言していないが、実装 (src/dom.js の refresh) は受け取る。
		   隠れているタブでは描いても見えないので飛ばす */
		const repaint = instance.refresh as (o?: { backdrop?: boolean }) => void;
		if (repaintMs)
			timer = setInterval(() => {
				if (!document.hidden) repaint.call(instance!, { backdrop: false });
			}, repaintMs);
	};

	/* destroy() は属性を外して要素の style を戻すので、これだけでガラスは CSS の
	   backdrop-filter の経路に戻る。
	   同期に済むため、手放す瞬間に何も描かれていない一瞬は生まれない */
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

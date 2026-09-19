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

/* ナビ層のうち、下を通るのが色や形だけのもの (サイドナビ、連携アイコンの列、接続一覧)。
   塗り (tint)だけが面ごとに違うので、ここは CHROME_TIERS に渡す tint の置き場でしかない
   (ぼかしは描画面ごとの値なので BAR の backdropBlur が当たる。下の CHROME_TIERS の注記を見よ)。
   Task 10v — Task 10u 以前の Liquid Glass の値に戻す。tint はライブラリの 0〜1.5 の目盛りで、
   CSS の不透明度とは一致しない */
export const CLEAR = { tint: 0.14 } as const;

/* 上部バーと依頼バーの段、およびナビ層 (サイドナビ・連携アイコンの列・接続一覧)。
   上部バーと依頼バーの下は本文の文字が通るので、素通しにすると下の文字とバー自身の文字が
   重なって読めない。iOS のバーと同じく下をぼかして溶かす。
   Task 10v — Task 10u 以前の値 (目安 8〜14px の上限) に戻す */
export const BAR: LiquidGlassElementOptions = {
	tint: 0.8,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 14 }
};

/* Task 10w (glass-scope.md 5 節) — シート・モーダル・ポップオーバー・メニュー。
   HIG Materials の regular 変種「部品が相当量の文字を含む場合は regular を使う」に沿い、
   ナビ層 (BAR、tint 0.8) より塗りを一段濃く・ぼかしを強くして、可読性をナビ層より優先する。
   反射 (rim/reflection/highlight) は付けない、縁の屈折 (LENS) はナビ層と同じ。
   SelectField の一覧 (.select-menu) だけはこの host を使わない (下の CSS 側の注記を見よ)。
   Task 10w 修正ラウンド 1 (review-task-10w.md C1) — tint 1.1 では、Today のオーブ (濃い青) の
   上に開いた ⌘K のモーダルで `--ink-3` (薄い補助文字) やリンクの青が実測 3.2〜3.9:1 まで
   落ちる。ライブラリの目盛りの上限 1.5 まで塗りを上げても、最も濃い背景 (オーブの塊の直上)
   では届かない場合がある (下の CSS 側 `.palette-src` / `.btn.text` の注記を見よ) */
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

/* Task 10r — カードのガラスの背後にオーブを届ける描き手。
   ライブラリの itemsBelow (dom-content.js) は、宿主 (`.bento`) より DOM の描画順で
   後にあるものを一律に除外する。オーブ (`.hole > .orb`) は `.bento` の子孫なので、
   `backdrop: 'auto'` だけでは一度もカードの背後の絵に入らない (上の CARD の訂正を見よ)。
   README の「A <video> or <canvas> below the glass … To refract only that source,
   point at it」に沿い、`backdrop: ['auto', orbBackdrop(...)]` として 'auto' の上に
   専用の描き手を重ねる。オーブを `.bento` の外へ動かす案 (b) は、Today の環状配置が
   カードとオーブの重なりに依存している (visual 2.8 の 6、app.css の .hole) ため取らない。
   getCanvas() は今握っている <canvas> を返す関数を呼び元 (today/+page.svelte) から渡す。
   id セレクタで探さないのは、オーブが onMount の後で非同期に canvas を作る
   (Orb.svelte の onCanvas) ため、解決のタイミングを合わせる必要が生まれるから。
   毎フレーム呼ばれる描き手の中で最新の canvas を読むだけなら、そのタイミング合わせが要らない。
   getBoundingClientRect() だけで足りるのは `.orb canvas` が border/padding を持たない
   (app.css) ため。'off' クラス (描画面を手放して代替表示中、Task 10i) の間は
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
/* repaintMs — 背後を描き直す間隔 (ミリ秒)。省くと毎フレーム (live: true)。
   使うのはカレンダーの面 1 か所だけ。幅いっぱい x 約 660px と広く、毎フレーム描き直すと
   本番ビルドでも 30 フレーム/秒台に落ちる。この面の下に来るのは壁紙の階調だけなので、
   一定の間隔で描き直しても見た目は変わらない。
   refresh() は「次のフレームで背後を描き直す」印を立てるだけで、その間ガラスの rAF の輪は
   止まる。scroll と resize ではライブラリ側が別に起こすので、送っても追従する */
export function glass(options: LiquidGlassElementOptions, repaintMs?: number) {
	return (node: Element) => mount(node as HTMLElement, options, repaintMs);
}

/* Task 10i — 画面の枠 4 面 (サイドナビ、上部バー、連携の列、依頼バー)を 1 枚の canvas にまとめる。
   面ごとに 1 つずつ描画面 (WebGL context)を取ると、タブ 3 枚でブラウザの上限 (1 ページ約 16)に
   届いてしまう。まとめ先は本文の上・覆いの下に敷いた空の層 (.chrome、z-index 50)で、
   4 面はその層の子ではなく、きょうだいのまま動かさない。ライブラリは面の位置を
   入れ物の箱を基準に測るだけなので、画面いっぱいの層からなら画面のどこの面でも指せる。
   子にしないのは、入れ物の子孫がガラスの背後の絵から外れる決まりだからで、
   子にすると上部バーと依頼バーが下の文字を溶かせなくなる。逆に 4 面は層より後に描かれる
   ので (同じ z-index 50 で DOM の順が後)、面自身の文字や塗りは背後の絵に入らない。

   面ごとに違うのは塗り (tint)だけで、塗りは面ごとに渡せる。ぼかし (backdropBlur)は
   描画面ごとの値なので 4 面すべてに BAR の 32 (Task 10u)が当たる。サイドナビと連携の列の
   背後を通るのは地の階調だけ (本文は左右の margin で避けてあり、オーブも届かない)なので、
   ぼかしの強さが変わっても見た目への影響は小さい。
   bleed: 0 — 入れ物が画面いっぱいなので、外へはみ出す分はそもそも画面の外にある。
   既定の 63px を足すと縦横 126px ぶん無駄に広い canvas を毎フレーム塗り直すことになる。

   Task 10w (glass-scope.md 1 節) — 携帯のボトムナビ (タブバー) と携帯の上部バーは
   HIG Tab bars / Toolbars がガラスを持つと明記する部品なので、描画面を増やさずこの層の
   tiers に加える。どちらも下を本文が通るので BAR と同じ塗り (.header.glass/.chatbar と同じ扱い) */
const CHROME_TIERS = {
	'.sidebar, .rail': CLEAR.tint as number,
	'.header.glass, .chatbar, .header.solid, .bottomnav': BAR.tint as number
};

/* 50 — 枠の層は画面いっぱいなので、毎フレーム描き直すと本文の文字をまるごと 1 枚に
   描き起こす処理が 60 回/秒 走る。カレンダーの月表示で 25 フレーム/秒まで落ちた。
   下の内容が動いたとき (スクロール、大きさや DOM の変化)はライブラリ側が別に描き直すので、
   この間隔が要るのはオーブのように何も知らせずに描き変わる canvas のためだけ。
   20 回/秒 に落としても見た目は変わらず、Today とカレンダーの週・月がすべて 60 に戻る */
export const chromeGlass = (node: Element) =>
	mount(node as HTMLElement, { ...BAR, bleed: 0 }, 50, CHROME_TIERS);

/* Task 10w (glass-scope.md 1〜3 節) — Portal で <body> 直下に出るシート・モーダル・
   ポップオーバー・メニュー・トーストをまとめて描く層。chromeGlass (.chrome) と同じ
   「空の層 1 枚 + tiers」の仕組みを再利用する。この層自身も bits-ui の Portal で <body> の
   直接の子として足す ((app)/+layout.svelte)。Dialog/Popover/DropdownMenu/Select の Portal は
   既定で <body> 直下に出るので、host の scope (= node.parentElement = <body>) の
   querySelectorAll でどの面も (入れ物の div が 1 枚挟まる面も含め) 深さに関係なく見つかる。

   トーストだけは Dialog 系の Portal を使わない素の条件表示で、ルートの +layout.svelte
   (`(app)` の外、公開ページとも共有)の直下に置かれている。そのため <body> の childList だけを
   見ていてもトーストの出入りは拾えない (`.app` のさらに親の子として増減するため)。
   .app の親要素も合わせて見張ることで、公開ページの購読を増やさずに拾う (下の extraScope)。

   scrim (70) より上、覆いの面 (drawer/sheet/modal 75、toast 90) より下に描画面を敷く必要が
   あるが、pill-panel と demo-menu だけは scrim と同じ 70 だったので、両方を 71 に上げて
   隙間を作った (app.css)。この層も 71 にして、tiers の面より必ず先に DOM へ入る ((app) の
   骨組みが乗った時に一度だけ Portal で足すため、ユーザーが覆いを開くのは必ずそれより後) ので、
   同じ 71 でも面自身が上に乗る (chromeGlass と .sidebar の関係と同じ、同じ z-index は DOM 順が
   勝つ)。

   トーストだけ濃い塗り (--ink 相当の地に白文字) なので、tintTone を dark にする
   (SHEET は light 前提)。他の面は SHEET の塗り・ぼかしをそのまま使う。

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
	'.drawer, .sheet, .modal, .pill-panel, .demo-menu': SHEET.tint as number,
	/* Task 10w 修正ラウンド 1 (review-task-10w.md C2) — トーストは濃紺の地に白文字。
	   ライブラリの tintTone は明るさの端 (light/dark)しか選べず色を持てないので、canvas に
	   任せると紺が無彩色の灰になる。塗り 0 で canvas にはぼかしと屈折だけを描かせ、紺は
	   CSS の背景として残す (app.css の .toast、WebGL 経路でも background を下ろさない) */
	'.toast': { tint: 0, tintTone: 'dark' as const },
	'.overlay-chrome-anchor': 0
};

export const overlayGlass = (node: Element) =>
	mount(node as HTMLElement, { ...SHEET, bleed: 0 }, 50, OVERLAY_TIERS, () =>
		document.querySelector('.app')?.parentElement ?? null
	);

/* 面は出入りする (連携の列は連携が 0 件だと消え、上部バーは画面幅で solid と入れ替わる)。
   targets を文字列の selector で渡せばライブラリが自分で見張ってくれるが、それだと面ごとに
   塗りを変えられないので、要素の配列を自分で組み立て、host の直下の子の増減だけ見張る
   (subtree まで見ると上部バーの時計が進むたびに解決し直しになる)。
   tiers の値は数値 (tint だけ) か { tint, tintTone } のどちらでもよい。overlayGlass の
   トーストのように塗りの向き (light/dark) も面ごとに変えたい場合だけ後者を使う。
   extraScope — scope (host の親)とは別に、もう 1 か所だけ childList を見張りたいとき
   (overlayGlass のトースト、上のコメント参照) に使う。深さの違う 2 か所を subtree でまとめて
   見ると本文の無関係な更新まで拾ってしまうので、2 つの浅い監視に分ける */
type Tier = number | { tint: number; tintTone?: 'light' | 'dark' };
function mount(
	node: HTMLElement,
	options: LiquidGlassElementOptions,
	repaintMs?: number,
	tiers?: Record<string, Tier>,
	extraScope?: () => Element | null
) {
	const scope = tiers ? node.parentElement! : node;
	const targets = () =>
		Object.entries(tiers ?? {}).flatMap(([selector, tier]) => {
			const spec = typeof tier === 'number' ? { tint: tier } : tier;
			return [...scope.querySelectorAll(selector)].map((element) => ({ element, ...spec }));
		});
	let instance: LiquidGlass | null = null;
	let timer: ReturnType<typeof setInterval> | undefined;
	const watcher = tiers
		? new MutationObserver(() => instance?.update({ targets: targets() }))
		: null;

	const acquire = () => {
		instance = new LiquidGlass(node, {
			live: !repaintMs,
			respectReducedTransparency: false,
			...options,
			...(tiers ? { targets: targets() } : null),
			/* 描画面を失ったら CSS の代替へ倒す。ライブラリは属性を動かさないので、
			   放っておくと data-liquid-glass="webgl" のまま塗りが消えた透明な板が残る
			   (2026-09-16 にユーザーが見た壊れ方)。GPU のプロセスごと落ちて
			   webglcontextrestored が来ない場合は、この代替のまま保つ */
			onContextLost: () => node.setAttribute('data-liquid-glass', 'fallback'),
			onContextRestored: () => node.setAttribute('data-liquid-glass', 'webgl')
		});
		watcher?.observe(scope, { childList: true });
		const extra = extraScope?.();
		if (extra && extra !== scope) watcher?.observe(extra, { childList: true });
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

	/* destroy() は属性を外して要素の style を戻すので、これだけで CSS の代替表示に戻る。
	   同期に済むため、手放す瞬間に何も描かれていない一瞬は生まれない */
	const release = () => {
		watcher?.disconnect();
		clearInterval(timer);
		timer = undefined;
		instance?.destroy();
		instance = null;
	};

	return whileVisible(acquire, release);
}

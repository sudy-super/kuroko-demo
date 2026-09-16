/* Liquid Glass — apple-liquid-glass-webgl (WebGL2) を要素に載せる Svelte の attachment。
   ライブラリは要素の背後にあるページの内容 (背景、文字、<canvas>) を自前で描き直し、
   角丸長方形の符号付き距離場で縁だけを曲げて屈折させる。角丸は CSS の border-radius を読む。
   WebGL2 が無い環境では backdrop-filter に落ち、要素に data-liquid-glass="fallback" が付く */
import { LiquidGlass, type LiquidGlassElementOptions } from 'apple-liquid-glass-webgl';
import { whileVisible } from './visible';

/* Task 10f 修正ラウンド 3 — 縁のレンズ。ユーザーの裁定は「背景がカードの境目に来たら屈折する。
   境目から中に入ったら屈折も滲みもしなくてよい」。面の中は素通しにし、像が曲がるのは縁の帯だけ。
   ここの 3 つの値がその帯を作る (ライブラリの v2 シェーダー、v2-shaders.js 230 行目と 252 行目)。
   - edgeWidth: 帯の幅。実寸は「要素の短辺の半分 x edgeWidth」画素。高さ 64px の上部バーなら
     32 x 0.5 = 16px、高さ 44px の副ボタンなら 11px と、面の大きさに比例する。
   - edgeReach: 帯の中で下の像をどれだけ引き寄せるか。実寸は「短辺の半分 x 2 x 1.24 x この値」
     画素で、上部バーなら約 12px。引き寄せる量が帯の幅を超えると、帯の中身が元の像と
     繋がらない白い筋になるので、この比 (0.74)は 1 を超えないところに置く。
   - refraction: 面の中 (帯の外)の湾曲。0〜20 に下げて、中はほぼ素通しにする。
     縁からの範囲は「短辺の半分 x 0.5」画素で、引きは最大 refraction x 0.32 画素。
     12 なら上部バーで 3.8px しか動かず、帯の外では像がほぼそのまま見える。
   dispersion は縁の色ずれ。5.5 まで上げていたときは、上部バーの下をくぐる本文に赤と青の
   縞が出て、バー自身の文字と重なって読みにくかった (ユーザー判定)。1.5 にすると
   文字の上では見えず、オーブの破片のような大きい形の縁にだけ薄く残る。
   frost と backdropBlur は 0。面の中を滲ませない。ただし下を文字が通るバーだけは
   別 (BAR を見よ)。
   rim (縁の光)と hairline (輪郭線)は全周に同じ強さで回るので低く抑える。ここを上げると
   縁が一律の面取りになり、ガラスではなく「ふちどりを付けた板」に見える (ユーザー判定)。
   代わりに lightAngle 136 (左上から差す光)で向きの付く highlight を上げ、
   上縁の白い鏡面と下縁の薄い暗線は CSS の疑似要素で置く (app.css の Liquid Glass の節) */
const LENS = {
	refraction: 12,
	edgeReach: 0.15,
	edgeWidth: 0.5,
	dispersion: 1.5,
	frost: 0,
	rim: 0.3,
	reflection: 0.4,
	highlight: 1.3,
	lightAngle: 136,
	echo: 0.35,
	hairline: 0.45
} as const;

/* ナビ層のうち、下を通るのが色や形だけのもの (サイドナビ、連携アイコンの列、接続一覧)。
   面の中は素通しで、縁の帯だけが曲げる。
   tint はライブラリの 0〜1.5 の目盛りで、CSS の不透明度とは一致しない */
export const CLEAR: LiquidGlassElementOptions = {
	tint: 0.14,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 0 }
};

/* 上部バーと依頼バーだけの段。この 2 つの下は本文の文字が通るので、素通しにすると
   下の文字とバー自身の文字が重なって読めない。iOS のバーと同じく下をぼかして溶かす。
   ぼかすのはこの 2 つだけで、カードやボタンには当てない */
export const BAR: LiquidGlassElementOptions = {
	tint: 0.8,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 18 }
};

/* 内容カード。縁の作りはナビ層と同じで、塗りだけ CSS の rgba(255,255,255,.70) に
   見た目を合わせた (実測で合わせた値。ライブラリの目盛りは CSS の不透明度とは別物)。
   面の中は素通しなので、カードの下に来たオーブの破片は形のまま透け、縁の帯でだけ曲がる */
export const CARD: LiquidGlassElementOptions = {
	tint: 0.62,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 0 }
};

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
   描画面ごとの値なので 4 面すべてに BAR の 18 が当たるが、サイドナビと連携の列の背後を
   通るのは地の階調だけ (本文は左右の margin で避けてあり、オーブも届かない)なので、
   階調をぼかしても見た目は変わらない (3 倍拡大で確認済み、報告 task-10i-report.md)。
   bleed: 0 — 入れ物が画面いっぱいなので、外へはみ出す分はそもそも画面の外にある。
   既定の 63px を足すと縦横 126px ぶん無駄に広い canvas を毎フレーム塗り直すことになる */
const CHROME_TIERS = {
	'.sidebar, .rail': CLEAR.tint as number,
	'.header.glass, .chatbar': BAR.tint as number
};

/* 50 — 枠の層は画面いっぱいなので、毎フレーム描き直すと本文の文字をまるごと 1 枚に
   描き起こす処理が 60 回/秒 走る。カレンダーの月表示で 25 フレーム/秒まで落ちた。
   下の内容が動いたとき (スクロール、大きさや DOM の変化)はライブラリ側が別に描き直すので、
   この間隔が要るのはオーブのように何も知らせずに描き変わる canvas のためだけ。
   20 回/秒 に落としても見た目は変わらず、Today とカレンダーの週・月がすべて 60 に戻る */
export const chromeGlass = (node: Element) =>
	mount(node as HTMLElement, { ...BAR, bleed: 0 }, 50, CHROME_TIERS);

/* 面は出入りする (連携の列は連携が 0 件だと消え、上部バーは画面幅で solid と入れ替わる)。
   targets を文字列の selector で渡せばライブラリが自分で見張ってくれるが、それだと面ごとに
   塗りを変えられないので、要素の配列を自分で組み立て、.app の直下の子の増減だけ見張る
   (subtree まで見ると上部バーの時計が進むたびに解決し直しになる) */
function mount(
	node: HTMLElement,
	options: LiquidGlassElementOptions,
	repaintMs?: number,
	tiers?: Record<string, number>
) {
	const scope = tiers ? node.parentElement! : node;
	const targets = () =>
		Object.entries(tiers ?? {}).flatMap(([selector, tint]) =>
			[...scope.querySelectorAll(selector)].map((element) => ({ element, tint }))
		);
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

/* Liquid Glass — apple-liquid-glass-webgl (WebGL2) を要素に載せる Svelte の attachment。
   ライブラリは要素の背後にあるページの内容 (背景、文字、<canvas>) を自前で描き直し、
   角丸長方形の符号付き距離場で縁だけを曲げて屈折させる。角丸は CSS の border-radius を読む。
   WebGL2 が無い環境では backdrop-filter に落ち、要素に data-liquid-glass="fallback" が付く */
import {
	LiquidGlass,
	type LiquidGlassElementOptions,
	type LiquidGlassBackdropPainter
} from 'apple-liquid-glass-webgl';
import { whileVisible } from './visible';

/* Task 10f 修正ラウンド 3 — 縁のレンズ。ユーザーの裁定は「背景がカードの境目に来たら屈折する。
   境目から中に入ったら屈折も滲みもしなくてよい」。像が曲がるのは縁の帯だけ、という部分は
   Task 10o でも変わらない。ここの 3 つの値がその帯を作る
   (ライブラリの v2 シェーダー、v2-shaders.js 230 行目と 252 行目)。
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
   backdropBlur はこの共通材質では持たない。面ごとのぼかし量は BAR / CARD 側で個別に持つ
   (Task 10o、下を見よ)。frost はライブラリの既定 (0) と同じ値なので書かない
   (書いても書かなくても preBlur は変わらない)。

   Task 10o — ユーザー指摘「左上の反射がひび割れにしか見えない」。3 倍拡大で確認すると、
   角の丸みに沿って白い筋が斜めに走っていた。原因は reflection と highlight の 2 つ。
   v2-shaders.js の `key = pow(max(dot(normal, lightDir), 0), 7) * fresnel` が
   lightAngle (136度、左上方向)と法線の向きが揃う 1 点に鋭い鏡面を作り、丸い角では
   法線が連続的に向きを変えるので、その 1 点が角の曲線上の斜めの筋に見える
   (`color += … * key * uHighlight`、hairline 側にも `hairHighlight` として効く)。
   reflection (rimMix の係数)も同じ帯域を明るくして筋を強めていたので、
   一緒に 0 にした。echo は筋の主因ではないが、同じ「面上の光沢」の一部なので
   ユーザー指示 (highlight / reflection / echo を 0 か最小値に) に沿って 0 にした
   (縁の内側に薄く背景を返すだけの効果で、無くしても縁の見え方は変わらない。
   3 倍拡大で確認済み、scratchpad/10o 以下の before/after)。
   rim (縁の光)と hairline (輪郭線)は残す。全周に同じ強さで回る分には筋にならない
   (ユーザー判定)。上縁の白い鏡面と下縁の薄い暗線は今までどおり CSS の疑似要素が担う
   (app.css の Liquid Glass の節)。lightAngle は hairline の明るい側の向きにまだ使われて
   いるので残すが、highlight を 0 にしたため筋には効かない */
const LENS = {
	refraction: 12,
	edgeReach: 0.15,
	edgeWidth: 0.5,
	dispersion: 1.5,
	rim: 0.3,
	reflection: 0,
	highlight: 0,
	lightAngle: 136,
	echo: 0,
	hairline: 0.45
} as const;

/* ナビ層のうち、下を通るのが色や形だけのもの (サイドナビ、連携アイコンの列、接続一覧)。
   塗り (tint)だけが面ごとに違うので、ここは CHROME_TIERS に渡す tint の置き場でしかない。
   この 3 面は chromeGlass 経由で 1 枚の canvas にまとめて描かれ (Task 10i)、ぼかしは
   描画面ごとの値なので BAR の backdropBlur が当たる (下の CHROME_TIERS の注記を見よ)。
   Task 10o 修正ラウンド 1 — 以前ここに material.backdropBlur を持たせていたが、
   CHROME_TIERS も他のどの呼び出しも CLEAR.material を読まない死んだ値だったので消した
   (使われない経路を足さない、レビュー task-10o の Important 2)。
   tint はライブラリの 0〜1.5 の目盛りで、CSS の不透明度とは一致しない */
export const CLEAR = { tint: 0.14 } as const;

/* 上部バーと依頼バーの段、およびナビ層 (サイドナビ・連携アイコンの列・接続一覧)。
   上部バーと依頼バーの下は本文の文字が通るので、素通しにすると下の文字とバー自身の文字が
   重なって読めない。iOS のバーと同じく下をぼかして溶かす。
   Task 10o 修正ラウンド 1 — この backdropBlur は chromeGlass の共有 canvas 経由でナビ層にも
   当たる (下の CHROME_TIERS の注記を見よ)。目安 8〜14px の上限である 14 に下げた。18 のまま
   だとナビ層 (サイドナビ・連携アイコンの列)が目安の外だったため (レビュー task-10o の
   Important 2)。14 でも上部バー・依頼バーの下をくぐる本文の文字は重ならずに読める
   (3 倍拡大、scratchpad/10o-fix 以下で確認済み、Task 10f の役割は変わらない) */
export const BAR: LiquidGlassElementOptions = {
	tint: 0.8,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 14 }
};

/* 内容カード。縁の作りはナビ層と同じ。
   訂正 (Task 10r) — Task 10o と Task 10o 修正ラウンド 1 は「ぼかしを上げると縁の屈折
   (オーブの破片が曲がって見える様子) が消える」という前提で 10 / 8 / 6 / 4 / 2 を比較し、
   曲がりが見えた 2 を選んでいたが、この前提が誤りだった。カードのガラスは `.bento` の中に
   z-index -1 の canvas 1 枚で描かれ、背後の絵を描く itemsBelow (dom-content.js) は
   その canvas より DOM の描画順で前にあるものしか描き写さない。オーブは
   `.orb < .hole < .bento` と `.bento` の子孫なので、この絞り込みで常に落ちていた
   (ぼかしの値に関係なく、縁の内側は実測で常に一定値)。したがって「曲がって見えた」のは
   カードの外に見えていたオーブそのものであり、ぼかしの値は無関係だった
   (rereview-task-10o.md 新規指摘 1〜3)。
   Task 10r — 上の bug を直し (`orbBackdrop`、下)、renderer.ts の preserveDrawingBuffer も
   合わせて直した (2 つ目の bug、下の orbBackdrop のコメントを見よ)。その状態で
   実測すると (report の表)、承認済みの縁のレンズ (LENS.refraction 12 / edgeReach 0.15 /
   edgeWidth 0.5、上の Task 10f の節)は縁の引き寄せが最大でも 4px 程度と小さく、オーブの
   破片も細く疎らなため、2 / 4 / 6 / 8 のどれでも縁の屈折・面のすりガラス感とも実測の差は
   ノイズの範囲だった (取り込み前は常に分散 0、取り込み後はどの値でも同じくらいの
   微小な分散が出る。値ごとの差ではなく、取り込みの有無だけが効く)。両立しないわけでは
   ないので「両立しない場合は縁を優先」の場合分けには当たらない。両立する中の上限を採る
   指示どおり 8 (目安 8〜14 の下限)にした。塗り (tint)は 10o の 0.5 のまま
   (この面に文字が乗る箇所での実測コントラストは変わらず 5.30:1、report の表を見よ)。

   訂正 (Task 10r 修正ラウンド 1、レビュー review-task-10r.md Important 1) — 上の段落と
   report 2.2 は「差が縁から 38.5px 以内に収まる」ことを縁のレンズ (refraction / edgeReach)
   が効いた証拠としていたが、この推論は成り立たない。背後の絵は面全体に効くので、差が
   縁の近くに集まるのはオーブ自身が中心から離れるほど暗いという、レンズと無関係な理由でも
   説明できる。正しい実験は「同じ静止フレームで refraction と edgeReach だけを 0 にした版と
   現行版 (12 / 0.15) を撮って画素の差を取る」こと (bug 1・2 はそのままで、レンズの値だけを
   切り替える)。実際にやると、1440x900 のカード 5 枚すべてで画素の差は 1 つも無かった
   (最大差 0、カード外のオーブ自身の領域も最大差 0 で同一フレームであることを確認済み)。
   一方 refraction を 110 / edgeReach を 1.6 (ライブラリのスライダー上限) まで上げると
   同じ比較で 57〜3450 画素の差が出て、その 100% が各カードの edgeWidth 由来の帯の幅
   (短辺の半分 x 0.5) の中に収まる (帯の外は 0 件)。これは配線自体が正しく動いており、
   帯の中だけを曲げる設計どおりに反応することの証拠になる。つまり現在の承認値
   (refraction 12 / edgeReach 0.15) は、backdropBlur 8 の前ぼかしの下では実際には
   1 画素も動かしておらず、「縁の屈折」は今のところ見た目に存在しない。原因は値が
   小さすぎること (帯の幅換算で最大 4px 程度の引き寄せが、8px 前ぼかし後の滑らかな
   勾配の中では 8 bit の丸めに埋もれる) と判断した。値を上げれば効かせられることは
   上の対照実験で確認済みだが、refraction と edgeReach は Task 10f・10o で dispersion
   (縁の色ずれ) や edgeWidth (引き寄せが帯の幅を超えると白い筋になる、比 0.74 の縛り) と
   組で承認された値であり、見た目を変える再調整は今回のバグ修正 (取り込みを直す・
   焼き付きを止める) の範囲を超えると判断し、値は変えていない。再調整するならユーザーの
   新しい裁定を挟んで別タスクにするのが筋 (詳細は task-10r-report.md 修正ラウンド 1 を見よ) */
export const CARD: LiquidGlassElementOptions = {
	tint: 0.5,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 8 }
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
   描画面ごとの値なので 4 面すべてに BAR の 14 が当たる (Task 10o 修正ラウンド 1 で
   18 から下げた。目安 8〜14px に収める指示、レビュー task-10o の Important 2)。
   サイドナビと連携の列の背後を通るのは地の階調だけ (本文は左右の margin で避けてあり、
   オーブも届かない)なので、ぼかしの強さが変わっても見た目への影響は小さい
   (3 倍拡大で確認済み、scratchpad/10o-fix 以下)。
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

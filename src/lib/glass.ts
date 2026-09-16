/* Liquid Glass — apple-liquid-glass-webgl (WebGL2) を要素に載せる Svelte の attachment。
   ライブラリは要素の背後にあるページの内容 (背景、文字、<canvas>) を自前で描き直し、
   角丸長方形の符号付き距離場で縁だけを曲げて屈折させる。角丸は CSS の border-radius を読む。
   WebGL2 が無い環境では backdrop-filter に落ち、要素に data-liquid-glass="fallback" が付く */
import { LiquidGlass, type LiquidGlassElementOptions } from 'apple-liquid-glass-webgl';

/* Task 10f — 縁のレンズ。Apple の参考画像 (Liquid Glass の紹介、2025-06-09) では、
   面の中はほぼ素通しで、縁の帯の中だけ下の内容が引き伸ばされて曲がり、上と左に白い線が走る。
   ここの 2 つの値がその帯を作る (ライブラリの v2 シェーダー、v2-shaders.js 230 行目と 252 行目)。
   - edgeWidth: 帯の幅。実寸は「要素の短辺の半分 x edgeWidth」画素。高さ 64px の上部バーなら
     32 x 0.55 = 約 18px、高さ 44px の副ボタンなら 22 x 0.55 = 約 12px と、面の大きさに比例する。
   - edgeReach: 帯の中で下の内容をどれだけ引き寄せるか。実寸は「短辺の半分 x 2 x 1.24 x この値」
     画素で、上部バーなら約 14px。帯の幅 (18px)を超えないところまでに抑えてある。
     0.58 まで上げたときは引き寄せる量が帯の幅の 3 倍を超え、縁のずっと外や内から拾うように
     なって、帯の中身が元の像と繋がらない白い筋になった。この比が 1 を超えないかぎり、
     帯の中で像は切れずに引き伸びる。
   - refraction: 面の中 (帯の外)の湾曲。edgeReach とは別に、縁から
     「短辺の半分 x 0.5」画素の範囲を最大 refraction x 0.32 画素だけ内側へ引く。
     95 まで上げると、高さ 60px の依頼バーではこの引きが 30px と自分の半分の高さを超え、
     縁の帯が面の内側の何も無いところを拾って、下を通るカードの文字が消えた。
     80 が、依頼バーでも像が残り、大きいパネルでは帯の中の像がはっきり曲がる上限だった。
   - frost: 面の中の滲み。短辺に対する比で、0.02 は上部バーで約 1.3px。像の形が分かる程度に
     とどめる。ここを上げるとすりガラスになり、下の像が溶けて消える
   dispersion は帯の中だけに出る色ずれ。参考画像の縁にも薄く出ている。
   rim (縁の光)と hairline (輪郭線)は全周に同じ強さで回るので低く抑える。ここを上げると
   縁が一律の面取りになり、ガラスではなく「ふちどりを付けた板」に見える (ユーザー判定)。
   代わりに lightAngle 136 (左上から差す光)で向きの付く highlight を上げ、
   上縁の白い鏡面と下縁の薄い暗線は CSS の疑似要素で置く (app.css の Liquid Glass の節) */
const LENS = {
	refraction: 80,
	edgeReach: 0.18,
	edgeWidth: 0.55,
	dispersion: 5.5,
	frost: 0.02,
	rim: 0.3,
	reflection: 0.4,
	highlight: 1.3,
	lightAngle: 136,
	echo: 0.35,
	hairline: 0.45
} as const;

/* Task 10f — 段は 1 つだけ。iOS 26 でガラスになるのはナビ層 (バー、ボタン、ツールバー) で、
   文字が並ぶ内容はガラスではない。内容カードは CSS の白い面に戻したので、
   段を分ける理由 (カードだけ塗りを濃くする) が無くなった。
   tint はライブラリの 0〜1.5 の目盛り。0.14 は文字のコントラストが要るナビ層の下限で、
   参考画像の「ほぼ素通し」にも近い。面の中を素通しにする役は下ぼかしではなく tint が持つ。
   backdropBlur は 0。3 を入れていたときは面の中が一様な乳白色になって下の像が消え、
   縁が一律の面取りにしか見えなかった (ユーザー判定)。ぼかしでコントラストを稼がない。
   背後がオーブの破片で最も暗くなる Today のボタン列だけ、その場で tint を上書きする */
export const CLEAR: LiquidGlassElementOptions = {
	tint: 0.14,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 0 }
};

/* live: true で毎フレーム描き直す。オーブは <canvas> の中で毎フレーム描き変わり、
   ライブラリには変化の通知が来ないので、静止させるとガラスの中だけ背景が止まって見える。
   maxDpr は指定しない (ライブラリの既定 2)。一度 1 に落としていたが、画素の密度が高い
   ディスプレイでガラスの中だけ解像度が半分になる。
   respectReducedTransparency: false — OS 設定には応答しない (裁定済み) */
/* Task 10f — 間引いて描き直す repaintMs は消した。使っていたのはカレンダーの面 1 か所だけで、
   そこは内容なので普通のカードに戻した。ガラスが残るのはナビ層だけになり、
   どれも毎フレーム描き直しても本番ビルドで 54 フレーム/秒以上出る */
export function glass(options: LiquidGlassElementOptions) {
	return (node: Element) => {
		const instance = new LiquidGlass(node as HTMLElement, {
			live: true,
			respectReducedTransparency: false,
			...options
		});
		return () => instance.destroy();
	};
}

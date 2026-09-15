/* Liquid Glass — apple-liquid-glass-webgl (WebGL2) を要素に載せる Svelte の attachment。
   ライブラリは要素の背後にあるページの内容 (背景、文字、<canvas>) を自前で描き直し、
   角丸長方形の符号付き距離場で縁だけを曲げて屈折させる。角丸は CSS の border-radius を読む。
   WebGL2 が無い環境では backdrop-filter に落ち、要素に data-liquid-glass="fallback" が付く */
import { LiquidGlass, type LiquidGlassElementOptions } from 'apple-liquid-glass-webgl';

/* Task 10f — 縁のレンズ。Apple の参考画像 (Liquid Glass の紹介、2025-06-09) では、
   面の中はほぼ素通しで、縁の帯の中だけ下の内容が引き伸ばされて曲がり、上と左に白い線が走る。
   ここの 2 つの値がその帯を作る (ライブラリの v2 シェーダー、v2-shaders.js 230 行目と 252 行目)。
   - edgeWidth: 帯の幅。実寸は「要素の短辺の半分 x edgeWidth」画素。高さ 64px の上部バーなら
     32 x 0.42 = 約 13px で、完了条件の「幅 6〜12px の帯」に当たる。高さ 44px の副ボタンなら
     22 x 0.42 = 約 9px と、面の大きさに比例して細くなる。
   - edgeReach: 帯の中で下の内容をどれだけ引き寄せるか。実寸は「短辺の半分 x 2 x 1.24 x この値」
     画素で、上部バーなら約 46px 引く。0.17 (Task 10c の値) では約 13px しか動かず、
     3 倍に拡大しても帯の中で何が曲がっているのか分からなかった。
   dispersion は帯の中だけに出る色ずれ。参考画像の縁にも薄く出ている。
   lightAngle 136 は左上から差す光で、鏡面ハイライトと縁の光の向きを決める */
const LENS = {
	refraction: 110,
	edgeReach: 0.58,
	edgeWidth: 0.42,
	dispersion: 4.2,
	rim: 0.82,
	reflection: 0.62,
	highlight: 0.95,
	lightAngle: 136,
	echo: 0.55,
	hairline: 1.25
} as const;

/* Task 10f — 段は 1 つだけ。iOS 26 でガラスになるのはナビ層 (バー、ボタン、ツールバー) で、
   文字が並ぶ内容はガラスではない。内容カードは CSS の白い面に戻したので、
   段を分ける理由 (カードだけ塗りを濃くする) が無くなった。
   tint はライブラリの 0〜1.5 の目盛り。0.14 は参考画像の「ほぼ素通し」に合わせた値で、
   ここから上げると面が白く濁り、屈折した縁より面のほうが目立つ。
   backdropBlur 3 はナビ層の下を通る文字を溶かすためのごく弱いぼかし。
   強くするとすりガラスになり、厚みのある透明な板に見えなくなる */
export const CLEAR: LiquidGlassElementOptions = {
	tint: 0.14,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 3 }
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

/* Liquid Glass — apple-liquid-glass-webgl (WebGL2) を要素に載せる Svelte の attachment。
   ライブラリは要素の背後にあるページの内容 (背景、文字、<canvas>) を自前で描き直し、
   角丸長方形の符号付き距離場で縁だけを曲げて屈折させる。角丸は CSS の border-radius を読む。
   WebGL2 が無い環境では backdrop-filter に落ち、要素に data-liquid-glass="fallback" が付く */
import { LiquidGlass, type LiquidGlassElementOptions } from 'apple-liquid-glass-webgl';

/* 縁のレンズ。どの段でも同じ強さにする (ブリーフ 3)。
   edgeReach 0.17 は縁から内側 17% の帯だけを曲げるという意味で、ブリーフ 1 の
   「縁から内側 10〜18% の帯」に当たる。refraction は上限の 110。
   lightAngle 136 は左上から差す光で、鏡面ハイライトと縁の光の向きを決める (ブリーフ 4) */
const LENS = {
	refraction: 110,
	edgeReach: 0.17,
	edgeWidth: 0.3,
	dispersion: 2.4,
	rim: 0.34,
	reflection: 0.34,
	highlight: 0.46,
	lightAngle: 136,
	hairline: 0.95
} as const;

/* 段ごとに違うのは面の濁り (tint) と背景の下ぼかし (backdropBlur) だけ。
   tint はライブラリの 0〜1.5 の目盛りで、CSS の不透明度とは一致しない。値はすべて
   「文字のコントラストを実測して 4.5:1 を満たす下限」で決めた (task-10c-report.md) */

/* ナビ層 (上部バー、サイドナビ、依頼バー、連携中の列): 文字は要素自身の上に載り、
   背後は色の塊だけなので、いちばん透明にできる */
export const CLEAR: LiquidGlassElementOptions = {
	tint: 0.22,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 3 }
};

/* Today の内容カード: 12px の小さな文字が並び、しかも裏でオーブが毎フレーム動く。
   ここだけは塗りと下ぼかしを上げないと文字が読めない */
export const REGULAR: LiquidGlassElementOptions = {
	tint: 0.72,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 12 }
};

/* 公開パネル (Welcome と /connect): 載る文字が大きく数も少ないので実測に余裕があり、
   カードより薄く、ぼかしも弱くできる。オーブの下半分がガラス越しに形のまま見える */
export const PANEL: LiquidGlassElementOptions = {
	tint: 0.5,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 6 }
};

/* live: true で毎フレーム描き直す。背景の色の塊は 72 秒の CSS アニメーションで漂い、
   オーブは <canvas> の中で毎フレーム描き変わる。どちらもライブラリには変化の通知が来ないので、
   静止させるとガラスの中だけ背景が止まって見える。
   maxDpr: 1 — ガラスの canvas は背後を 2D で描き直してから WebGL に渡すので、画素数が
   そのまま毎フレームの費用になる。既定の 2 だと実測で描画が 3 割ほど落ちた。中身はぼかしと
   屈折で元から滑らかなので、1 に落としても縁の細い光以外は見た目が変わらない。
   respectReducedTransparency: false — OS 設定には応答しない (裁定済み) */
export function glass(options: LiquidGlassElementOptions) {
	return (node: Element) => {
		const instance = new LiquidGlass(node as HTMLElement, {
			live: true,
			maxDpr: 1,
			respectReducedTransparency: false,
			...options
		});
		return () => instance.destroy();
	};
}

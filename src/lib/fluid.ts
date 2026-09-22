/* 窓の幅に連続して追従する寸法。CSS の clamp() は「窓の幅そのもの」でしか補間できず、
   オーブのように「narrow の境目 (700px など) をまたいで 2 値を結ぶ」用途には使えないため、
   ここで同じ考え方 (下限・上限の間を線形補間し、外側は値を固定) を TS 側に持つ。
   境目の位置と両端の値は今までの 2 値 / 3 値のままで、飛びだけを連続に均す */

/** min から max まで、from の幅から to の幅にかけて線形に補間する。範囲外は端の値で止める */
export function fluid(width: number, from: number, to: number, min: number, max: number): number {
	if (to <= from) return width <= from ? min : max;
	const t = (width - from) / (to - from);
	return min + (max - min) * Math.min(1, Math.max(0, t));
}

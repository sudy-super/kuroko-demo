/* 窓の幅に連続して追従する寸法。CSS の clamp() は窓の幅そのものでしか補間できず、narrow の境目
   (700px など) をまたいで 2 値を結べないので、同じ考え方 (両端の間を線形補間) を TS 側に持つ */

/** min から max まで、from の幅から to の幅にかけて線形に補間する。範囲外は端の値で止める */
export function fluid(width: number, from: number, to: number, min: number, max: number): number {
	if (to <= from) return width <= from ? min : max;
	const t = (width - from) / (to - from);
	return min + (max - min) * Math.min(1, Math.max(0, t));
}

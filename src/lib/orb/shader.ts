// オーブの GLSL。すべて GLSL ES 1.00 で書き、WebGL1 / WebGL2 の両方で同じソースを使う。
// 座標系: p = (画素 - 中心) / (短辺 / 2) → [-1, 1]。球の半径は R0 (直径は箱の 48%)。
// 出力はすべて premultiplied alpha (rgb には alpha を掛けた値を書く)。

export const R0 = 0.48;

const COMMON = /* glsl */ `
precision highp float;
const float PI = 3.14159265;
const float R0 = ${R0};
const vec3 C_EDGE  = vec3(0.071, 0.251, 0.604); /* #12409a 球の外周を締める深い青 */
const vec3 C_DEEP  = vec3(0.106, 0.384, 0.839); /* #1b62d6 */
const vec3 C_TOP   = vec3(0.165, 0.435, 0.878); /* #2a6fe0 */
const vec3 C_MID   = vec3(0.184, 0.486, 0.965); /* #2f7cf6 */
const vec3 C_SOFT  = vec3(0.310, 0.584, 1.000); /* #4f95ff */
const vec3 C_LIGHT = vec3(0.612, 0.769, 1.000); /* #9cc4ff */
float breathe(float t) { return R0 * (1.0 + 0.015 * sin(t * 2.0 * PI / 4.0)); } /* 呼吸 ±1.5%、4 秒 */
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
/* 3D → 画面。奥ほど少し縮む弱い遠近 */
vec2 project(vec3 p) { return p.xy * (1.0 + 0.12 * p.z); }
/* 1 を超えた色は色相を保ったまま白へ寄せる (単純な clamp だと青がシアンに転ぶ) */
vec3 softWhite(vec3 c) {
	float m = max(c.r, max(c.g, c.b));
	return m > 1.0 ? mix(c / m, vec3(1.0), 1.0 - exp(-(m - 1.0) * 1.2)) : c;
}
/* 球の裏側 (z < 0 で円盤の内側) は隠す */
float behind(vec3 p, float R) { return (p.z < 0.0) ? smoothstep(R * 0.96, R * 1.02, length(p.xy)) : 1.0; }
`;

const NOISE = /* glsl */ `
/* Dave Hoskins の hash33: sin を使わないので mediump な GPU でも崩れない */
vec3 hash3(vec3 p) {
	p = fract(p * vec3(0.1031, 0.1030, 0.0973));
	p += dot(p, p.yxz + 33.33);
	return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}
vec2 hash2(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.xx + p3.yz) * p3.zy);
}
/* 3D gradient noise (Inigo Quilez)、quintic 補間 */
float noise(vec3 p) {
	vec3 i = floor(p), f = fract(p);
	vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	return mix(
		mix(mix(dot(hash3(i), f), dot(hash3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
			mix(dot(hash3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), dot(hash3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
		mix(mix(dot(hash3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), dot(hash3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
			mix(dot(hash3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), dot(hash3(i + 1.0), f - 1.0), u.x), u.y), u.z);
}
/* fbm 5 オクターブ。値域はおよそ [-0.7, 0.7] */
float fbm(vec3 p) {
	float a = 0.5, s = 0.0;
	for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
	return s;
}
/* 2D の Voronoi。x = 最近傍の距離 F1、y = 2 番目との差 (結晶の面の縁) */
vec2 voronoi(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	float f1 = 8.0, f2 = 8.0;
	for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
		vec2 g = vec2(float(x), float(y));
		vec2 o = hash2(i + g);
		float d = length(g + o - f);
		if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
	}
	return vec2(f1, f2 - f1);
}
`;

/** 画面全体を覆う 1 枚の三角形 (3 頂点) */
export const QUAD_VS = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/** 球本体 (エネルギー体) + 2 段の光彩。法線は sqrt(1 - x² - y²) で解析的に求める */
export const SPHERE_FS = /* glsl */ `
${COMMON}
${NOISE}
uniform vec2 uRes;
uniform float uTime;

void main() {
	vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y));
	float d = length(p);
	float R = breathe(uTime);
	float spin = uTime * 2.0 * PI / 45.0; /* 自転 45 秒 */

	/* 2 段の光彩 (R→0.75、0.75→0.98)。球の直径の約 2 倍まで。二乗で減衰させ縁に光を溜める */
	float h1 = smoothstep(0.75, R * 0.9, d);
	float h2 = smoothstep(0.98, 0.7, d);
	float haloA = 0.6 * h1 * h1 + 0.22 * h2 * h2;
	vec3 haloC = mix(C_LIGHT, C_SOFT, h1 * 0.6); /* 淡い背景で消えないよう球の近くほど青を濃くする */

	vec3 col = vec3(0.0);
	float cov = 0.0;
	if (d < R * 1.08) {
		vec2 s = p / R;
		vec3 n = vec3(s, sqrt(max(0.0, 1.0 - min(dot(s, s), 1.0))));
		vec3 q = rotY(spin) * n;

		/* 輪郭は fbm で崩し、破片に砕けて散る途中に見せる (輪郭のノイズは自転させない) */
		float edgeN = fbm(vec3(p * 3.0, uTime * 0.05));
		float Rn = R * (1.0 + 0.05 * edgeN);
		cov = smoothstep(Rn * 1.02, Rn * 0.95, d);

		float f1 = fbm(q * 2.2 + vec3(0.0, uTime * 0.04, 0.0));
		float f2 = fbm(q * 2.2 + vec3(5.2, -uTime * 0.03, 1.3));
		/* domain warp: ノイズでノイズの座標をずらすと液体の渦に見える */
		float fw = fbm(q * 2.0 + vec3(f1, f2, f1 * f2) * 1.1 + vec3(0.0, uTime * 0.03, 0.0));

		/* 深い青 → 明るい青 → 白 の急な階調。中心ほど白へ寄る */
		float core = pow(max(1.0 - d / R, 0.0), 1.5);
		float band = clamp(0.12 + 2.2 * fw + 0.5 * core, 0.0, 1.0);
		vec3 base = mix(C_EDGE, C_DEEP, smoothstep(0.0, 0.3, band));
		base = mix(base, C_MID, smoothstep(0.25, 0.55, band));
		base = mix(base, C_LIGHT, smoothstep(0.5, 0.8, band));
		base = mix(base, vec3(1.0), smoothstep(0.75, 1.0, band) * (0.25 + 0.75 * core));

		/* 結晶の面: 2D Voronoi の面ごとの明暗と、面の縁の細い明るい線 */
		vec2 vq = (q.xy + q.z * 0.35) * 9.0;
		vec2 vo = voronoi(vq);
		float facet = 0.85 + 0.3 * hash2(floor(vq)).x;
		float crack = 1.0 - smoothstep(0.0, 0.06, vo.y);
		base *= facet;
		base += C_LIGHT * crack * 0.35 * smoothstep(0.2, 0.6, band);

		/* 内側の第 2 の球 (半径 0.6 倍、位相違いの fbm)、外殻の法線 xy で座標をずらして屈折に見せる */
		vec2 rp = p - n.xy * 0.06;
		float Ri = R * 0.6;
		float di = length(rp);
		if (di < Ri) {
			vec2 si = rp / Ri;
			vec3 ni = vec3(si, sqrt(max(0.0, 1.0 - dot(si, si))));
			float fi = fbm(rotY(-spin * 0.7) * ni * 3.0 + vec3(2.7, uTime * 0.05, 8.1));
			vec3 innerCol = mix(C_EDGE, C_SOFT, clamp(0.5 + 1.6 * fi, 0.0, 1.0));
			float innerCov = smoothstep(Ri, Ri - 0.08, di) * (0.4 + 0.5 * ni.z);
			base = mix(base, innerCol, innerCov * 0.5 * (1.0 - core));
		}

		/* 白い筋: 高周波 fbm の零点付近を細い脈として、別ノイズで場所を区切って screen で足す */
		float hf = fbm(q * 3.4 + vec3(uTime * 0.06, 3.3, -uTime * 0.02));
		float patch = smoothstep(-0.1, 0.3, f2);
		float streak = (1.0 - smoothstep(0.0, 0.07, abs(hf))) * 0.6 * patch + smoothstep(0.2, 0.5, hf) * 0.35;
		base = 1.0 - (1.0 - base) * (1.0 - streak * vec3(0.9, 0.96, 1.0));

		/* 照明は控えめ (エネルギー体なので陰は浅い)、鏡面は小さく弱く */
		vec3 nn = normalize(n + vec3(f1, f2, 0.0) * 0.14);
		vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
		float diff = 0.85 + 0.15 * max(dot(nn, L), 0.0);
		vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
		float spec = pow(max(dot(nn, H), 0.0), 48.0);
		col = mix(C_EDGE * 0.8, base, diff);

		/* 外周は深い青で締め、淡い背景に埋もれないようにする */
		float rim = 1.0 - n.z;
		col = mix(col, C_EDGE, smoothstep(0.45, 1.0, rim) * 0.75 * (1.0 - core));
		/* 核: 中心ほど白く飛ぶ emission */
		float glow = pow(max(1.0 - d / (R * 0.6), 0.0), 2.6);
		col += mix(C_LIGHT, vec3(1.0), 0.6) * glow * 1.5;
		/* Schlick のフレネル: 縁に細い光の線 */
		col += C_LIGHT * pow(rim, 5.0) * 0.9;
		col += spec * 0.15;
		col = softWhite(col);
	}
	float a = cov + haloA * (1.0 - cov);
	vec3 rgb = col * cov + haloC * haloA * (1.0 - cov);
	gl_FragColor = vec4(rgb, a);
}
`;

/**
 * 破片: 1 個 = 6 頂点 (三角形 2 枚)。aSeed = (角度, 緯度, 半径/寿命, 群と位相)、aCorner = 四角の隅 [-1, 1]。
 * w < 0.55 は球面から放射状に飛び出して減速しながら消える群、それ以外は表面に張り付いて回る群。
 * 進行方向に伸び (速度で 1〜4 倍)、各自回転する
 */
export const SHARD_VS = /* glsl */ `
${COMMON}
attribute vec4 aSeed;
attribute vec2 aCorner;
uniform vec2 uRes;
uniform float uTime;
varying float vA;
varying vec3 vC;
void main() {
	float R = breathe(uTime);
	float ang = aSeed.x * 2.0 * PI;
	float lat = acos(2.0 * aSeed.y - 1.0); /* 球面に一様に配る */
	vec3 pos, vel;
	float alpha, size;
	if (aSeed.w < 0.55) {
		float T = 4.0 + 5.0 * aSeed.z; /* 寿命 4〜9 秒 */
		float life = fract(uTime / T + aSeed.w * 17.0);
		float e = 1.0 - (1.0 - life) * (1.0 - life); /* ease-out: 飛び出して減速 */
		vec3 dirv = rotY(uTime * 2.0 * PI / 120.0) * vec3(sin(lat) * cos(ang), cos(lat), sin(lat) * sin(ang));
		pos = dirv * R * (1.0 + 1.25 * e);
		vel = dirv * (1.0 - life);
		alpha = smoothstep(0.0, 0.06, life) * smoothstep(1.0, 0.7, life);
		size = mix(0.004, 0.022, pow(fract(aSeed.z * 5.0), 2.5));
	} else {
		float dir = aSeed.z < 0.5 ? 1.0 : -1.0;
		float a = ang + dir * uTime * 2.0 * PI / 70.0; /* 公転 70 秒 */
		vec3 p0 = vec3(sin(lat) * cos(a), cos(lat), sin(lat) * sin(a));
		mat3 tilt = rotX(0.4);
		pos = tilt * p0 * R * (1.0 + 0.1 * fract(aSeed.z * 3.0));
		vel = tilt * vec3(-sin(lat) * sin(a), 0.0, sin(lat) * cos(a)) * 0.25 * dir;
		alpha = 1.0;
		size = mix(0.004, 0.013, pow(fract(aSeed.y * 7.0), 2.0));
	}
	float depth = 0.5 + 0.5 * pos.z / length(pos);
	alpha *= behind(pos, R) * mix(0.6, 1.0, depth);

	vec2 c = project(pos);
	vec2 v2 = vel.xy;
	float sp = length(v2);
	vec2 d2 = sp > 1e-4 ? v2 / sp : vec2(1.0, 0.0);
	float rot = uTime * (0.4 + aSeed.x * 1.6) * (aSeed.y < 0.5 ? 1.0 : -1.0);
	vec2 corner = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * aCorner;
	float stretch = 1.0 + 2.0 * sp;
	vec2 off = d2 * corner.x * size * stretch + vec2(-d2.y, d2.x) * corner.y * size;
	gl_Position = vec4((c + off) * min(uRes.x, uRes.y) / uRes, 0.0, 1.0);

	float tone = fract(aSeed.x * 13.0);
	vC = tone < 0.42 ? mix(C_EDGE * 0.8, C_DEEP, fract(aSeed.w * 9.0)) : (tone < 0.7 ? C_MID : mix(C_LIGHT, vec3(1.0), 0.8));
	vA = alpha * (0.85 + 0.15 * aCorner.y); /* 面の明暗 */
}
`;

export const SHARD_FS = /* glsl */ `
precision mediump float;
varying float vA;
varying vec3 vC;
void main() { gl_FragColor = vec4(vC * vA, vA); }
`;

/** plexus の線と結節点、細かい塵。aPos = (x, y, alpha) を CPU で毎フレーム作る */
export const LINE_VS = /* glsl */ `
attribute vec3 aPos;
uniform vec2 uRes;
uniform float uSize;
varying float vA;
void main() {
	gl_Position = vec4(aPos.xy * min(uRes.x, uRes.y) / uRes, 0.0, 1.0);
	gl_PointSize = uSize;
	vA = aPos.z;
}
`;

export const LINE_FS = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uPoint;
varying float vA;
void main() {
	float k = vA;
	if (uPoint > 0.5) { vec2 c = gl_PointCoord - 0.5; k *= exp(-dot(c, c) * 14.0); }
	gl_FragColor = vec4(uColor * k, k);
}
`;

/**
 * 光の帯: 球を斜めに囲む細い円弧。aRing = (0〜1 の角度, -1/1 の側)。triangle strip。
 * uCfg = (傾き, 半径の倍率, 弧が進む速さ)、uPhase で 2 本目をずらす。裏側は隠す
 */
export const RING_VS = /* glsl */ `
${COMMON}
attribute vec2 aRing;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCfg;
uniform float uPhase;
varying float vA;
varying float vSide;
void main() {
	float R = breathe(uTime);
	float a = aRing.x * 2.0 * PI;
	mat3 m = rotY(uTime * 2.0 * PI / 90.0 + uPhase) * rotX(uCfg.x); /* 面が 90 秒でゆっくり歳差 */
	vec3 p = m * (vec3(cos(a), 0.0, sin(a)) * R * uCfg.y);
	vec3 t = m * vec3(-sin(a), 0.0, cos(a));
	vec2 c = project(p);
	vec2 t2 = normalize(t.xy + vec2(1e-4, 0.0));
	vec2 nrm = vec2(-t2.y, t2.x);
	float width = 0.009 * R / R0;
	gl_Position = vec4((c + nrm * aRing.y * width) * min(uRes.x, uRes.y) / uRes, 0.0, 1.0);
	/* 弧: 周の 55% だけ光り、両端は柔らかく。弧そのものが周に沿って進む */
	float w = fract(aRing.x - uTime * uCfg.z + uPhase);
	float arc = smoothstep(0.0, 0.2, w) * smoothstep(0.55, 0.3, w);
	vA = arc * behind(p, R) * mix(0.35, 1.0, 0.5 + 0.5 * p.z / length(p));
	vSide = aRing.y;
}
`;

export const RING_FS = /* glsl */ `
precision mediump float;
varying float vA;
varying float vSide;
void main() {
	float k = (1.0 - vSide * vSide) * vA * 0.9;
	vec3 c = mix(vec3(0.612, 0.769, 1.0), vec3(1.0), 0.5);
	gl_FragColor = vec4(c * k, k);
}
`;

/** bloom 1/3: 明るい部分の抽出 */
export const BRIGHT_FS = /* glsl */ `
precision mediump float;
uniform sampler2D uTex;
uniform float uThreshold;
varying vec2 vUv;
void main() {
	vec4 c = texture2D(uTex, vUv);
	float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	gl_FragColor = c * smoothstep(uThreshold, uThreshold + 0.3, lum);
}
`;

/** bloom 2/3: 13 タップの分離ガウスぼかし (σ = 2.4 タップ)。uDir にテクセル単位の刻みを入れる */
export const BLUR_FS = /* glsl */ `
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
	vec4 s = texture2D(uTex, vUv) * 0.167;
	s += (texture2D(uTex, vUv + uDir) + texture2D(uTex, vUv - uDir)) * 0.153;
	s += (texture2D(uTex, vUv + uDir * 2.0) + texture2D(uTex, vUv - uDir * 2.0)) * 0.118;
	s += (texture2D(uTex, vUv + uDir * 3.0) + texture2D(uTex, vUv - uDir * 3.0)) * 0.077;
	s += (texture2D(uTex, vUv + uDir * 4.0) + texture2D(uTex, vUv - uDir * 4.0)) * 0.042;
	s += (texture2D(uTex, vUv + uDir * 5.0) + texture2D(uTex, vUv - uDir * 5.0)) * 0.019;
	s += (texture2D(uTex, vUv + uDir * 6.0) + texture2D(uTex, vUv - uDir * 6.0)) * 0.007;
	gl_FragColor = s;
}
`;

/** bloom 3/3: 加算合成。明るい背景でも光が見えるよう alpha を色の最大成分まで引き上げる */
export const COMPOSITE_FS = /* glsl */ `
precision mediump float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uStrength;
varying vec2 vUv;
void main() {
	vec4 s = texture2D(uScene, vUv);
	vec4 b = texture2D(uBloom, vUv) * uStrength;
	vec3 rgb = s.rgb + b.rgb;
	float m = max(rgb.r, max(rgb.g, rgb.b));
	if (m > 1.0) rgb = mix(rgb / m, vec3(1.0), 1.0 - exp(-(m - 1.0) * 1.2)); /* 色相を保って白へ */
	float a = max(min(s.a + b.a * 0.8, 1.0), max(rgb.r, max(rgb.g, rgb.b)));
	gl_FragColor = vec4(rgb, a);
}
`;

// オーブの GLSL。すべて GLSL ES 1.00 で書き、WebGL1 / WebGL2 の両方で同じソースを使う。
// 座標系: p = (画素 - 中心) / (短辺 / 2) → [-1, 1]。球の半径は R0。
// 出力はすべて premultiplied alpha (rgb には alpha を掛けた値を書く)。

export const R0 = 0.38;

const COMMON = /* glsl */ `
precision highp float;
const float PI = 3.14159265;
const float R0 = ${R0};
const vec3 C_DEEP  = vec3(0.106, 0.384, 0.839); /* #1b62d6 */
const vec3 C_TOP   = vec3(0.165, 0.435, 0.878); /* #2a6fe0 */
const vec3 C_MID   = vec3(0.184, 0.486, 0.965); /* #2f7cf6 */
const vec3 C_SOFT  = vec3(0.310, 0.584, 1.000); /* #4f95ff */
const vec3 C_LIGHT = vec3(0.612, 0.769, 1.000); /* #9cc4ff */
float breathe(float t) { return R0 * (1.0 + 0.015 * sin(t * 2.0 * PI / 4.0)); } /* 呼吸 ±1.5%、4 秒 */
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
`;

/** 画面全体を覆う 1 枚の三角形 (3 頂点、バッファ不要) */
export const QUAD_VS = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/** 球本体 + 2 段のハロー。法線は sqrt(1 - x² - y²) で解析的に求める */
export const SPHERE_FS = /* glsl */ `
${COMMON}
uniform vec2 uRes;
uniform float uTime;

/* Dave Hoskins の hash33: sin を使わないので mediump な GPU でも崩れない */
vec3 hash3(vec3 p) {
	p = fract(p * vec3(0.1031, 0.1030, 0.0973));
	p += dot(p, p.yxz + 33.33);
	return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
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

void main() {
	vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y));
	float px = 2.0 / min(uRes.x, uRes.y);
	float d = length(p);
	float R = breathe(uTime);

	/* 2 段のハロー (R→0.55、0.55→0.75)。距離の二乗で減衰させ、球の縁に光が溜まって見せる */
	float h1 = smoothstep(0.55, R, d);
	float h2 = smoothstep(0.75, 0.55, d);
	float haloA = 0.5 * h1 * h1 + 0.16 * h2 * h2;
	vec3 haloC = mix(C_SOFT, mix(C_LIGHT, vec3(1.0), 0.35), h1);

	vec3 col = vec3(0.0);
	float cov = 0.0;
	if (d < R + px) {
		cov = smoothstep(R + px, R - px, d);
		vec2 s = p / R;
		vec3 n = vec3(s, sqrt(max(0.0, 1.0 - dot(s, s))));
		float spin = uTime * 2.0 * PI / 45.0; /* 自転 45 秒 */
		vec3 q = rotY(spin) * n;
		float f1 = fbm(q * 2.2 + vec3(0.0, uTime * 0.04, 0.0));
		float f2 = fbm(q * 2.2 + vec3(5.2, -uTime * 0.03, 1.3));
		vec3 nn = normalize(n + vec3(f1, f2, 0.0) * 0.14); /* 表面の揺らぎ */
		/* domain warp: ノイズでノイズの座標をずらすと液体の渦に見える */
		float fw = fbm(q * 1.8 + vec3(f1, f2, f1 * f2) * 0.9 + vec3(0.0, uTime * 0.03, 0.0));

		/* 青 3 段をノイズと高さで補間 */
		float band = clamp(0.48 + 1.3 * fw + 0.15 * n.y, 0.0, 1.0);
		vec3 base = mix(C_DEEP, C_MID, smoothstep(0.0, 0.5, band));
		base = mix(base, C_LIGHT, smoothstep(0.45, 0.85, band));
		base = mix(base, vec3(1.0), smoothstep(0.85, 1.0, band) * 0.35);

		/* 内側の第 2 の球 (半径 0.6 倍、位相違いの fbm)。外殻の法線 xy で座標をずらして屈折に見せる */
		vec2 rp = p - nn.xy * 0.07;
		float Ri = R * 0.6;
		float di = length(rp);
		if (di < Ri) {
			vec2 si = rp / Ri;
			vec3 ni = vec3(si, sqrt(max(0.0, 1.0 - dot(si, si))));
			vec3 qi = rotY(-spin * 0.7) * ni;
			float fi = fbm(qi * 3.0 + vec3(2.7, uTime * 0.05, 8.1));
			vec3 innerCol = mix(C_DEEP, C_SOFT, clamp(0.5 + 1.6 * fi, 0.0, 1.0));
			float innerCov = smoothstep(Ri, Ri - 0.06, di) * (0.4 + 0.5 * ni.z);
			base = mix(base, innerCol, innerCov * 0.6);
		}

		/* 白い筋: 高周波の fbm の零点付近だけを細い脈として screen で足す */
		float hf = fbm(q * 3.4 + vec3(uTime * 0.06, 3.3, -uTime * 0.02));
		float patch = smoothstep(-0.05, 0.3, f2); /* 脈が出る場所を別のノイズで区切り、全面に走らせない */
		float streak = (1.0 - smoothstep(0.0, 0.07, abs(hf))) * 0.4 * patch + smoothstep(0.25, 0.5, hf) * 0.3;
		base = 1.0 - (1.0 - base) * (1.0 - streak * vec3(0.9, 0.96, 1.0));

		/* 左上からの拡散光 + 鏡面ハイライト (Blinn-Phong、指数 48) */
		vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
		float diff = 0.35 + 0.65 * max(dot(nn, L), 0.0);
		vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
		float spec = pow(max(dot(nn, H), 0.0), 48.0);

		col = mix(C_DEEP * 0.55, base, diff); /* 陰は黒ではなく深い青に落とす */
		/* 発光する中心 */
		float core = exp(-dot(p, p) / (R * R * 0.32));
		col = mix(col, mix(C_LIGHT, vec3(1.0), 0.5), core * 0.45);
		/* Schlick のフレネル: 縁を #9cc4ff に光らせる */
		float fres = pow(1.0 - max(n.z, 0.0), 3.5);
		col += C_LIGHT * fres * 1.2;
		col += spec * 0.4;
	}
	float a = cov + haloA * (1.0 - cov);
	vec3 rgb = col * cov + haloC * haloA * (1.0 - cov);
	gl_FragColor = vec4(rgb, a);
}
`;

/** 粒子: aSeed = (角度, 緯度, 半径/寿命, 群と位相)。w < 0.6 は球面付近を公転、それ以外は放射状に離れて消える */
export const PARTICLE_VS = /* glsl */ `
${COMMON}
attribute vec4 aSeed;
uniform vec2 uRes;
uniform float uTime;
varying float vA;
varying vec3 vC;
void main() {
	float R = breathe(uTime);
	float ang = aSeed.x * 2.0 * PI;
	float lat = acos(2.0 * aSeed.y - 1.0); /* 球面に一様に配る */
	vec3 pos;
	float alpha, size;
	if (aSeed.w < 0.6) {
		float dir = aSeed.z < 0.5 ? 1.0 : -1.0;
		float r = R * (1.03 + 0.2 * fract(aSeed.z * 7.0));
		float a = ang + dir * uTime * 2.0 * PI / 60.0; /* 公転 60 秒 */
		pos = rotX(0.35) * (vec3(sin(lat) * cos(a), cos(lat), sin(lat) * sin(a)) * r);
		float depth = 0.5 + 0.5 * pos.z / r;
		float twinkle = 0.55 + 0.45 * sin(uTime * (0.7 + aSeed.w * 2.0) + aSeed.x * 40.0);
		alpha = twinkle * mix(0.25, 1.0, depth);
		size = mix(1.0, 4.0, depth) * (0.7 + 0.6 * fract(aSeed.y * 9.0));
	} else {
		float T = 6.0 + 5.0 * aSeed.z; /* 寿命 6〜11 秒 */
		float life = fract(uTime / T + aSeed.w * 13.0);
		vec3 dirv = vec3(sin(lat) * cos(ang), cos(lat), sin(lat) * sin(ang));
		pos = dirv * R * (0.98 + 1.15 * life);
		float depth = 0.5 + 0.5 * dirv.z;
		alpha = smoothstep(0.0, 0.12, life) * pow(1.0 - life, 1.6) * mix(0.35, 1.0, depth);
		size = mix(1.2, 3.2, depth) * (1.0 - 0.4 * life);
	}
	/* 球の裏側は球に隠す */
	if (pos.z < 0.0 && length(pos.xy) < R * 0.97) alpha = 0.0;
	vec2 xy = pos.xy * (1.0 + 0.12 * pos.z);
	gl_Position = vec4(xy * min(uRes.x, uRes.y) / uRes, 0.0, 1.0);
	float scale = min(uRes.x, uRes.y) / 520.0; /* 520px の基準に対する倍率 (DPR 込み) */
	gl_PointSize = max(2.0, size * scale * 3.0);
	vA = alpha;
	vC = mix(C_SOFT, mix(C_LIGHT, vec3(1.0), 0.4), alpha);
}
`;

export const PARTICLE_FS = /* glsl */ `
precision mediump float;
varying float vA;
varying vec3 vC;
void main() {
	vec2 c = gl_PointCoord - 0.5;
	float r2 = dot(c, c) * 4.0;
	float k = exp(-r2 * 3.0) * (1.0 - smoothstep(0.6, 1.0, r2)) * vA;
	gl_FragColor = vec4(vC * k, k);
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
	gl_FragColor = c * smoothstep(uThreshold, uThreshold + 0.25, lum);
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
	vec3 rgb = min(s.rgb + b.rgb, vec3(1.0));
	float a = max(min(s.a + b.a * 0.7, 1.0), max(rgb.r, max(rgb.g, rgb.b)));
	gl_FragColor = vec4(rgb, a);
}
`;

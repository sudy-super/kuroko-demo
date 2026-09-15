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
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
/* 3D → 画面。奥ほど少し縮む弱い遠近 */
vec2 project(vec3 p) { return p.xy * (1.0 + 0.12 * p.z); }
/* 球の裏側 (z < 0 で円盤の内側) は隠す */
float behind(vec3 p, float R) { return (p.z < 0.0) ? smoothstep(R * 0.85, R * 1.2, length(p.xy)) : 1.0; } /* 崩れた外縁に合わせて広く柔らかく隠す */
/* 1 を超えた色は色相を保ったまま白へ寄せる (単純な clamp だと青がシアンに転ぶ) */
vec3 softWhite(vec3 c) {
	float m = max(c.r, max(c.g, c.b));
	return m > 1.0 ? mix(c / m, vec3(1.0), 1.0 - exp(-(m - 1.0) * 1.2)) : c;
}
/* 差動回転 (Atom のロゴの作法): 中心に近い層ほど速く公転する。rr は R の倍率 (1.0 = 球面)。
   周期は球面で 35 秒、2.2R で 115 秒。層は 0.25R 刻みの 5 層で、傾きを少しずつ変え、2 層 (1 と 3) は逆回転 */
float orbitPeriod(float rr) { return mix(35.0, 115.0, clamp((rr - 1.0) / 1.2, 0.0, 1.0)); }
float orbitLayer(float rr) { return floor(clamp((rr - 1.0) / 0.25, 0.0, 4.0)); }
float orbitDir(float layer) { return (layer == 1.0 || layer == 3.0) ? -1.0 : 1.0; } /* 2 層を逆回転 */
mat3 orbitTilt(float layerF) { return rotX(0.35 + 0.12 * layerF) * rotZ(0.15 * layerF - 0.3); }
vec3 onSphere(float ang, float lat) { return vec3(sin(lat) * cos(ang), cos(lat), sin(lat) * sin(ang)); }
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

	/* 2 段の光彩 (R→1.45R、1.45R→1.97R = 直径の約 2 倍)。遠いほど白へ寄せ、淡い背景でも「光」に見せる */
	float h1 = smoothstep(R * 1.45, R, d);
	float h2 = smoothstep(R * 1.97, R * 1.45, d);
	float haloN = fbm(vec3(p * 1.3, 7.0 + uTime * 0.03)); /* 光彩も真円にしない */
	float haloA = (0.6 * h1 * h1 + 0.22 * h2 * h2) * (0.8 + 0.5 * haloN);
	/* 光彩は白ではなく青 (#9cc4ff〜#4f95ff)。白を混ぜると全体が白く濁る */
	vec3 haloC = mix(C_LIGHT, C_SOFT, h1 * 0.6);

	vec3 col = vec3(0.0);
	float cov = 0.0;
	float leak = 0.0;
	vec3 leakC = C_LIGHT;
	if (d < R * 1.35) {
		vec2 s = p / R;
		vec3 n = vec3(s, sqrt(max(0.0, 1.0 - min(dot(s, s), 1.0))));
		/* 自転にも差動を付ける: 中心は 20 秒、外殻は 45 秒 */
		float spin = uTime * 2.0 * PI / mix(20.0, 45.0, min(d / R, 1.0));
		vec3 q = rotY(spin) * n;

		/* オーブは円ではない。距離場を低周波の fbm で大きく歪め (±22%)、0.72R〜1.3R の広い範囲で
		   徐々に薄くし、外側ほどノイズで斑に抜けさせる。円周が線として見えない光の塊にする */
		float edgeN = fbm(vec3(p * 1.6, uTime * 0.04));
		float dn = d * (1.0 + 0.3 * edgeN);
		cov = smoothstep(R * 1.3, R * 0.72, dn);

		float f1 = fbm(q * 2.2 + vec3(0.0, uTime * 0.04, 0.0));
		float f2 = fbm(q * 2.2 + vec3(5.2, -uTime * 0.03, 1.3));
		/* domain warp: ノイズでノイズの座標をずらすと液体の渦に見える */
		float fw = fbm(q * 2.0 + vec3(f1, f2, f1 * f2) * 1.1 + vec3(0.0, uTime * 0.03, 0.0));

		/* 外側は渦のノイズに沿って斑に抜ける (輪郭の代わりに密度で外縁を決める) */
		cov *= mix(1.0, smoothstep(-0.35, 0.25, fw), smoothstep(R * 0.5, R * 1.15, d));

		/* 深い青 → 明るい青 → 白 の急な階調。中心ほど白へ、外ほど深い青へ */
		float core = pow(max(1.0 - d / R, 0.0), 1.5);
		float band = clamp(0.12 + 2.2 * fw + 0.5 * core - 0.3 * smoothstep(R * 0.5, R * 1.2, d), 0.0, 1.0);
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
			base = mix(base, innerCol, innerCov * 0.65 * (1.0 - core));
		}

		/* 白い筋: 高周波 fbm の零点付近を細い脈として、別ノイズで場所を区切って screen で足す */
		float hf = fbm(q * 3.4 + vec3(uTime * 0.06, 3.3, -uTime * 0.02));
		float patch = smoothstep(-0.1, 0.3, f2);
		float streak = (1.0 - smoothstep(0.0, 0.07, abs(hf))) * 0.6 * patch + smoothstep(0.2, 0.5, hf) * 0.35;
		base = 1.0 - (1.0 - base) * (1.0 - streak * vec3(0.9, 0.96, 1.0));

		/* 照明は控えめ (エネルギー体なので陰は浅い)。鏡面は揺らぎを弱めた法線で小さく (ローブが割れない) */
		vec3 nn = normalize(n + vec3(f1, f2, 0.0) * 0.14);
		vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
		float diff = 0.85 + 0.15 * max(dot(nn, L), 0.0);
		col = mix(C_EDGE * 0.8, base, diff);

		/* 球面の縁光・外周の締め・鏡面は円を意識させるので使わない。外側の深さは band と密度で出す */
		/* 核: 中心ほど白く飛ぶ emission */
		float glow = pow(max(1.0 - d / (R * 0.6), 0.0), 2.6);
		col += mix(C_LIGHT, vec3(1.0), 0.6) * glow * 1.5;
		col = softWhite(col);

		/* fbm の筋が縁を越えて外に漏れる薄い発光 (R〜1.2R)。輪郭を光や気体のように見せる */
		leak = smoothstep(R * 1.35, R * 0.8, d) * (1.0 - cov) * (0.3 * max(fw + 0.25, 0.0) + 0.3 * streak);
		leakC = mix(C_LIGHT, vec3(1.0), 0.4);
	}
	float a = cov + (leak + haloA * (1.0 - leak)) * (1.0 - cov);
	vec3 rgb = col * cov + (leakC * leak + haloC * haloA * (1.0 - leak)) * (1.0 - cov);
	gl_FragColor = vec4(rgb, a);
}
`;

/**
 * 破片: 1 個 = 6 頂点 (三角形 2 枚)。aSeed = (角度, 緯度, 大きさ/位相, 群と位相)、aCorner = 形の隅 [-1, 1]。
 * w < 0.6 は球面から剥がれて渦を巻きながら飛び去る群、それ以外は球面付近の 2 層を公転する群。
 * 大きさは 2〜14px の対数分布 (大きいほど少なく、ゆっくり回る)。噴出は fbm で決まる 2〜3 か所から多く出る
 */
export const SHARD_VS = /* glsl */ `
${COMMON}
${NOISE}
attribute vec4 aSeed;
attribute vec2 aCorner;
uniform vec2 uRes;
uniform float uTime;
varying float vA;
varying vec3 vC;
varying vec2 vCorner;
varying float vSmear;
void main() {
	float R = breathe(uTime);
	float ang = aSeed.x * 2.0 * PI;
	float lat = acos(2.0 * aSeed.y - 1.0); /* 球面に一様に配る */
	float u = fract(aSeed.z * 7.3);
	float size = 0.004 * pow(5.0, pow(u, 1.6)); /* 半幅。2px〜10px (520px 基準) の対数分布 */
	float sizeN = pow(u, 1.6);
	vec3 pos, vel;
	float alpha;
	if (aSeed.w < 0.6) {
		float T = 5.0 + 6.0 * aSeed.z; /* 寿命 5〜11 秒 */
		float life = fract(uTime / T + aSeed.w * 17.0);
		float e = 1.0 - (1.0 - life) * (1.0 - life); /* ease-out: 飛び出して減速 */
		float rr = 1.0 + 0.75 * e; /* 終端 1.75R。光彩の外で単体で浮かない */
		/* 剥がれた球面の公転 (35 秒) を引き継ぎ、外へ行くほど接線方向に 0.7 rad ねじれて渦を巻く */
		float a = ang + uTime * 2.0 * PI / 35.0 + 0.7 * e;
		mat3 tilt = orbitTilt((rr - 1.0) / 0.25);
		pos = tilt * (onSphere(a, lat) * rr * R);
		vec3 radial = tilt * onSphere(a, lat);
		vec3 tangent = tilt * vec3(-sin(lat) * sin(a), 0.0, sin(lat) * cos(a));
		vel = (radial * (1.0 - life) * 1.3 + tangent * 0.35) * (1.0 - 0.5 * life);
		/* 噴出点: 方向と時間の fbm で 2〜3 か所に偏らせる */
		float jet = smoothstep(-0.05, 0.35, fbm(onSphere(ang, lat) * 1.6 + vec3(0.0, uTime * 0.04, 0.0)));
		float flash = 1.0 + 1.2 * smoothstep(0.2, 0.0, life); /* 剥がれる瞬間は明るい */
		alpha = smoothstep(0.0, 0.05, life) * smoothstep(1.0, 0.7, life) * mix(0.35, 1.0, jet) * flash;
	} else {
		float rr = aSeed.z < 0.5 ? 1.0 + 0.1 * fract(aSeed.z * 9.0) : 1.18 + 0.12 * fract(aSeed.z * 9.0);
		float layer = orbitLayer(rr);
		float a = ang + orbitDir(layer) * uTime * 2.0 * PI / orbitPeriod(rr);
		mat3 tilt = orbitTilt(layer);
		pos = tilt * (onSphere(a, lat) * rr * R);
		vel = tilt * vec3(-sin(lat) * sin(a), 0.0, sin(lat) * cos(a)) * 0.3 * orbitDir(layer);
		alpha = 1.0;
	}
	float depth = 0.5 + 0.5 * pos.z / length(pos);
	alpha *= behind(pos, R) * mix(0.45, 1.0, depth); /* 奥行きは色ではなく alpha で表す */
	size *= mix(0.7, 1.15, depth); /* 奥は小さく、手前は大きく */

	vec2 c = project(pos);
	vec2 v2 = vel.xy;
	float sp = length(v2);
	vec2 d2 = sp > 1e-4 ? v2 / sp : vec2(1.0, 0.0);
	float rot = uTime * mix(2.4, 0.5, sizeN) * (aSeed.y < 0.5 ? 1.0 : -1.0) + aSeed.x * 6.0; /* 小さいほど速く自転 */
	vec2 corner = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * aCorner;
	float stretch = 1.0 + 2.5 * sp; /* 進行方向に伸びる */
	/* モーションブラー風: 進行方向の後ろ側の頂点だけをさらに引き伸ばし、そこは薄くする */
	float trailing = max(-corner.x, 0.0) * min(sp * 1.5, 1.0);
	vec2 off = d2 * (corner.x * size * stretch - trailing * size * 2.0) + vec2(-d2.y, d2.x) * corner.y * size;
	gl_Position = vec4((c + off) * min(uRes.x, uRes.y) / uRes, 0.0, 1.0);

	float tone = fract(aSeed.x * 13.0);
	vC = tone < 0.55 ? mix(C_EDGE * 0.8, C_DEEP, fract(aSeed.w * 9.0)) : (tone < 0.85 ? C_MID : mix(C_LIGHT, vec3(1.0), 0.6));
	if (tone < 0.85) vC = mix(vC * 0.8, vC, depth); /* 青い破片だけ奥を少し暗く。白寄りは減光すると灰色の紙に見える */
	/* 自転で面が光を捉える瞬間の白いきらめき */
	float glint = pow(max(sin(rot * 2.0 + aSeed.w * 20.0), 0.0), 24.0);
	vC = mix(vC, vec3(1.0), glint * 0.6);
	vA = alpha;
	vCorner = corner / max(stretch, 1.0); /* 面の明暗は回転後の隅で決めるので、自転で明るい側が回る */
	vSmear = trailing;
}
`;

/** 破片の材質: 縁が明るく中心が濃い「ガラスの欠片」。中心からの距離で明度と alpha を変える */
export const SHARD_FS = /* glsl */ `
precision highp float;
varying float vA;
varying vec3 vC;
varying vec2 vCorner;
varying float vSmear;
void main() {
	float e = max(abs(vCorner.x), abs(vCorner.y)); /* 0 = 中心、1 = 縁 */
	float edge = smoothstep(0.55, 1.0, e);
	/* 面の片側 (左上) が明るく反対側が濃い、厚みのあるガラスの欠片。縁は #9cc4ff 寄りに光る */
	float facet = 0.8 + 0.4 * clamp(0.5 - 0.35 * vCorner.x + 0.35 * vCorner.y, 0.0, 1.0);
	vec3 c = mix(vC * facet, mix(vC, vec3(0.612, 0.769, 1.0), 0.75), edge);
	float a = vA * mix(0.9, 1.0, edge) * (1.0 - 0.5 * vSmear); /* 引き伸ばした後ろ側は薄く */
	gl_FragColor = vec4(c * a, a);
}
`;

/** plexus の線と結節点。aPos = (x, y, alpha) を CPU で毎フレーム作る */
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
precision highp float;
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
 * 浮遊粒子 (GL_POINTS)。aSeed = (角度, 緯度, 半径/位相, 群)。
 * w < 0.75 は球の周囲 1.2〜2.2R を差動回転の層に乗って漂う群 (奥はぼけて大きく薄く、手前は小さく鋭い)、
 * それ以外は球の内部 0.3〜0.9R に薄く散る群。軌跡用の半分解像度のターゲットに描く
 */
export const FLOAT_VS = /* glsl */ `
${COMMON}
attribute vec4 aSeed;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
varying float vA;
varying float vSoft;
varying vec3 vC;
void main() {
	float R = breathe(uTime);
	float ang = aSeed.x * 2.0 * PI;
	float lat = acos(2.0 * aSeed.y - 1.0);
	vec3 pos;
	float alpha, px;
	if (aSeed.w < 0.75) {
		float rr = 1.2 + 1.0 * fract(aSeed.z * 5.1);
		float layer = orbitLayer(rr);
		float a = ang + orbitDir(layer) * uTime * 2.0 * PI / orbitPeriod(rr);
		float wob = 0.05 * sin(uTime * 0.8 + aSeed.z * 40.0); /* ゆっくり漂う */
		pos = orbitTilt(layer) * (onSphere(a, lat + wob) * (rr + wob) * R);
		float depth = 0.5 + 0.5 * pos.z / length(pos);
		float blink = pow(0.5 + 0.5 * sin(uTime * (0.6 + fract(aSeed.w * 7.0) * 1.5) + aSeed.x * 50.0), 8.0); /* ときどき明滅 */
		alpha = mix(0.15, 0.8, depth) * (0.6 + 0.4 * blink) + 0.6 * blink;
		px = mix(4.5, 2.0, depth); /* 奥はぼけて大きく、手前は小さく鋭く */
		vSoft = mix(1.0, 0.3, depth);
		vC = mix(mix(C_LIGHT, vec3(1.0), 0.5), C_SOFT, 1.0 - depth);
	} else {
		float rr = 0.5 + 0.4 * fract(aSeed.z * 5.1); /* 核の白い部分には置かない */
		float a = ang + uTime * 2.0 * PI / mix(20.0, 45.0, rr);
		pos = rotY(0.3) * (onSphere(a, lat) * rr * R);
		float depth = 0.5 + 0.5 * pos.z / (rr * R);
		alpha = 0.2 * depth * step(0.0, pos.z);
		px = 2.2;
		vSoft = 0.5;
		vC = mix(C_LIGHT, vec3(1.0), 0.6);
	}
	alpha *= behind(pos, R);
	gl_Position = vec4(project(pos) * min(uRes.x, uRes.y) / uRes, 0.0, 1.0);
	gl_PointSize = max(2.0, px * uScale);
	vA = alpha;
}
`;

export const FLOAT_FS = /* glsl */ `
precision highp float;
varying float vA;
varying float vSoft;
varying vec3 vC;
void main() {
	vec2 c = gl_PointCoord - 0.5;
	float r2 = dot(c, c) * 4.0;
	float k = exp(-r2 * mix(9.0, 3.0, vSoft)) * (1.0 - smoothstep(0.7, 1.0, r2)) * vA;
	gl_FragColor = vec4(vC * k, k);
}
`;

/** 軌跡: 前のフレームを uGain 倍して写す (減衰合成)。加算の合成にも使う */
export const COPY_FS = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uGain;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(uTex, vUv) * uGain; }
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
precision highp float;
varying float vA;
varying float vSide;
void main() {
	float k = (1.0 - vSide * vSide) * vA * 0.9;
	vec3 c = mix(vec3(0.612, 0.769, 1.0), vec3(1.0), 0.5);
	gl_FragColor = vec4(c * k, k);
}
`;

/** bloom 1/3: 明るい部分の抽出。輝度は alpha を割り戻してから測り (半透明の光彩も拾う)、出力は premultiplied に戻す */
export const BRIGHT_FS = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uThreshold;
varying vec2 vUv;
void main() {
	vec4 c = texture2D(uTex, vUv);
	vec3 straight = c.rgb / max(c.a, 0.004);
	float lum = dot(straight, vec3(0.299, 0.587, 0.114));
	float k = smoothstep(uThreshold, uThreshold + 0.3, lum);
	gl_FragColor = vec4(straight * k * c.a, c.a * k);
}
`;

/** bloom 2/3: 17 タップの分離ガウスぼかし (σ = 3.2 タップ)。uDir にテクセル単位の刻みを入れる */
export const BLUR_FS = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
	vec4 s = texture2D(uTex, vUv) * 0.1256;
	s += (texture2D(uTex, vUv + uDir) + texture2D(uTex, vUv - uDir)) * 0.1196;
	s += (texture2D(uTex, vUv + uDir * 2.0) + texture2D(uTex, vUv - uDir * 2.0)) * 0.1033;
	s += (texture2D(uTex, vUv + uDir * 3.0) + texture2D(uTex, vUv - uDir * 3.0)) * 0.0810;
	s += (texture2D(uTex, vUv + uDir * 4.0) + texture2D(uTex, vUv - uDir * 4.0)) * 0.0575;
	s += (texture2D(uTex, vUv + uDir * 5.0) + texture2D(uTex, vUv - uDir * 5.0)) * 0.0371;
	s += (texture2D(uTex, vUv + uDir * 6.0) + texture2D(uTex, vUv - uDir * 6.0)) * 0.0217;
	s += (texture2D(uTex, vUv + uDir * 7.0) + texture2D(uTex, vUv - uDir * 7.0)) * 0.0115;
	s += (texture2D(uTex, vUv + uDir * 8.0) + texture2D(uTex, vUv - uDir * 8.0)) * 0.0055;
	gl_FragColor = s;
}
`;

/** bloom 3/3: 加算合成。明るい背景でも光が見えるよう alpha を色の最大成分まで引き上げる */
export const COMPOSITE_FS = /* glsl */ `
precision highp float;
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

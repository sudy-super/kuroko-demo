import {
	BLUR_FS,
	BRIGHT_FS,
	COMPOSITE_FS,
	COPY_FS,
	FLOAT_FS,
	FLOAT_VS,
	LINE_FS,
	LINE_VS,
	QUAD_VS,
	R0,
	RING_FS,
	RING_VS,
	SHARD_FS,
	SHARD_VS,
	SPHERE_FS
} from './shader';

export type OrbOptions = { reducedMotion: boolean; mobile: boolean; particles?: boolean };
export type Orb = { start(): void; stop(): void; destroy(): void; resize(): void };

type GL = WebGLRenderingContext;
type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };
/* uniform / attribute の位置はリンク時に引いて持つ。毎フレーム getUniformLocation を呼ぶと同期呼び出しで CPU を食う */
type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null>; a: Record<string, number> };

/** [0, 1) の決定的な乱数列 (mulberry32) */
export function randoms(count: number, seed = 7): Float32Array {
	let s = seed >>> 0;
	const out = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		out[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	return out;
}

/** 破片の頂点。1 個につき 6 頂点 (三角形 2 枚)。形は三角形・四角・細長い欠片の 3 種 */
export function shardGeometry(count: number, seed = 11): { seeds: Float32Array; corners: Float32Array } {
	const r = randoms(count * 5, seed);
	const seeds = new Float32Array(count * 6 * 4);
	const corners = new Float32Array(count * 6 * 2);
	const quad = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
	const tri = [-1, -1, 1, -1, 0, 1, -1, -1, 0, 1, 0, 1];
	const sliver = quad.map((v, i) => (i % 2 ? v * 0.3 : v));
	for (let i = 0; i < count; i++) {
		const k = r[i * 5 + 4];
		const shape = k < 0.4 ? tri : k < 0.75 ? quad : sliver;
		for (let v = 0; v < 6; v++) {
			seeds.set([r[i * 5], r[i * 5 + 1], r[i * 5 + 2], r[i * 5 + 3]], (i * 6 + v) * 4);
			corners.set([shape[v * 2], shape[v * 2 + 1]], (i * 6 + v) * 2);
		}
	}
	return { seeds, corners };
}

/** 球面に均等に散らした単位ベクトル (fibonacci sphere) */
export function fibonacciSphere(count: number): Float32Array {
	const out = new Float32Array(count * 3);
	const golden = Math.PI * (3 - Math.sqrt(5));
	for (let i = 0; i < count; i++) {
		const y = 1 - (2 * (i + 0.5)) / count;
		const rad = Math.sqrt(1 - y * y);
		const a = golden * i;
		out.set([Math.cos(a) * rad, y, Math.sin(a) * rad], i * 3);
	}
	return out;
}

/**
 * plexus: 結節点を球面の層 (差動回転の最内層、周期約 38 秒) で回して投影し、近い組を線で結ぶ。
 * O(n²) だが n ≤ 120 なので毎フレームでよい。戻り値の nodes / lines は (x, y, alpha) の並び。球の裏側は落とす
 */
export type PlexusScratch = { px: Float32Array; py: Float32Array; vis: Float32Array; nodes: Float32Array; lines: Float32Array };
/** plexus が毎フレーム使う配列。閉包側で 1 回確保して使い回す */
export function plexusScratch(n: number): PlexusScratch {
	return { px: new Float32Array(n), py: new Float32Array(n), vis: new Float32Array(n), nodes: new Float32Array(n * 3), lines: new Float32Array(n * 4 * 6) /* 1 点あたり最大 4 本 */ };
}
export function plexus(
	dirs: Float32Array,
	time: number,
	R: number,
	maxDist: number,
	scratch: PlexusScratch = plexusScratch(dirs.length / 3)
): { nodes: Float32Array; lines: Float32Array; lineCount: number } {
	const n = dirs.length / 3;
	const { px, py, vis, nodes, lines } = scratch;
	const period = 35 + 80 * (0.05 / 1.2); /* shader.ts の orbitPeriod(1.05) と同じ */
	const ay = (time * 2 * Math.PI) / period;
	const cy = Math.cos(ay), sy = Math.sin(ay);
	const cz = Math.cos(-0.3), sz = Math.sin(-0.3); /* orbitTilt(0) = rotX(0.35) * rotZ(-0.3) */
	const cx = Math.cos(0.35), sx = Math.sin(0.35);
	for (let i = 0; i < n; i++) {
		const rad = R * (1.05 + 0.03 * Math.sin(time * 0.7 + i));
		let x = dirs[i * 3] * rad, y = dirs[i * 3 + 1] * rad, z = dirs[i * 3 + 2] * rad;
		let t = x * cy + z * sy; z = -x * sy + z * cy; x = t;
		t = x * cz - y * sz; y = x * sz + y * cz; x = t;
		t = y * cx - z * sx; z = y * sx + z * cx; y = t;
		const k = 1 + 0.12 * z;
		px[i] = x * k; py[i] = y * k;
		/* 裏側は滲んだ輪郭 (1.0R〜1.14R) に合わせて柔らかく隠す。shader.ts の behind() と同じ */
		const q = Math.min(Math.max((Math.hypot(x, y) / R - 1.0) / 0.14, 0), 1);
		const shown = z < 0 ? q * q * (3 - 2 * q) : 1;
		vis[i] = shown * (0.35 + 0.65 * (0.5 + 0.5 * z / rad));
		nodes.set([px[i], py[i], vis[i] * 0.9], i * 3);
	}
	let c = 0;
	for (let i = 0; i < n; i++) {
		if (!vis[i]) continue;
		let links = 0;
		for (let j = i + 1; j < n && links < 4; j++) {
			if (!vis[j]) continue;
			const dd = Math.hypot(px[i] - px[j], py[i] - py[j]);
			if (dd > maxDist) continue;
			const a = (0.15 + 0.3 * (1 - dd / maxDist)) * Math.min(vis[i], vis[j]); /* 近いほど明るく 0.15〜0.45 */
			lines.set([px[i], py[i], a, px[j], py[j], a], c * 6);
			c++;
			links++;
		}
	}
	return { nodes, lines, lineCount: c };
}

const REDUCED_TIME = 11.3; /* reduced-motion で描く 1 フレームの時刻 */
const RING_SEGS = 160;
const TRAIL_DECAY = 0.9; /* 軌跡: 前のフレームをこの倍率で残す (60fps で約 10 フレーム分の尾) */

export function createOrb(canvas: HTMLCanvasElement, opts: OrbOptions): Orb | null {
	const attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
	const gl = (canvas.getContext('webgl2', attrs) ?? canvas.getContext('webgl', attrs)) as GL | null;
	if (!gl) return null;

	const dpr = Math.min(devicePixelRatio || 1, 2);
	const particles = opts.particles !== false;
	const shardCount = !particles ? 0 : opts.mobile ? 300 : 700;
	const floatCount = !particles ? 0 : opts.mobile ? 150 : 270; /* 75% が周囲、25% が内部 */
	const nodeCount = !particles ? 0 : opts.mobile ? 80 : 120;
	const blurRadius = opts.mobile ? 18 : 32; /* 表示 px。bloom は半分の解像度で処理する */
	const shards = shardGeometry(shardCount);
	const floatSeeds = randoms(floatCount * 4, 23);
	const nodeDirs = fibonacciSphere(nodeCount);
	const scratch = plexusScratch(nodeCount);
	const ringVerts = new Float32Array((RING_SEGS + 1) * 4);
	for (let i = 0; i <= RING_SEGS; i++) ringVerts.set([i / RING_SEGS, -1, i / RING_SEGS, 1], i * 4);

	let sphere: Prog, shard: Prog, line: Prog, float_: Prog, ring: Prog, copy: Prog;
	let bright: Prog, blur: Prog, composite: Prog;
	let quad: WebGLBuffer, seedBuf: WebGLBuffer, cornerBuf: WebGLBuffer, floatBuf: WebGLBuffer, ringBuf: WebGLBuffer;
	let lineBuf: WebGLBuffer, nodeBuf: WebGLBuffer;
	let scene: Target | null = null, halfA: Target | null = null, halfB: Target | null = null;
	let trailA: Target | null = null, trailB: Target | null = null;

	const compile = (type: number, src: string) => {
		const sh = gl.createShader(type)!;
		gl.shaderSource(sh, src);
		gl.compileShader(sh);
		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost())
			throw new Error(`orb shader: ${gl.getShaderInfoLog(sh)}`);
		return sh;
	};
	const program = (vs: string, fs: string): Prog => {
		const p = gl.createProgram()!;
		gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
		gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
		gl.linkProgram(p);
		if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost())
			throw new Error(`orb program: ${gl.getProgramInfoLog(p)}`);
		const u: Prog['u'] = {}, a: Prog['a'] = {};
		for (let i = 0; i < (gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) ?? 0); i++) {
			const name = gl.getActiveUniform(p, i)!.name;
			u[name] = gl.getUniformLocation(p, name);
		}
		for (let i = 0; i < (gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES) ?? 0); i++) {
			const name = gl.getActiveAttrib(p, i)!.name;
			a[name] = gl.getAttribLocation(p, name);
		}
		return { p, u, a };
	};
	const buffer = (data: Float32Array, usage: number = gl.STATIC_DRAW) => {
		const b = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, b);
		gl.bufferData(gl.ARRAY_BUFFER, data, usage);
		return b;
	};
	const attrib = (p: Prog, name: string, b: WebGLBuffer, size: number) => {
		const loc = p.a[name];
		gl.bindBuffer(gl.ARRAY_BUFFER, b);
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
		return loc;
	};
	const target = (w: number, h: number): Target => {
		const tex = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const fb = gl.createFramebuffer()!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) throw new Error(`orb framebuffer: ${status}`);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		return { fb, tex, w, h };
	};
	const dropTarget = (t: Target | null) => {
		if (!t) return;
		gl.deleteFramebuffer(t.fb);
		gl.deleteTexture(t.tex);
	};

	const initGl = () => {
		sphere = program(QUAD_VS, SPHERE_FS);
		shard = program(SHARD_VS, SHARD_FS);
		line = program(LINE_VS, LINE_FS);
		float_ = program(FLOAT_VS, FLOAT_FS);
		ring = program(RING_VS, RING_FS);
		copy = program(QUAD_VS, COPY_FS);
		bright = program(QUAD_VS, BRIGHT_FS);
		blur = program(QUAD_VS, BLUR_FS);
		composite = program(QUAD_VS, COMPOSITE_FS);
		quad = buffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
		seedBuf = buffer(shards.seeds);
		cornerBuf = buffer(shards.corners);
		floatBuf = buffer(floatSeeds);
		ringBuf = buffer(ringVerts);
		lineBuf = buffer(new Float32Array(0), gl.DYNAMIC_DRAW);
		nodeBuf = buffer(new Float32Array(0), gl.DYNAMIC_DRAW);
		scene = halfA = halfB = trailA = trailB = null;
		allocTargets();
	};
	const allocTargets = () => {
		for (const t of [scene, halfA, halfB, trailA, trailB]) dropTarget(t);
		const w = canvas.width, h = canvas.height;
		if (!w || !h) { scene = halfA = halfB = trailA = trailB = null; return; }
		const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
		scene = target(w, h);
		halfA = target(hw, hh);
		halfB = target(hw, hh);
		if (particles) { /* 粒子が無ければ軌跡のターゲットは要らない */
			trailA = target(hw, hh);
			trailB = target(hw, hh);
		}
	};

	/* 三角形 1 枚で全面を描く */
	const fullscreen = (p: Prog, t: Target | null) => {
		gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
		gl.viewport(0, 0, t ? t.w : canvas.width, t ? t.h : canvas.height);
		gl.useProgram(p.p);
		const loc = attrib(p, 'aPos', quad, 2);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.disableVertexAttribArray(loc);
	};
	const bind = (unit: number, t: Target) => {
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, t.tex);
	};
	const into = (t: Target) => {
		gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
		gl.viewport(0, 0, t.w, t.h);
	};
	const additive = () => { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); };
	const over = () => { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); };

	const draw = (time: number) => {
		if (!scene || !halfA || !halfB) return;
		const w = canvas.width, h = canvas.height;
		const R = R0 * (1 + 0.015 * Math.sin((time * 2 * Math.PI) / 4));
		gl.disable(gl.DEPTH_TEST);
		gl.clearColor(0, 0, 0, 0);

		/* 1. 球と光彩をシーンのフレームバッファに描く */
		gl.disable(gl.BLEND);
		gl.useProgram(sphere.p);
		gl.uniform2f(sphere.u.uRes, w, h);
		gl.uniform1f(sphere.u.uTime, time);
		into(scene);
		gl.clear(gl.COLOR_BUFFER_BIT);
		fullscreen(sphere, scene);

		/* 2. 光の帯 2 本 (加算)、周期違い */
		additive();
		gl.useProgram(ring.p);
		gl.uniform2f(ring.u.uRes, w, h);
		gl.uniform1f(ring.u.uTime, time);
		const ringLoc = attrib(ring, 'aRing', ringBuf, 2);
		gl.uniform3f(ring.u.uCfg, 1.15, 1.18, 1 / 22);
		gl.uniform1f(ring.u.uPhase, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, (RING_SEGS + 1) * 2);
		gl.uniform3f(ring.u.uCfg, -0.75, 1.32, 1 / 34);
		gl.uniform1f(ring.u.uPhase, 2.1);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, (RING_SEGS + 1) * 2);
		gl.disableVertexAttribArray(ringLoc);

		if (particles && trailA && trailB) {
			/* 3. 浮遊粒子を半分解像度の軌跡ターゲットへ。前のフレームを減衰させて写してから加算で重ねる */
			gl.disable(gl.BLEND);
			gl.useProgram(copy.p);
			bind(0, trailA);
			gl.uniform1i(copy.u.uTex, 0);
			gl.uniform1f(copy.u.uGain, opts.reducedMotion ? 0 : TRAIL_DECAY);
			fullscreen(copy, trailB);
			additive();
			into(trailB);
			gl.useProgram(float_.p);
			gl.uniform2f(float_.u.uRes, trailB.w, trailB.h);
			gl.uniform1f(float_.u.uTime, time);
			gl.uniform1f(float_.u.uScale, Math.min(trailB.w, trailB.h) / 260);
			const fl = attrib(float_, 'aSeed', floatBuf, 4);
			gl.drawArrays(gl.POINTS, 0, floatCount);
			gl.disableVertexAttribArray(fl);
			[trailA, trailB] = [trailB, trailA];
			/* 軌跡をシーンへ加算 */
			gl.useProgram(copy.p);
			bind(0, trailA);
			gl.uniform1f(copy.u.uGain, 1);
			fullscreen(copy, scene);

			/* 4. 破片 (通常の重ね合わせ。深い青の破片は光彩の上で暗く見える) */
			over();
			into(scene);
			gl.useProgram(shard.p);
			gl.uniform2f(shard.u.uRes, w, h);
			gl.uniform1f(shard.u.uTime, time);
			const a1 = attrib(shard, 'aSeed', seedBuf, 4);
			const a2 = attrib(shard, 'aCorner', cornerBuf, 2);
			gl.drawArrays(gl.TRIANGLES, 0, shardCount * 6);
			gl.disableVertexAttribArray(a1);
			gl.disableVertexAttribArray(a2);

			/* 5. plexus の線と結節点 (加算) */
			const px = plexus(nodeDirs, time, R, R * 0.42, scratch);
			additive();
			gl.useProgram(line.p);
			gl.uniform2f(line.u.uRes, w, h);
			gl.uniform1f(line.u.uPoint, 0);
			gl.uniform3f(line.u.uColor, 0.612, 0.769, 1);
			gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
			gl.bufferData(gl.ARRAY_BUFFER, px.lines.subarray(0, px.lineCount * 6), gl.DYNAMIC_DRAW);
			let loc = attrib(line, 'aPos', lineBuf, 3);
			gl.drawArrays(gl.LINES, 0, px.lineCount * 2);
			gl.uniform1f(line.u.uPoint, 1);
			gl.uniform1f(line.u.uSize, Math.max(2, (3.5 * Math.min(w, h)) / 520));
			gl.uniform3f(line.u.uColor, 0.85, 0.92, 1);
			gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuf);
			gl.bufferData(gl.ARRAY_BUFFER, px.nodes, gl.DYNAMIC_DRAW);
			loc = attrib(line, 'aPos', nodeBuf, 3);
			gl.drawArrays(gl.POINTS, 0, nodeCount);
			gl.disableVertexAttribArray(loc);
		}
		gl.disable(gl.BLEND);

		/* 6. bloom: 明部抽出 → 横ぼかし → 縦ぼかし (半分の解像度) */
		gl.useProgram(bright.p);
		bind(0, scene);
		gl.uniform1i(bright.u.uTex, 0);
		gl.uniform1f(bright.u.uThreshold, 0.45);
		fullscreen(bright, halfA);

		const step = (blurRadius * dpr) / 2 / 8; /* 半分解像度のテクセルで 8 タップ分に収める */
		gl.useProgram(blur.p);
		gl.uniform1i(blur.u.uTex, 0);
		bind(0, halfA);
		gl.uniform2f(blur.u.uDir, step / halfA.w, 0);
		fullscreen(blur, halfB);
		bind(0, halfB);
		gl.uniform2f(blur.u.uDir, 0, step / halfB.h);
		fullscreen(blur, halfA);

		/* 7. シーン + bloom を画面へ */
		gl.useProgram(composite.p);
		bind(0, scene);
		bind(1, halfA);
		gl.uniform1i(composite.u.uScene, 0);
		gl.uniform1i(composite.u.uBloom, 1);
		gl.uniform1f(composite.u.uStrength, 1.15);
		fullscreen(composite, null);
	};

	let raf = 0;
	let running = false;
	let onScreen = true;
	let lost = false;
	let t0 = performance.now();
	const tick = (now: number) => {
		raf = 0;
		if (!running || !onScreen || document.hidden || lost) return;
		draw((now - t0) / 1000);
		raf = requestAnimationFrame(tick);
	};
	/* 動かせる状態なら rAF を回し、reduced-motion なら固定時刻で 1 枚だけ描く */
	const kick = () => {
		if (lost || !running) return;
		if (opts.reducedMotion) { draw(REDUCED_TIME); return; }
		if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(tick);
	};
	const halt = () => {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	};

	const resize = () => {
		const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
		if (w === canvas.width && h === canvas.height) return;
		canvas.width = w;
		canvas.height = h;
		if (!lost) { allocTargets(); kick(); }
	};

	const onVisibility = () => (document.hidden ? halt() : kick());
	const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; onScreen ? kick() : halt(); });
	const ro = new ResizeObserver(resize);
	const onLost = (e: Event) => { e.preventDefault(); lost = true; halt(); };
	const onRestored = () => { lost = false; initGl(); kick(); };

	initGl();
	canvas.addEventListener('webglcontextlost', onLost);
	canvas.addEventListener('webglcontextrestored', onRestored);
	document.addEventListener('visibilitychange', onVisibility);
	io.observe(canvas);
	ro.observe(canvas);

	return {
		start() { running = true; t0 = performance.now(); resize(); kick(); },
		stop() { running = false; halt(); },
		resize,
		destroy() {
			running = false;
			halt();
			io.disconnect();
			ro.disconnect();
			canvas.removeEventListener('webglcontextlost', onLost);
			canvas.removeEventListener('webglcontextrestored', onRestored);
			document.removeEventListener('visibilitychange', onVisibility);
			for (const t of [scene, halfA, halfB, trailA, trailB]) dropTarget(t);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
		}
	};
}

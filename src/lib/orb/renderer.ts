import {
	BLUR_FS,
	BRIGHT_FS,
	COMPOSITE_FS,
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

/** 破片の頂点。1 個につき 6 頂点 (三角形 2 枚)。半分は 1 隅を潰して三角形にする */
export function shardGeometry(count: number, seed = 11): { seeds: Float32Array; corners: Float32Array } {
	const r = randoms(count * 5, seed);
	const seeds = new Float32Array(count * 6 * 4);
	const corners = new Float32Array(count * 6 * 2);
	const quad = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
	const tri = [-1, -1, 1, -1, 0, 1, -1, -1, 0, 1, 0, 1];
	for (let i = 0; i < count; i++) {
		const shape = r[i * 5 + 4] < 0.5 ? tri : quad;
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
 * plexus: 結節点を回して画面に投影し、近い組を線で結ぶ。O(n²) だが n ≤ 120 なので毎フレームでよい。
 * 戻り値の nodes / lines は (x, y, alpha) の並び。球の裏側は落とす
 */
export function plexus(
	dirs: Float32Array,
	time: number,
	R: number,
	maxDist: number
): { nodes: Float32Array; lines: Float32Array; lineCount: number } {
	const n = dirs.length / 3;
	const ay = (time * 2 * Math.PI) / 65; /* 公転 65 秒 */
	const cy = Math.cos(ay), sy = Math.sin(ay);
	const tilt = 0.4;
	const cx = Math.cos(tilt), sx = Math.sin(tilt);
	const px = new Float32Array(n), py = new Float32Array(n), vis = new Float32Array(n);
	const nodes = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const rad = R * (1.05 + 0.03 * Math.sin(time * 0.7 + i));
		let x = dirs[i * 3] * rad, y = dirs[i * 3 + 1] * rad, z = dirs[i * 3 + 2] * rad;
		/* rotY してから rotX で傾ける */
		const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
		x = x1; z = z1;
		const y1 = y * cx - z * sx, z2 = y * sx + z * cx;
		y = y1; z = z2;
		const k = 1 + 0.12 * z;
		px[i] = x * k; py[i] = y * k;
		const behind = z < 0 && Math.hypot(x, y) < R * 0.98;
		vis[i] = behind ? 0 : 0.35 + 0.65 * (0.5 + 0.5 * z / rad);
		nodes.set([px[i], py[i], vis[i] * 0.9], i * 3);
	}
	const lines = new Float32Array(n * 4 * 6); /* 1 点あたり最大 4 本 */
	let c = 0;
	for (let i = 0; i < n; i++) {
		if (!vis[i]) continue;
		let links = 0;
		for (let j = i + 1; j < n && links < 4; j++) {
			if (!vis[j]) continue;
			const dd = Math.hypot(px[i] - px[j], py[i] - py[j]);
			if (dd > maxDist) continue;
			const a = 0.4 * (1 - dd / maxDist) * Math.min(vis[i], vis[j]);
			lines.set([px[i], py[i], a, px[j], py[j], a], c * 6);
			c++;
			links++;
		}
	}
	return { nodes, lines, lineCount: c };
}

const REDUCED_TIME = 11.3; /* reduced-motion で描く 1 フレームの時刻 */
const RING_SEGS = 160;

export function createOrb(canvas: HTMLCanvasElement, opts: OrbOptions): Orb | null {
	const attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
	const gl = (canvas.getContext('webgl2', attrs) ?? canvas.getContext('webgl', attrs)) as GL | null;
	if (!gl) return null;

	const dpr = Math.min(devicePixelRatio || 1, 2);
	const particles = opts.particles !== false;
	const shardCount = !particles ? 0 : opts.mobile ? 250 : 500;
	const nodeCount = !particles ? 0 : opts.mobile ? 80 : 120;
	const blurRadius = opts.mobile ? 18 : 32; /* 表示 px。bloom は半分の解像度で処理する */
	const shards = shardGeometry(shardCount);
	const nodeDirs = fibonacciSphere(nodeCount);
	const ringVerts = new Float32Array((RING_SEGS + 1) * 4);
	for (let i = 0; i <= RING_SEGS; i++) ringVerts.set([i / RING_SEGS, -1, i / RING_SEGS, 1], i * 4);

	let sphere: Prog, shard: Prog, line: Prog, ring: Prog, bright: Prog, blur: Prog, composite: Prog;
	let quad: WebGLBuffer, seedBuf: WebGLBuffer, cornerBuf: WebGLBuffer, ringBuf: WebGLBuffer;
	let lineBuf: WebGLBuffer, nodeBuf: WebGLBuffer;
	let scene: Target | null = null, halfA: Target | null = null, halfB: Target | null = null;

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
		ring = program(RING_VS, RING_FS);
		bright = program(QUAD_VS, BRIGHT_FS);
		blur = program(QUAD_VS, BLUR_FS);
		composite = program(QUAD_VS, COMPOSITE_FS);
		quad = buffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
		seedBuf = buffer(shards.seeds);
		cornerBuf = buffer(shards.corners);
		ringBuf = buffer(ringVerts);
		lineBuf = buffer(new Float32Array(0), gl.DYNAMIC_DRAW);
		nodeBuf = buffer(new Float32Array(0), gl.DYNAMIC_DRAW);
		scene = halfA = halfB = null;
		allocTargets();
	};
	const allocTargets = () => {
		dropTarget(scene); dropTarget(halfA); dropTarget(halfB);
		const w = canvas.width, h = canvas.height;
		if (!w || !h) { scene = halfA = halfB = null; return; }
		scene = target(w, h);
		halfA = target(Math.ceil(w / 2), Math.ceil(h / 2));
		halfB = target(Math.ceil(w / 2), Math.ceil(h / 2));
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
		gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
		gl.clear(gl.COLOR_BUFFER_BIT);
		fullscreen(sphere, scene);

		/* 2. 光の帯 2 本 (加算) */
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

		if (particles) {
			/* 3. 破片 (通常の重ね合わせ。深い青の破片は光彩の上で暗く見える) */
			over();
			gl.useProgram(shard.p);
			gl.uniform2f(shard.u.uRes, w, h);
			gl.uniform1f(shard.u.uTime, time);
			const a1 = attrib(shard, 'aSeed', seedBuf, 4);
			const a2 = attrib(shard, 'aCorner', cornerBuf, 2);
			gl.drawArrays(gl.TRIANGLES, 0, shardCount * 6);
			gl.disableVertexAttribArray(a1);
			gl.disableVertexAttribArray(a2);

			/* 4. plexus の線と結節点 (加算) */
			const px = plexus(nodeDirs, time, R, R * 0.42);
			additive();
			gl.useProgram(line.p);
			gl.uniform2f(line.u.uRes, w, h);
			gl.uniform1f(line.u.uPoint, 0);
			gl.uniform3f(line.u.uColor, 0.75, 0.86, 1);
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

		/* 5. bloom: 明部抽出 → 横ぼかし → 縦ぼかし (半分の解像度) */
		gl.useProgram(bright.p);
		bind(0, scene);
		gl.uniform1i(bright.u.uTex, 0);
		gl.uniform1f(bright.u.uThreshold, 0.45);
		fullscreen(bright, halfA);

		const step = (blurRadius * dpr) / 2 / 6; /* 半分解像度のテクセルで 6 タップ分に収める */
		gl.useProgram(blur.p);
		gl.uniform1i(blur.u.uTex, 0);
		bind(0, halfA);
		gl.uniform2f(blur.u.uDir, step / halfA.w, 0);
		fullscreen(blur, halfB);
		bind(0, halfB);
		gl.uniform2f(blur.u.uDir, 0, step / halfB.h);
		fullscreen(blur, halfA);

		/* 6. シーン + bloom を画面へ */
		gl.useProgram(composite.p);
		bind(0, scene);
		bind(1, halfA);
		gl.uniform1i(composite.u.uScene, 0);
		gl.uniform1i(composite.u.uBloom, 1);
		gl.uniform1f(composite.u.uStrength, 1.3);
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
			dropTarget(scene); dropTarget(halfA); dropTarget(halfB);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
		}
	};
}

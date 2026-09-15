import {
	BLUR_FS,
	BRIGHT_FS,
	COMPOSITE_FS,
	PARTICLE_FS,
	PARTICLE_VS,
	QUAD_VS,
	SPHERE_FS
} from './shader';

export type OrbOptions = { reducedMotion: boolean; mobile: boolean; particles?: boolean };
export type Orb = { start(): void; stop(): void; destroy(): void; resize(): void };

type GL = WebGLRenderingContext;
type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

/** 粒子の種 (4 要素 x count)。mulberry32 で決定的に作る */
export function particleSeeds(count: number, seed = 7): Float32Array {
	let s = seed >>> 0;
	const out = new Float32Array(count * 4);
	for (let i = 0; i < out.length; i++) {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		out[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	return out;
}

const REDUCED_TIME = 11.3; /* reduced-motion で描く 1 フレームの時刻 */

export function createOrb(canvas: HTMLCanvasElement, opts: OrbOptions): Orb | null {
	const attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
	const gl = (canvas.getContext('webgl2', attrs) ?? canvas.getContext('webgl', attrs)) as GL | null;
	if (!gl) return null;

	const dpr = Math.min(devicePixelRatio || 1, 2);
	const particleCount = opts.particles === false ? 0 : opts.mobile ? 150 : 320;
	const blurRadius = opts.mobile ? 14 : 24; /* 表示 px。bloom は半分の解像度で処理する */
	const seeds = particleSeeds(particleCount);

	let sphere: WebGLProgram, particle: WebGLProgram, bright: WebGLProgram, blur: WebGLProgram, composite: WebGLProgram;
	let quad: WebGLBuffer, seedBuf: WebGLBuffer;
	let scene: Target | null = null, halfA: Target | null = null, halfB: Target | null = null;

	const compile = (type: number, src: string) => {
		const sh = gl.createShader(type)!;
		gl.shaderSource(sh, src);
		gl.compileShader(sh);
		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost())
			throw new Error(`orb shader: ${gl.getShaderInfoLog(sh)}`);
		return sh;
	};
	const program = (vs: string, fs: string) => {
		const p = gl.createProgram()!;
		gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
		gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
		gl.linkProgram(p);
		if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost())
			throw new Error(`orb program: ${gl.getProgramInfoLog(p)}`);
		return p;
	};
	const u = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name);
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
		particle = program(PARTICLE_VS, PARTICLE_FS);
		bright = program(QUAD_VS, BRIGHT_FS);
		blur = program(QUAD_VS, BLUR_FS);
		composite = program(QUAD_VS, COMPOSITE_FS);
		quad = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		seedBuf = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
		gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
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
	const fullscreen = (p: WebGLProgram, t: Target | null) => {
		gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
		gl.viewport(0, 0, t ? t.w : canvas.width, t ? t.h : canvas.height);
		gl.useProgram(p);
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);
		const loc = gl.getAttribLocation(p, 'aPos');
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.disableVertexAttribArray(loc);
	};
	const bind = (unit: number, t: Target) => {
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, t.tex);
	};

	const draw = (time: number) => {
		if (!scene || !halfA || !halfB) return;
		const w = canvas.width, h = canvas.height;
		gl.disable(gl.DEPTH_TEST);
		gl.clearColor(0, 0, 0, 0);

		/* 1. 球とハローをシーンのフレームバッファに描く */
		gl.disable(gl.BLEND);
		gl.useProgram(sphere);
		gl.uniform2f(u(sphere, 'uRes'), w, h);
		gl.uniform1f(u(sphere, 'uTime'), time);
		gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
		gl.clear(gl.COLOR_BUFFER_BIT);
		fullscreen(sphere, scene);

		/* 2. 粒子を加算合成で重ねる */
		if (particleCount) {
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.useProgram(particle);
			gl.uniform2f(u(particle, 'uRes'), w, h);
			gl.uniform1f(u(particle, 'uTime'), time);
			gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
			const loc = gl.getAttribLocation(particle, 'aSeed');
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
			gl.drawArrays(gl.POINTS, 0, particleCount);
			gl.disableVertexAttribArray(loc);
			gl.disable(gl.BLEND);
		}

		/* 3. bloom: 明部抽出 → 横ぼかし → 縦ぼかし (半分の解像度) */
		gl.useProgram(bright);
		bind(0, scene);
		gl.uniform1i(u(bright, 'uTex'), 0);
		gl.uniform1f(u(bright, 'uThreshold'), 0.6);
		fullscreen(bright, halfA);

		const step = (blurRadius * dpr) / 2 / 6; /* 半分解像度のテクセルで 6 タップ分に収める */
		gl.useProgram(blur);
		gl.uniform1i(u(blur, 'uTex'), 0);
		bind(0, halfA);
		gl.uniform2f(u(blur, 'uDir'), step / halfA.w, 0);
		fullscreen(blur, halfB);
		bind(0, halfB);
		gl.uniform2f(u(blur, 'uDir'), 0, step / halfB.h);
		fullscreen(blur, halfA);

		/* 4. シーン + bloom を画面へ */
		gl.useProgram(composite);
		bind(0, scene);
		bind(1, halfA);
		gl.uniform1i(u(composite, 'uScene'), 0);
		gl.uniform1i(u(composite, 'uBloom'), 1);
		gl.uniform1f(u(composite, 'uStrength'), 1.0);
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

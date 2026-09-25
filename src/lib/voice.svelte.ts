/* 音声の依頼の聞き取り。全画面の覆い (VoiceOverlay.svelte) と Today のその場の聞き取り
   (today/+page.svelte と KurokoBar.svelte) が同じ 1 つを使う (docs/research/voice-orb.md) */
import { ui, request } from './ui.svelte';

/** 音声を受け取れない環境で流す例文と 1 文字あたりの間隔 */
const DEMO_TEXT = '明日の商談の準備、あとで見られるようにしておいて';
const DEMO_MS = 60;

/* マイクが無い・許可されないときの誤り。これらは疑似再生に切り替える。
   'no-speech' (黙っていた) は含めない。話していないのに例文が出てしまう */
const NO_INPUT = ['not-allowed', 'service-not-allowed', 'audio-capture', 'network'];

type Recognizer = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	onresult: ((e: { results: Iterable<ArrayLike<{ transcript: string }>> }) => void) | null;
	onend: (() => void) | null;
	onsoundstart: (() => void) | null;
	onsoundend: (() => void) | null;
	onerror: ((e: { error: string }) => void) | null;
	start: () => void;
	stop: () => void;
};

/** 送ってから /chat へ移るまで「考えています」を見せる長さ */
const THINK_MS = 400;

class Hearing {
	heard = $state('');
	live = $state(false);
	/** 送った直後。Today は「考えています」を 1 拍見せてから会話の画面へ移る */
	thinking = $state(false);
	/** 聞いている間の声の大きさ (0〜1、平滑化済み)。Today のオーブと VoiceActions の波形が共有する */
	level = $state(0);
	#stop: (() => void) | null = null;
	#stopLevel: (() => void) | null = null;
	/** 聞き取りの側が「音が入っている」と知らせている間 (onsoundstart 〜 onsoundend) */
	#sound = false;

	/* 実物が無ければ疑似再生に落とす (この画面の代替の入力)。どちらの道でも heard に文字が積まれる */
	start() {
		this.stop();
		this.heard = '';
		this.live = true;
		this.thinking = false;
		const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => Recognizer })
			.webkitSpeechRecognition;
		this.#stop = Ctor ? this.#recognize(Ctor) : this.#playDemo();
		this.#stopLevel = this.#meterLevel();
	}

	/** 閉じたら必ず止める (マイクを握ったままにしない) */
	stop() {
		this.#stop?.();
		this.#stop = null;
		this.#stopLevel?.();
		this.#stopLevel = null;
		this.live = false;
		this.level = 0;
	}

	send() {
		const q = this.heard.trim();
		this.stop();
		this.thinking = true;
		setTimeout(() => {
			ui.voice = false;
			request('/chat', q ? { kind: 'ask', q } : undefined);
		}, THINK_MS);
	}

	#playDemo() {
		let i = 0;
		const t = setInterval(() => {
			this.heard = DEMO_TEXT.slice(0, ++i);
			if (i >= DEMO_TEXT.length) {
				clearInterval(t);
				this.live = false;
			}
		}, DEMO_MS);
		return () => clearInterval(t);
	}

	#recognize(Ctor: new () => Recognizer) {
		const rec = new Ctor();
		rec.lang = 'ja-JP';
		/* continuous の既定 (false) は最終結果 1 つで終わり、言葉の短い間でも止まる (Web Speech API の仕様は
		   口述の例に true を挙げる)。止めるのは利用者が「止める」か「閉じる」を押したときだけ */
		rec.continuous = true;
		rec.interimResults = true;
		/* continuous でも Chrome は数秒黙ると切る (web-speech-api issue 99) ので聞き直し、文字を後ろに足す。
		   onend の中ですぐ start() を呼ぶと InvalidStateError になることがあるので、少し待ち、失敗しても待ち直す */
		let kept = '';
		let wanted = true;
		let retry: ReturnType<typeof setTimeout> | undefined;
		const restart = () => {
			if (!wanted) return;
			try {
				rec.start();
			} catch {
				retry = setTimeout(restart, 250);
			}
		};
		rec.onresult = (e) => {
			this.heard = kept + [...e.results].map((r) => r[0].transcript).join('');
		};
		rec.onend = () => {
			kept = this.heard;
			retry = setTimeout(restart, 150);
		};
		/* 声の大きさは、マイクを別に開かず (取り合いになる、下の #meterLevel)、聞き取りの側が
		   知らせる「音が入っている / いない」で脈打たせる */
		rec.onsoundstart = () => (this.#sound = true);
		rec.onsoundend = () => (this.#sound = false);
		// 誤りのあとに onend が来るので、先に外してから疑似再生に切り替える
		rec.onerror = (e) => {
			if (!NO_INPUT.includes(e.error)) return;
			wanted = false;
			rec.onend = rec.onresult = null;
			this.#stop = this.#playDemo();
		};
		rec.start();
		return () => {
			wanted = false;
			clearTimeout(retry);
			rec.onresult = rec.onend = rec.onerror = rec.onsoundstart = rec.onsoundend = null;
			this.#sound = false;
			rec.stop();
		};
	}

	/* 声の大きさ (0〜1) を毎フレーム level へ積む。getUserMedia でマイクを別に開くと聞き取りと取り合い、
	   文字起こしが止まる (Chromium 41083534、voice-orb.md)。聞き取りの「音が入っている」と文字が増えた瞬間で脈打たせる */
	#meterLevel() {
		let last = performance.now();
		let seen = 0;
		let v = 0;
		let raf: number;
		const tick = (now: number) => {
			// 音が入っている間は小さく揺らし、文字が増えた瞬間に大きく上げる
			let target = this.live && this.#sound ? 0.35 + 0.15 * Math.sin(now / 120) : 0;
			if (this.heard.length > seen) v = Math.max(v, 0.8);
			seen = this.heard.length;
			v = smoothLevel(v, target, now - last);
			last = now;
			this.level = v;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}
}

export const hearing = new Hearing();

/* 聞いている間のオーブの大きさ (docs/research/voice-orb.md の「オーブの大きさ」)。
   基準は普段の 1.3 倍、声に合わせて基準の 0.97〜1.08 倍 */
export const ORB_GROW = 1.3;
export const ORB_PULSE_MIN = 0.97;
export const ORB_PULSE_MAX = 1.08;

/* 上がりは速く (60ms)、下がりは遅く (300ms)。dt を使うので画面の更新頻度に左右されない */
export function smoothLevel(v: number, target: number, dt: number) {
	const tau = target > v ? 60 : 300;
	return v + (target - v) * (1 - Math.exp(-dt / tau));
}

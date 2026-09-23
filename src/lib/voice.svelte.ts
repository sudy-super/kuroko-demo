/* 音声の依頼の聞き取り。全画面の覆い (VoiceOverlay.svelte) と Today のその場の聞き取り
   (today/+page.svelte と KurokoBar.svelte) が同じ 1 つを使う (docs/research/voice-orb.md) */
import { goto } from '$app/navigation';
import { ui } from './ui.svelte';

/** 音声を受け取れない環境で流す例文と 1 文字あたりの間隔 (計画 Task 23) */
const DEMO_TEXT = '明日の商談の準備、あとで見られるようにしておいて';
const DEMO_MS = 60;

/* マイクが無い・許可されないときの誤り。これらは疑似再生に切り替える。
   'no-speech' (黙っていた) は含めない。話していないのに例文が出てしまう */
const NO_INPUT = ['not-allowed', 'service-not-allowed', 'audio-capture', 'network'];

type Recognizer = {
	lang: string;
	interimResults: boolean;
	onresult: ((e: { results: Iterable<ArrayLike<{ transcript: string }>> }) => void) | null;
	onend: (() => void) | null;
	onerror: ((e: { error: string }) => void) | null;
	start: () => void;
	stop: () => void;
};

class Hearing {
	heard = $state('');
	live = $state(false);
	/** 送った直後。Today は「考えています」を 1 拍見せてから会話の画面へ移る */
	thinking = $state(false);
	#stop: (() => void) | null = null;

	/* 実物が無ければ疑似再生に落とす。握りつぶしではなく、この画面の代替の入力 (計画 Task 23)。
	   どちらの道でも heard に文字が積まれ、以降の扱いは変わらない */
	start() {
		this.stop();
		this.heard = '';
		this.live = true;
		this.thinking = false;
		const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => Recognizer })
			.webkitSpeechRecognition;
		this.#stop = Ctor ? this.#recognize(Ctor) : this.#playDemo();
	}

	/** 閉じたら必ず止める (マイクを握ったままにしない) */
	stop() {
		this.#stop?.();
		this.#stop = null;
		this.live = false;
	}

	/** delay は「考えています」を見せる長さ。Today のその場の聞き取りだけが 400ms を渡す */
	send(delay = 0) {
		const q = this.heard.trim();
		this.stop();
		this.thinking = true;
		setTimeout(() => {
			ui.voice = false;
			// Palette と同じ道。?q= を受けた /chat 側が送る (Task 22 の申し送り)
			goto(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat');
		}, delay);
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
		rec.interimResults = true;
		rec.onresult = (e) => {
			this.heard = [...e.results].map((r) => r[0].transcript).join('');
		};
		rec.onend = () => (this.live = false);
		// 誤りのあとに onend が来るので、先に外してから疑似再生に切り替える
		rec.onerror = (e) => {
			if (!NO_INPUT.includes(e.error)) return;
			rec.onend = rec.onresult = null;
			this.#stop = this.#playDemo();
		};
		rec.start();
		return () => {
			rec.onresult = rec.onend = rec.onerror = null;
			rec.stop();
		};
	}
}

export const hearing = new Hearing();

/* 聞いている間のオーブの大きさ (docs/research/voice-orb.md の「オーブの大きさ」)。
   基準は普段の 1.3 倍、声に合わせて基準の 0.97〜1.08 倍 */
export const ORB_GROW = 1.3;
export const ORB_PULSE_MIN = 0.97;
export const ORB_PULSE_MAX = 1.08;

/* 声の大きさを 0〜1 に直す範囲 (dBFS)。部屋の雑音とマイクで変わるので、会場で合わせる値
   (一次資料の値ではない。docs/research/voice-orb.md) */
const LEVEL_FLOOR_DB = -50;
const LEVEL_CEIL_DB = -15;

/* 上がりは速く (60ms)、下がりは遅く (300ms)。dt を使うので画面の更新頻度に左右されない */
export function smoothLevel(v: number, target: number, dt: number) {
	const tau = target > v ? 60 : 300;
	return v + (target - v) * (1 - Math.exp(-dt / tau));
}

export type Meter = { read: () => number; close: () => void };

/** マイクの声の大きさ (0〜1) を読む。許可が無い・取れないときは null
    (呼び元は聞き取りの文字が増えるたびに脈打つ形に切り替える) */
export async function openMeter(): Promise<Meter | null> {
	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch {
		return null;
	}
	const ctx = new AudioContext();
	const analyser = ctx.createAnalyser();
	analyser.fftSize = 1024;
	ctx.createMediaStreamSource(stream).connect(analyser);
	const buf = new Float32Array(analyser.fftSize);
	return {
		read() {
			analyser.getFloatTimeDomainData(buf);
			let sum = 0;
			for (const s of buf) sum += s * s;
			const db = 20 * Math.log10(Math.sqrt(sum / buf.length));
			return Math.min(1, Math.max(0, (db - LEVEL_FLOOR_DB) / (LEVEL_CEIL_DB - LEVEL_FLOOR_DB)));
		},
		close() {
			stream.getTracks().forEach((t) => t.stop());
			ctx.close();
		}
	};
}

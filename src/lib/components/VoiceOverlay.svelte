<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { ui, markOverlay } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import Orb from './Orb.svelte';

	/** 音声を受け取れない環境で流す例文と 1 文字あたりの間隔 (計画 Task 23) */
	const DEMO_TEXT = '明日の商談の準備、あとで見られるようにしておいて';
	const DEMO_MS = 60;

	type Recognizer = {
		lang: string;
		interimResults: boolean;
		onresult: ((e: { results: Iterable<ArrayLike<{ transcript: string }>> }) => void) | null;
		start: () => void;
		stop: () => void;
	};

	let heard = $state('');
	let live = $state(false);
	// 「やり直す」で聞き直す。下の $effect を張り直すための世代番号
	let round = $state(0);

	/* 実物が無ければ疑似再生に落とす。握りつぶしではなく、この画面の代替の入力 (計画 Task 23)。
	   どちらの道でも heard に文字が積まれ、以降の扱いは変わらない */
	function listen() {
		heard = '';
		live = true;
		const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => Recognizer })
			.webkitSpeechRecognition;
		if (!Ctor) {
			let i = 0;
			const t = setInterval(() => {
				heard = DEMO_TEXT.slice(0, ++i);
				if (i >= DEMO_TEXT.length) {
					clearInterval(t);
					live = false;
				}
			}, DEMO_MS);
			return () => clearInterval(t);
		}
		const rec = new Ctor();
		rec.lang = 'ja-JP';
		rec.interimResults = true;
		rec.onresult = (e) => {
			heard = [...e.results].map((r) => r[0].transcript).join('');
		};
		rec.start();
		return () => {
			rec.onresult = null;
			rec.stop();
		};
	}

	// 開いている間だけ聞く。閉じたら必ず止める (マイクを握ったままにしない)
	$effect(() => {
		if (!ui.voice) return;
		round;
		const stop = listen();
		return () => {
			stop();
			live = false;
		};
	});

	// Modal / Drawer と同じ。覆いが出ている間はカードのガラスを不透明に倒す
	$effect(() => {
		if (!ui.voice) return;
		markOverlay(true);
		return () => markOverlay(false);
	});

	function send() {
		const q = heard.trim();
		ui.voice = false;
		// Palette と同じ道。?q= を受けた /chat 側が送る (Task 22 の申し送り)
		goto(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat');
	}
</script>

<!-- 焦点の閉じ込めと Esc は Dialog に任せる (Modal.svelte と同じ) -->
<Dialog.Root
	open={ui.voice}
	onOpenChange={(v) => {
		if (!v) ui.voice = false;
	}}
>
	<Dialog.Portal>
		<!-- 全画面を占めるので scrim (覆いの暗さ) は敷かない。文字はこの面の地の上に載る -->
		<Dialog.Content class="voice">
			<Dialog.Title class="sr-only">音声で依頼</Dialog.Title>
			<!-- chat.md 観点 3.4 — オーブが聞き取り中の指標を兼ねるので、他に目を引く
			     進行の表示を重ねない。下の波形は入力が届いていることだけを示す -->
			<div class="orb-slot voice-orb" aria-hidden="true"><Orb size={280} sparks={false} /></div>
			<!-- chat.md 観点 3.1 / 3.3 — 曖昧な語を避け、焦点を受け取らない待ちの知らせは
			     role="status" で伝える (WCAG 2.2 達成基準 4.1.3) -->
			<p class="voice-state" role="status">{live ? '聞いています…' : '聞き取りました'}</p>
			<div class="voice-wave" class:on={live} aria-hidden="true">
				{#each [0, 1, 2, 3, 4] as i (i)}<span style="--n: {i}"></span>{/each}
			</div>
			<p class="voice-heard">{heard}</p>
			<!-- 仕様 5.14 — 実行の前に必ず確認するという約束をこの画面でも出す -->
			<p class="voice-note">送信・予約・請求は、実行の前に確認します</p>
			<div class="row voice-acts">
				<button class="btn pri" onclick={send} disabled={!heard.trim()}>
					<Icon name="ic-send" size={20} />KUROKO に送る
				</button>
				<button class="btn sec" onclick={() => round++}>やり直す</button>
				<button class="btn text" onclick={() => (ui.voice = false)}>閉じる</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

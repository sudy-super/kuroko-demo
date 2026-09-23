<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { ui, markOverlay } from '$lib/ui.svelte';
	import { hearing } from '$lib/voice.svelte';
	import Icon from './Icon.svelte';
	import Orb from './Orb.svelte';

	/* Today の環状配置では、全画面の覆いを出さずその場で聞く (today/+page.svelte)。
	   この覆いはそれ以外の画面と幅のためのもの */
	const open = $derived(ui.voice && !ui.voiceHere);

	// 開いている間だけ聞く。閉じたら必ず止める (マイクを握ったままにしない)
	$effect(() => {
		if (!open) return;
		hearing.start();
		return () => hearing.stop();
	});

	// Modal / Drawer と同じ。覆いが出ている間はカードのガラスを不透明に倒す
	$effect(() => {
		if (!open) return;
		markOverlay(true);
		return () => markOverlay(false);
	});
</script>

<!-- 焦点の閉じ込めと Esc は Dialog に任せる (Modal.svelte と同じ) -->
<Dialog.Root
	{open}
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
			<p class="voice-state" role="status">{hearing.live ? '聞いています…' : '聞き取りました'}</p>
			<div class="voice-wave" class:on={hearing.live} aria-hidden="true">
				{#each [0, 1, 2, 3, 4] as i (i)}<span style="--n: {i}"></span>{/each}
			</div>
			<p class="voice-heard">{hearing.heard}</p>
			<!-- 仕様 5.14 — 実行の前に必ず確認するという約束をこの画面でも出す -->
			<p class="voice-note">送信・予約・請求は、実行の前に確認します</p>
			<div class="row voice-acts">
				<button class="btn pri" onclick={() => hearing.send()} disabled={!hearing.heard.trim()}>
					<Icon name="ic-send" size={20} />KUROKO に送る
				</button>
				<button class="btn sec" onclick={() => hearing.start()}>やり直す</button>
				<button class="btn text" onclick={() => (ui.voice = false)}>閉じる</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

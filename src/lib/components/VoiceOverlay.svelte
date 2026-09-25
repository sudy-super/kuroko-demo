<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { ui, markOverlay } from '$lib/ui.svelte';
	import { hearing } from '$lib/voice.svelte';
	import Orb from './Orb.svelte';
	import VoiceActions from './VoiceActions.svelte';

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
			<!-- オーブが聞き取り中の指標を兼ねるので、他に目を引く進行の表示を重ねない (chat.md 観点 3.4) -->
			<div class="orb-slot voice-orb" aria-hidden="true"><Orb size={280} sparks={false} /></div>
			<!-- 待ちの知らせは role="status" で読み上げだけに伝える (WCAG 4.1.3) -->
			<p class="voice-state sr-only" role="status">{hearing.live ? '聞いています…' : '聞き取りました'}</p>
			<p class="voice-heard">{hearing.heard}</p>
			<!-- 依頼バーと同じガラスのピルに入れる -->
			<div class="voice-acts-wrap">
				<VoiceActions />
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

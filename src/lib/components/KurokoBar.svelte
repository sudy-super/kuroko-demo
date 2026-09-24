<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { ui, type ContextChip } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import { barGlass } from '$lib/glass';
	import VoiceActions from './VoiceActions.svelte';

	let { context = null }: { context?: ContextChip | null } = $props();

	let text = $state('');
	let mic: HTMLButtonElement | undefined = $state();
	let acts: HTMLDivElement | undefined = $state();

	/* Today の環状配置では、音声の操作をこのバーの位置に代わりに出す (docs/research/voice-orb.md の
	   「操作の置き場所」)。出したら操作へ、閉じたらマイクのボタンへ焦点を移す */
	const voicing = $derived(ui.voice && ui.voiceHere);
	$effect(() => {
		if (!voicing) return;
		// 聞き取る前は「KUROKO に送る」が押せないので、押せる最初の操作へ
		acts?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
		// マイクのボタンは閉じたあとに作り直されるので、描き終わりを待ってから移す
		return () => tick().then(() => mic?.focus());
	});

	function send() {
		const q = text.trim();
		if (!q) return;
		let url = `/chat?q=${encodeURIComponent(q)}`;
		if (context?.personId) url += `&person=${context.personId}`;
		if (context?.threadId) url += `&thread=${context.threadId}`;
		if (context?.meetingId) url += `&meeting=${context.meetingId}`;
		text = '';
		goto(url);
	}
</script>

<!-- 依頼バーだけは枠の層に乗せず自分の描画面を持つ (src/lib/glass.ts の barGlass)。
     層に乗せた面どうしは互いを映せず、層に乗せるとサイドナビ・上部バー・連携の列が
     このバーの屈折に入らなくなるため (横には重ならないので実際には映る場面はない) -->
<form
	class="chatbar"
	{@attach barGlass}
	onsubmit={(e) => {
		e.preventDefault();
		send();
	}}
>
	{#if voicing}
		<div class="voice-bar" bind:this={acts}>
			<VoiceActions />
		</div>
	{:else if context}
		<button
			type="button"
			class="chip"
			title={context.label}
			aria-label="{context.label}との結び付けを外す"
			onclick={() => (ui.context = null)}
		>
			<span>{context.label}</span>
			<Icon name="ic-x" size={16} />
		</button>
	{/if}
	{#if !voicing}
		<input name="q" bind:value={text} placeholder="KUROKO に話しかける" aria-label="KUROKO への依頼" />
		<button
			type="button"
			class="iconbtn"
			title="音声で依頼"
			aria-label="音声で依頼"
			bind:this={mic}
			onclick={() => (ui.voice = true)}
		>
			<Icon name="ic-mic" size={20} />
		</button>
		<button type="submit" class="send" aria-label="依頼" disabled={!text.trim()}>
			<Icon name="ic-send" size={20} />
		</button>
	{/if}
</form>

<style>
	/* 送信ボタンは実寸 42px なので、透明な領域を足して操作領域を 44px にする (components 3.4) */
	.send {
		position: relative;
	}
	.send::after {
		content: '';
		position: absolute;
		inset: -1px;
	}
</style>

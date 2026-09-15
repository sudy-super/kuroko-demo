<script lang="ts">
	import { goto } from '$app/navigation';
	import { ui, type ContextChip } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';

	let { context = null }: { context?: ContextChip | null } = $props();

	let text = $state('');

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

<form
	class="chatbar"
	onsubmit={(e) => {
		e.preventDefault();
		send();
	}}
>
	{#if context}
		<button
			type="button"
			class="chip"
			aria-label="{context.label} との結び付けを外す"
			onclick={() => (ui.context = null)}
		>
			<span>{context.label}</span>
			<Icon name="ic-x" size={16} />
		</button>
	{/if}
	<input name="q" bind:value={text} placeholder="KUROKO に話しかける" aria-label="KUROKO への依頼" />
	<button
		type="button"
		class="iconbtn"
		title="音声で依頼"
		aria-label="音声で依頼"
		onclick={() => goto('/chat?voice=1')}
	>
		<Icon name="ic-mic" size={20} />
	</button>
	<button type="submit" class="send" aria-label="依頼" disabled={!text.trim()}>
		<Icon name="ic-send" size={20} />
	</button>
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

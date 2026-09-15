<script lang="ts">
	import { goto } from '$app/navigation';
	import { ui } from '$lib/ui.svelte';
	import Modal from './Modal.svelte';

	let text = $state('');
	let input: HTMLInputElement | null = $state(null);

	$effect(() => {
		if (ui.palette) input?.focus();
	});

	function send() {
		const q = text.trim();
		if (!q) return;
		text = '';
		ui.palette = false;
		goto(`/chat?q=${encodeURIComponent(q)}`);
	}
</script>

<Modal open={ui.palette} title="検索と依頼" size="sm" onclose={() => (ui.palette = false)}>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			send();
		}}
	>
		<input
			class="input"
			name="q"
			bind:this={input}
			bind:value={text}
			placeholder="探すもの、頼みたいこと"
			aria-label="探すもの、頼みたいこと"
		/>
	</form>
	{#snippet actions()}
		<button class="btn text" onclick={() => (ui.palette = false)}>閉じる</button>
		<button class="btn pri" disabled={!text.trim()} onclick={send}>KUROKO に頼む</button>
	{/snippet}
</Modal>

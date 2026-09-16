<script lang="ts">
	import { goto } from '$app/navigation';
	import { ui } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
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
	<!-- Task 10j — Today の画面から外した「予定」「ToDo」の追加はここから開く。
	     行きつく先は各画面の追加ボタンと同じ -->
	<nav class="palette-acts" aria-label="よく使う操作">
		<a class="list-row" href="/calendar?new=1" onclick={() => (ui.palette = false)}>
			<Icon name="ic-plus" size={20} />予定を追加
		</a>
		<a class="list-row" href="/tasks?new=1" onclick={() => (ui.palette = false)}>
			<Icon name="ic-plus" size={20} />新しい ToDo を追加
		</a>
	</nav>
	{#snippet actions()}
		<button class="btn pri" disabled={!text.trim()} onclick={send}>KUROKO に頼む</button>
		<button class="btn text" onclick={() => (ui.palette = false)}>閉じる</button>
	{/snippet}
</Modal>

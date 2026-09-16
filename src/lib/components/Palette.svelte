<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { todayCount } from '$lib/derived';
	import { startGuide } from '$lib/actions';
	import { SCENARIOS, pickScenario } from '$lib/scenarios';
	import { ui } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';

	let text = $state('');
	let input: HTMLInputElement | null = $state(null);

	// 上部バーのメニューと同じ出し分け (DemoMenu.svelte を見よ)
	const canStart = $derived(!db.demo.guide.on && todayCount(db) > 0);

	function close() {
		ui.palette = false;
	}

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
	<!-- Task 10m — デモの操作の 2 つ目の置き場所。本番の画面には出さない (仕様 5.1 の裁定)。
	     8 シナリオは畳んでおく。開閉は details に任せるので焦点の面倒を見る必要がない -->
	<section class="palette-acts" aria-label="デモの操作">
		{#if canStart}
			<button
				class="list-row"
				type="button"
				onclick={() => {
					close();
					startGuide();
				}}
			>
				<Icon name="ic-play" size={20} />デモを開始する
				<span class="palette-src">デモ</span>
			</button>
		{/if}
		<details class="palette-scenarios">
			<summary class="list-row">
				<Icon name="ic-chev" size={20} />他のシナリオを試す
				<span class="palette-src">デモ</span>
			</summary>
			{#each SCENARIOS as s, i (i)}
				<button
					class="list-row scenario"
					type="button"
					onclick={() => {
						close();
						pickScenario(i);
					}}
				>
					<span class="num demo-n">{i + 1}</span>
					<span>{s.label}</span>
				</button>
			{/each}
		</details>
		<button
			class="list-row"
			type="button"
			onclick={() => {
				close();
				ui.demoReset = true;
			}}
		>
			<Icon name="ic-undo" size={20} />デモをリセット
			<span class="palette-src">デモ</span>
		</button>
	</section>
	{#snippet actions()}
		<button class="btn pri" disabled={!text.trim()} onclick={send}>KUROKO に頼む</button>
		<button class="btn text" onclick={close}>閉じる</button>
	{/snippet}
</Modal>

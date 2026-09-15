<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { connect, connectAll, markStarted } from '$lib/actions';
	import type { Connection } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import { glass, PANEL } from '$lib/glass';

	const NAME: Record<Connection['id'], string> = {
		gmail: 'Gmail',
		gcal: 'Google カレンダー',
		slack: 'Slack',
		line: 'LINE'
	};

	let busy = $state<Partial<Record<Connection['id'], boolean>>>({});
	/* 読み上げ用。一覧そのものを aria-live にすると、画面に入った瞬間に 4 行すべてを
	   読み上げる読み上げソフトがある。状態の文だけを持つ見えない領域に分ける */
	let status = $state('');

	// 実際の認証は行わないが、即座に終わると押した実感がないので 600ms 待つ
	function link(id: Connection['id']) {
		if (busy[id]) return;
		busy[id] = true;
		status = `${NAME[id]} 接続中…`;
		setTimeout(async () => {
			connect(id);
			busy[id] = false;
			status = `${NAME[id]} 接続済み`;
			// 押したボタンはバッジに差し替わって消えるので、焦点をそのバッジへ移す
			await tick();
			document.getElementById(`conn-${id}`)?.focus();
		}, 600);
	}

	function open(all: boolean) {
		if (all) connectAll();
		markStarted();
		goto('/today');
	}
</script>

<div class="public-main">
	<h1 class="in" style="--delay: 80ms">使うツールをつなぎます</h1>
	<p class="muted in" style="--delay: 130ms">各 1 クリック、合計 10 秒。あとから設定で変更できます。</p>
</div>

<div class="public-list" {@attach glass(PANEL)}>
	{#each db.settings.connections as c, i (c.id)}
		<div class="list-row lg in" style="--delay: {180 + i * 70}ms">
			<Icon name="b-{c.id}" />
			<span class="name">{NAME[c.id]}</span>
			{#if c.connected}
				<span class="badge ok" id="conn-{c.id}" tabindex="-1">
					<Icon name="ic-check-c" size={12} />接続済み
				</span>
			{:else}
				<!-- 押せない間も焦点を失わせないため disabled ではなく aria-disabled にする -->
				<button class="btn sec sm" aria-disabled={!!busy[c.id]} onclick={() => link(c.id)}>
					{busy[c.id] ? '接続中…' : '接続する'}
				</button>
			{/if}
		</div>
	{/each}
</div>
<p class="sr-only" aria-live="polite">{status}</p>

<div class="public-foot">
	<button class="btn pri public-cta in" style="--delay: 460ms" onclick={() => open(true)}>
		4 つすべて接続して開く
	</button>
	<button class="btn text in" style="--delay: 520ms" onclick={() => open(false)}>
		スキップして開く
	</button>
</div>

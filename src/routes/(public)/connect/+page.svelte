<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { connectAll, markStarted, toggleConnection } from '$lib/actions';
	import type { Connection } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';

	const NAME: Record<Connection['id'], string> = {
		gmail: 'Gmail',
		gcal: 'Google カレンダー',
		slack: 'Slack',
		line: 'LINE'
	};

	let busy = $state<Partial<Record<Connection['id'], boolean>>>({});

	// 実際の認証は行わないが、即座に終わると押した実感がないので 600ms 待つ
	function connect(id: Connection['id']) {
		busy[id] = true;
		setTimeout(() => {
			toggleConnection(id);
			busy[id] = false;
		}, 600);
	}

	function open(all: boolean) {
		if (all) connectAll();
		markStarted();
		goto('/today');
	}
</script>

<div>
	<h1>使うツールをつなぎます</h1>
	<p class="muted">各 1 クリック、合計 10 秒。あとから設定で変更できます。</p>
</div>

<button class="btn pri lg" onclick={() => open(true)}>4 つすべて接続して開く</button>

<div class="public-list">
	{#each db.settings.connections as c (c.id)}
		<div class="list-row lg">
			<Icon name="b-{c.id}" />
			<span>{NAME[c.id]}</span>
			{#if c.connected}
				<span class="badge ok" style="margin-left: auto">
					<Icon name="ic-check-c" size={12} />接続済み
				</span>
			{:else}
				<button
					class="btn sec sm"
					style="margin-left: auto"
					disabled={busy[c.id]}
					onclick={() => connect(c.id)}
				>
					{busy[c.id] ? '接続中…' : '接続する'}
				</button>
			{/if}
		</div>
	{/each}
</div>

<button class="btn text" onclick={() => open(false)}>スキップして開く</button>

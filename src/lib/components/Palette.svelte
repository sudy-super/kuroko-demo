<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Command } from 'bits-ui';
	import { db } from '$lib/store.svelte';
	import { canStartGuide } from '$lib/derived';
	import { startGuide } from '$lib/actions';
	import { search, recent, GROUPS } from '$lib/search';
	import { SCENARIOS, pickScenario } from '$lib/scenarios';
	import { ui, request, type Handoff } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';
	import VoiceOverlay from './VoiceOverlay.svelte';

	let text = $state('');
	let input: HTMLInputElement | null = $state(null);

	const q = $derived(text.trim());
	const hits = $derived(search(db, q));
	const recents = $derived(recent(db));
	// 上部バーのメニューと同じ出し分け。条件は derived.ts に 1 つだけ置く
	const canStart = $derived(canStartGuide(db));

	/** 群の記号。人物・会社・案件は People の 3 つのタブと同じものを使う */
	const GROUP_ICON: Record<string, string> = {
		人物: 'ic-user',
		会社: 'ic-db',
		案件: 'ic-target',
		メール: 'ic-mail',
		予定: 'ic-cal',
		資料: 'ic-doc',
		ToDo: 'ic-todo'
	};

	// 閉じ方 (選択・Esc・⌘K・遷移) を問わず、次に開いたときは空から始める
	$effect(() => {
		if (!ui.palette) text = '';
	});

	const close = () => (ui.palette = false);

	function open(href: string, handoff?: Handoff) {
		close();
		request(href, handoff);
	}

	const ask = () => open('/chat', q ? { kind: 'ask', q } : undefined);
</script>

<!-- 群は見出しと行の並び。見出しの無い群 (KUROKO に頼む) もある -->
{#snippet group(heading: string | null, items: Snippet)}
	<Command.Group>
		{#if heading}<Command.GroupHeading class="pal-group">{heading}</Command.GroupHeading>{/if}
		<Command.GroupItems>{@render items()}</Command.GroupItems>
	</Command.Group>
{/snippet}

{#snippet row(value: string, onSelect: () => void, icon: string, label: string, src?: string)}
	<Command.Item class="list-row pal-row" {value} {onSelect}>
		<Icon name={icon} size={20} /><span class="pal-label">{label}</span>
		{#if src}<span class="pal-src">{src}</span>{/if}
	</Command.Item>
{/snippet}

{#snippet askItems()}
	{@render row('ask', ask, 'ic-spark', `KUROKO に頼む${q ? `: 「${q}」` : ''}`)}
{/snippet}

{#snippet recentItems()}
	{#each recents as r (r.href)}{@render row(`recent:${r.href}`, () => open(r.href), 'ic-history', r.label)}{/each}
{/snippet}

<!-- 「予定」「ToDo」の追加。行き先は各画面の追加ボタンと同じ -->
{#snippet actItems()}
	{@render row('act:event', () => open('/calendar', { kind: 'new-event' }), 'ic-plus', '予定を追加')}
	{@render row('act:task', () => open('/tasks', { kind: 'new-task' }), 'ic-plus', '新しい ToDo を追加')}
{/snippet}

{#snippet demoItems()}
	{#if canStart}
		{@render row('demo:start', () => (close(), startGuide()), 'ic-play', 'デモを開始する', 'デモ')}
	{/if}
	{#each SCENARIOS as s, i (i)}
		<Command.Item
			class="list-row pal-row scenario"
			value="demo:sc{i}"
			onSelect={() => {
				close();
				pickScenario(i);
			}}
		>
			<span class="num demo-n">{i + 1}</span>
			<span class="pal-label">{s.label}</span>
			<span class="pal-src">デモ</span>
		</Command.Item>
	{/each}
	{@render row('demo:reset', () => (close(), (ui.demoReset = true)), 'ic-undo', 'デモをリセット', 'デモ')}
{/snippet}

<Modal open={ui.palette} title="検索と依頼" size="palette" openFocus={() => input} onclose={close}>
	<!-- shouldFilter={false} — 絞り込みは search.ts が持つ (群ごと最大 4 件、関連する人物の名前でも
	     当てるので、文字列の素点による並べ替えでは代えられない)。loop で端から端へ回る -->
	<Command.Root loop shouldFilter={false} label="検索と依頼" class="pal">
		<div class="pal-head">
			<Icon name="ic-search" size={20} />
			<Command.Input
				class="pal-input"
				bind:value={text}
				bind:ref={input}
				placeholder="探すもの、頼みたいこと"
			/>
			<!-- chat.md 観点 6.4 — 記号だけの操作にはラベルかツールチップを必ず添える -->
			<button
				type="button"
				class="iconbtn"
				title="音声で依頼"
				aria-label="音声で依頼"
				onclick={() => (close(), (ui.voice = true))}
			>
				<Icon name="ic-mic" size={20} />
			</button>
		</div>
		<Command.List class="pal-list">
			<Command.Viewport>
				{#if !q}
					{#if recents.length > 0}{@render group('最近開いた', recentItems)}{/if}
					{@render group(null, askItems)}
					{@render group('よく使う操作', actItems)}
					<!-- デモの操作の 2 つ目の置き場所。本番の画面には出さない (仕様 5.1) -->
					{@render group('デモの操作', demoItems)}
				{:else}
					<!-- 0 件のときは先頭に、結果があるときは最下段に置く (仕様 5.14) -->
					{#if hits.length === 0}{@render group(null, askItems)}{/if}
					{#each GROUPS as g (g)}
						{@const rows = hits.filter((h) => h.group === g)}
						{#if rows.length > 0}
							{#snippet hitItems()}
								{#each rows as h (h.href + h.label)}
									<Command.Item
										class="list-row pal-row"
										value="{g}:{h.href}:{h.label}"
										onSelect={() => open(h.href)}
									>
										<Icon name={GROUP_ICON[g]} size={20} />
										<span class="pal-label">
											{h.label}<span class="sub">{h.sub}</span>
										</span>
										<span class="pal-src">{h.source}</span>
									</Command.Item>
								{/each}
							{/snippet}
							{@render group(g, hitItems)}
						{/if}
					{/each}
					{#if hits.length > 0}{@render group(null, askItems)}{/if}
				{/if}
			</Command.Viewport>
		</Command.List>
	</Command.Root>
</Modal>

<VoiceOverlay />

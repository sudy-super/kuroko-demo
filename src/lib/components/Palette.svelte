<script lang="ts">
	import { Command } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { canStartGuide } from '$lib/derived';
	import { startGuide } from '$lib/actions';
	import { search, recent, GROUPS } from '$lib/search';
	import { SCENARIOS, pickScenario } from '$lib/scenarios';
	import { ui } from '$lib/ui.svelte';
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

	function close() {
		text = '';
		ui.palette = false;
	}

	function open(href: string) {
		close();
		goto(href);
	}

	/* ここから chatSend を直接呼ばない (/chat 以外に発言が積まれて見えなくなる)。?q= を受けた /chat 側が送る */
	const ask = () => open(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat');
</script>

{#snippet askRow()}
	<Command.Group>
		<Command.GroupItems>
			<Command.Item class="list-row pal-row" value="ask" onSelect={ask}>
				<Icon name="ic-spark" size={20} />
				<span class="pal-label">KUROKO に頼む{q ? `: 「${q}」` : ''}</span>
			</Command.Item>
		</Command.GroupItems>
	</Command.Group>
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
				onclick={() => {
					ui.palette = false;
					ui.voice = true;
				}}
			>
				<Icon name="ic-mic" size={20} />
			</button>
		</div>
		<Command.List class="pal-list">
			<Command.Viewport>
				{#if !q}
					{#if recents.length > 0}
						<Command.Group>
							<Command.GroupHeading class="pal-group">最近開いた</Command.GroupHeading>
							<Command.GroupItems>
								{#each recents as r (r.href)}
									<Command.Item
										class="list-row pal-row"
										value="recent:{r.href}"
										onSelect={() => open(r.href)}
									>
										<Icon name="ic-history" size={20} />
										<span class="pal-label">{r.label}</span>
									</Command.Item>
								{/each}
							</Command.GroupItems>
						</Command.Group>
					{/if}
					{@render askRow()}
					<!-- 「予定」「ToDo」の追加。行き先は各画面の追加ボタンと同じ -->
					<Command.Group>
						<Command.GroupHeading class="pal-group">よく使う操作</Command.GroupHeading>
						<Command.GroupItems>
							<Command.Item
								class="list-row pal-row"
								value="act:event"
								onSelect={() => open('/calendar?new=1')}
							>
								<Icon name="ic-plus" size={20} /><span class="pal-label">予定を追加</span>
							</Command.Item>
							<Command.Item
								class="list-row pal-row"
								value="act:task"
								onSelect={() => open('/tasks?new=1')}
							>
								<Icon name="ic-plus" size={20} /><span class="pal-label">新しい ToDo を追加</span>
							</Command.Item>
						</Command.GroupItems>
					</Command.Group>
					<!-- デモの操作の 2 つ目の置き場所。本番の画面には出さない (仕様 5.1) -->
					<Command.Group>
						<Command.GroupHeading class="pal-group">デモの操作</Command.GroupHeading>
						<Command.GroupItems>
							{#if canStart}
								<Command.Item
									class="list-row pal-row"
									value="demo:start"
									onSelect={() => {
										close();
										startGuide();
									}}
								>
									<Icon name="ic-play" size={20} /><span class="pal-label">デモを開始する</span>
									<span class="pal-src">デモ</span>
								</Command.Item>
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
							<Command.Item
								class="list-row pal-row"
								value="demo:reset"
								onSelect={() => {
									close();
									ui.demoReset = true;
								}}
							>
								<Icon name="ic-undo" size={20} /><span class="pal-label">デモをリセット</span>
								<span class="pal-src">デモ</span>
							</Command.Item>
						</Command.GroupItems>
					</Command.Group>
				{:else}
					<!-- 0 件のときは先頭に、結果があるときは最下段に置く (仕様 5.14) -->
					{#if hits.length === 0}{@render askRow()}{/if}
					{#each GROUPS as g (g)}
						{@const rows = hits.filter((h) => h.group === g)}
						{#if rows.length > 0}
							<Command.Group>
								<Command.GroupHeading class="pal-group">{g}</Command.GroupHeading>
								<Command.GroupItems>
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
								</Command.GroupItems>
							</Command.Group>
						{/if}
					{/each}
					{#if hits.length > 0}{@render askRow()}{/if}
				{/if}
			</Command.Viewport>
		</Command.List>
	</Command.Root>
</Modal>

<VoiceOverlay />

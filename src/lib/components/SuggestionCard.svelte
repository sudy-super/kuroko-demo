<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Suggestion } from '$lib/types';
	import Icon from './Icon.svelte';

	let {
		suggestions,
		onaccept,
		onreject,
		title
	}: {
		suggestions: Suggestion[];
		onaccept: (ids: string[]) => void;
		onreject: () => void;
		title: string;
	} = $props();

	const picked = new SvelteSet<string>();
	// 消えた候補の分を数に残さないよう、今ある候補側から数える
	const chosen = $derived(suggestions.filter((s) => picked.has(s.id)).map((s) => s.id));

	function toggle(id: string) {
		if (picked.has(id)) picked.delete(id);
		else picked.add(id);
	}

	/** 候補の中身を 1 行で言い表す。ToDo 以外の候補もこのカードで出せるようにしておく */
	function label(s: Suggestion): string {
		const p = s.payload;
		if (p.type === 'task' || p.type === 'event') return p.title;
		if (p.type === 'person') return `${p.fields.name} (${p.fields.company})`;
		if (p.type === 'link_project') return p.projectName;
		return `${p.threadIds.length} 件のメールを結び付ける`;
	}
</script>

<!-- 仕様 5 — 提案には必ず「なぜこれを出したか」の 1 行を付ける -->
<section class="card sg" aria-label={title}>
	<div class="row sg-head">
		<Icon name="ic-spark" size={20} />
		<h2>{title}</h2>
	</div>
	{#each suggestions as s (s.id)}
		<label class="list-row lg sg-row">
			<input type="checkbox" checked={picked.has(s.id)} onchange={() => toggle(s.id)} />
			<span class="sg-col">
				<span>{label(s)}</span>
				<span class="sub">{s.reason}</span>
			</span>
		</label>
	{/each}
	<div class="row sg-foot">
		<button class="btn pri" disabled={chosen.length === 0} onclick={() => onaccept(chosen)}>
			選択した {chosen.length} 件を登録
		</button>
		<button class="btn sec" onclick={() => onaccept(suggestions.map((s) => s.id))}>
			すべて登録
		</button>
		<button class="btn text" onclick={onreject}>破棄</button>
	</div>
</section>

<style>
	.sg {
		margin-bottom: var(--sp-6);
		padding-inline: 0;
	}
	.sg-head {
		gap: var(--sp-3);
		padding: 0 var(--sp-5) var(--sp-3);
	}
	.sg-head h2 {
		font-size: 18px;
	}
	.sg-row {
		align-items: flex-start;
		height: auto;
		padding-block: var(--sp-3);
	}
	.sg-col {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.sg-col .sub {
		color: var(--ink-3);
		font-size: 14px;
	}
	.sg-foot {
		gap: var(--sp-4);
		padding: var(--sp-4) var(--sp-5) 0;
	}
</style>

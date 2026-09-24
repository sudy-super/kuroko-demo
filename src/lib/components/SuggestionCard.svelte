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

	/* 候補が出た直後、この行が依頼バーの裏に入って 1 回目の押下がバーに取られることがある
	   (議事録の作成直後で実測)。ReplyBox の .proposal-foot と同じ形で視界へ運ぶ。
	   block: 'nearest' なので既に見えていれば動かない (/tasks では画面の上寄りにあるため無動作) */
	function scrollIntoView(node: HTMLElement) {
		node.scrollIntoView({ block: 'nearest' });
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
	<div class="tc-head sg-head">
		<Icon name="ic-spark" size={20} />
		<h2>{title}</h2>
	</div>
	{#each suggestions as s (s.id)}
		<label class="list-row lg sg-row">
			<input type="checkbox" checked={picked.has(s.id)} onchange={() => toggle(s.id)} />
			<span class="tc-col">
				<span>{label(s)}</span>
				<span class="sub">{s.reason}</span>
			</span>
		</label>
	{/each}
	<!-- この札は ToDo の一覧の上に並ぶ補助の知らせなので、3 つとも塗りなしで枠と文字だけで段を付ける -->
	<div class="row tc-foot sg-foot" use:scrollIntoView>
		<button class="btn sec" disabled={chosen.length === 0} onclick={() => onaccept(chosen)}>
			選択した {chosen.length} 件を登録
		</button>
		<button class="btn text" onclick={() => onaccept(suggestions.map((s) => s.id))}>
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
	/* カードの左右の余白を消して行を端まで見せるので、見出しとボタン列にだけ戻す */
	.sg-head,
	.sg-foot {
		padding-inline: var(--sp-5);
	}
	.sg-head {
		padding-bottom: var(--sp-3);
	}
	.sg-row {
		align-items: flex-start;
		height: auto;
		padding-block: var(--sp-3);
	}
	/* 3 つで 360px の幅を超えるので折り返す。.row にも .tc-foot にも高さの指定が無いので
	   (app.css)、折り返した分だけ行が伸びる。固定の高さを解く必要は無い */
	.sg-foot {
		flex-wrap: wrap;
		gap: var(--sp-4);
		/* 視界へ運ぶとき、下端に重なる依頼バーとボトムナビの分だけ手前で止める
		   (app.css の --content-bottom-clear。ReplyBox の .send-row と同じ) */
		scroll-margin-bottom: var(--content-bottom-clear);
	}
</style>

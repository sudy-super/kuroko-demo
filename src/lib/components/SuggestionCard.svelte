<script lang="ts">
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

<!-- 仕様 5 — 提案には必ず「なぜこれを出したか」の 1 行を付ける。行ごとの「+」で 1 件ずつ、「すべて登録」で
     まとめて登録する (Apple Intelligence のリマインダーの提案、tasks-reminders.md 6 節) -->
<section class="card sg" aria-label={title}>
	<div class="tc-head sg-head">
		<Icon name="ic-spark" size={20} />
		<h2>{title}</h2>
	</div>
	{#each suggestions as s (s.id)}
		<div class="list-row lg sg-row">
			<span class="tc-col">
				<span>{label(s)}</span>
				<span class="sub">{s.reason}</span>
			</span>
			<button class="iconbtn sg-add" aria-label="「{label(s)}」を登録" title="登録" onclick={() => onaccept([s.id])}>
				<Icon name="ic-plus" size={20} />
			</button>
		</div>
	{/each}
	<!-- 「破棄」は Apple の提案には無い (追加しなければ消える) が、この札は画面に残り続けるので
	     片付ける手段として置く (tasks-reminders.md 6 節)。承認カードと同じ、塗りと薄い塗りの組み -->
	<div class="row tc-foot sg-foot" use:scrollIntoView>
		<button class="btn pri sm" onclick={() => onaccept(suggestions.map((s) => s.id))}>すべて登録</button>
		<button class="btn tint sm" onclick={onreject}>破棄</button>
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
		height: auto;
		padding-block: var(--sp-3);
		cursor: default;
	}
	.sg-row:hover {
		background: none;
	}
	.sg-row .tc-col {
		flex: 1;
		min-width: 0;
	}
	.sg-add {
		color: var(--accent);
	}
	/* 狭い幅では折り返す。.row にも .tc-foot にも高さの指定が無いので、折り返した分だけ伸びる */
	.sg-foot {
		flex-wrap: wrap;
		gap: var(--sp-2);
		/* 視界へ運ぶとき、下端に重なる依頼バーとボトムナビの分だけ手前で止める
		   (app.css の --content-bottom-clear。ReplyBox の .send-row と同じ) */
		scroll-margin-bottom: var(--content-bottom-clear);
	}
</style>

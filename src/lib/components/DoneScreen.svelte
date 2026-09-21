<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { nextMeeting, todaySummary } from '$lib/derived';

	const stats = $derived(db.demo.stats);
	const sum = $derived(todaySummary(db, 'KUROKO')); // 下の文が「KUROKO は」と名乗るので自分の操作は数えない
	const nm = $derived(nextMeeting(db));

	// 仕様 5.1 — 本日の実績 5 つ
	const ROWS = $derived([
		{ label: '承認', n: stats.approved },
		{ label: '返信', n: stats.replied },
		{ label: '日程確定', n: stats.confirmed },
		{ label: 'ToDo 登録', n: stats.tasksAdded },
		{ label: 'ToDo 完了', n: stats.tasksDone }
	]);
</script>

<section class="card done" aria-label="今日やることは 0 件です">
	<h2>今日やることは 0 件です</h2>
	<dl class="done-stats">
		{#each ROWS as r (r.label)}
			<div>
				<dt>{r.label}</dt>
				<dd><span class="num">{r.n}</span> 件</dd>
			</div>
		{/each}
	</dl>
	<!-- 上段と重なる数は出さない。送信・仮押さえ・登録は上段が利用者の決定として数えており、
	     同じ出来事を KUROKO 側から数え直すと「承認 3 件」と「送信 0 件」のように食い違って見える
	     (社外への送信は必ず承認を通るので KUROKO 名義の送信は常に 0 件。actions.ts の autoExecutes)。
	     下書きだけは上段に対応する行が無い -->
	<p class="muted">
		KUROKO が下書きまで用意したものが {sum.drafts} 件。Gmail もカレンダーも開かずに終わりました。
	</p>
	<!-- 仕様 5.1 の 2 つの行き先。Task 10k — 完了画面には他に塗りのボタンが無いので、
	     常に出る「作業履歴を見る」を主ボタンにする (buttons.md 観点 A 原則 3 の 1 画面 1 個)。
	     条件付きの「次の商談の Brief を見る」を主にすると、次の商談が無い日に主ボタンが
	     消えてしまう -->
	<div class="row done-links">
		<a class="btn pri" href="/activity">作業履歴を見る</a>
		{#if nm}<a class="btn text" href="/meetings/{nm.meeting.id}">次の商談の Brief を見る</a>{/if}
	</div>
</section>

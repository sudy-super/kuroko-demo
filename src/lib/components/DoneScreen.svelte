<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { nextMeeting, todaySummary } from '$lib/derived';

	const stats = $derived(db.demo.stats);
	const sum = $derived(todaySummary(db));
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
	<p class="muted">
		KUROKO は今日、下書き {sum.drafts} 件、予定の仮押さえ {sum.holds} 件、送信 {sum.sends} 件、登録 {sum.registers}
		件を行いました。
	</p>
	<div class="row done-links">
		<a class="btn sec" href="/activity">作業履歴を見る</a>
		{#if nm}<a class="btn text" href="/meetings/{nm.meeting.id}">次の商談の Brief を見る</a>{/if}
	</div>
</section>

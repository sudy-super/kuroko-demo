<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { db, save } from '$lib/store.svelte';
	import { lineSay, sendReply } from '$lib/actions';
	import { integrations } from '$lib/integrations';
	import Icon from '$lib/components/Icon.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import LineChat from '$lib/components/LineChat.svelte';

	const TABS = [
		{ key: 'line', label: 'LINE' },
		{ key: 'slack', label: 'Slack' }
	] as const;
	const ROLES = [
		{ key: 'owner', label: 'Owner (社長)' },
		{ key: 'member', label: 'Member (山田)' }
	] as const;

	// 承認のシーンで使う、田中様とのやり取り (src/lib/seed.ts の queueThreads)
	const TANAKA = 'th-tanaka-next';

	const set = <K extends 'lineTab' | 'lineRole'>(k: K, v: (typeof db.demo)[K]) => {
		db.demo[k] = v;
		save();
	};

	onMount(() => {
		// 承認のシーン: 田中様への返信案を KUROKO のカードとして LINE に出す。
		// 無ければここで作る (/inbox を通らずにこの画面だけで見せられるように)。
		// status は見ない。送信済みや却下済みでも作り直さない (やり直しは「デモをリセット」)
		if (page.url.searchParams.get('scene') === 'approve') {
			const a =
				db.approvals.find((x) => x.payload.type === 'reply' && x.payload.threadId === TANAKA) ??
				sendReply(TANAKA, '田中様\n\nご連絡ありがとうございます。\n次回の日程を調整いたします。', 'line');
			// 同じ承認のカードが既に出ているなら積み直さない。この URL は途中でやり直すために
			// 開き直されるので、そのたびにカードと承認が増えないようにする
			const shown = db[db.demo.lineTab].some((m) => m.card?.actions.some((x) => x.arg === a.id));
			if (!shown)
				integrations.chat.post(db.demo.lineTab, '田中様への返信案ができました', {
					title: a.title,
					lines: [`宛先 ${a.to}`],
					actions: [
						{ label: '内容を見る', act: 'preview', arg: a.id },
						{ label: '承認して送信', act: 'approve', arg: a.id }
					]
				});
		}
		const say = page.url.searchParams.get('say');
		if (say) lineSay(say, db.demo.lineRole);
	});
</script>

<svelte:head><title>LINE / Slack — KUROKO AI</title></svelte:head>

<div class="ig">
	<h1 class="sr-only">LINE / Slack</h1>

	<!-- indicators.md — 状態は文言のタグではなくアイコンと文で示す -->
	<p class="ig-banner">
		<Icon name="ic-shield" size={20} />
		<!-- 文は 1 つの要素にまとめる。地の文と <strong> を直接置くと別々の flex item になり、
		     幅が足りないときにそれぞれが縮んで単語の途中で折り返す -->
		<span>KUROKO は <strong>@KUROKO</strong> と書かれた内容だけを処理します。ほかの会話は読みません。</span>
	</p>

	<div class="ig-switches">
		<Segmented label="サービスを選ぶ" items={[...TABS]} value={db.demo.lineTab} onchange={(k) => set('lineTab', k)} />
		<Segmented label="話しかける人を選ぶ" items={[...ROLES]} value={db.demo.lineRole} onchange={(k) => set('lineRole', k)} />
	</div>

	<!-- 切り替えるとやり取りの入れ物ごと変わる。log をそのまま作り直させる -->
	{#key db.demo.lineTab}
		<LineChat channel={db.demo.lineTab} role={db.demo.lineRole} />
	{/key}
</div>

<style>
	.ig {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		padding: 0 var(--sp-5);
	}
	.ig-banner {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--r-m);
		background: var(--accent-soft);
		color: var(--ink-2);
		font-size: 14px;
	}
	.ig-switches {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3) var(--sp-5);
	}
</style>

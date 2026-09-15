<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { guideSection } from '$lib/derived';
	import { stopGuide } from '$lib/actions';

	// 仕様 11.3 — 節ごとの見出しと手順
	const SECTIONS: Record<1 | 2 | 3 | 4 | 5, { title: string; steps: string }> = {
		1: { title: '承認を片付ける', steps: 'Today の承認待ちを開き、2 件を承認します' },
		2: {
			title: '田中様に返信する',
			steps:
				'Inbox で田中様のメールを開き、「日程候補を入れる」で返信案を作って送信し、承認します'
		},
		3: {
			title: '日程が決まる',
			steps:
				'「相手の画面を開く」で別タブを開き、候補を選んで確定します。元のタブに反映されます'
		},
		4: {
			title: '会議の前後',
			steps:
				'Today の「次の会議」から Brief を確認し、アジェンダを作成、文字起こしを追加して ToDo 候補を 2 件登録します'
		},
		5: { title: '今日を終える', steps: '今日の ToDo 3 件を完了にします' }
	};

	const section = $derived(guideSection(db));
</script>

<aside class="guide" aria-label="操作の案内">
	{#if section === 0}
		<h2>完了しました</h2>
		<p style="margin: var(--sp-2) 0 var(--sp-3); font-size: 14px; color: var(--ink-2)">
			ひととおりの流れをお試しいただきました。
		</p>
		<button class="btn text sm" onclick={stopGuide}>閉じる</button>
	{:else}
		<div class="row" style="justify-content: space-between">
			<h2>{SECTIONS[section].title}</h2>
			<span class="num muted">{section} / 5</span>
		</div>
		<p style="margin: var(--sp-2) 0 var(--sp-3); font-size: 14px; color: var(--ink-2)">
			{SECTIONS[section].steps}
		</p>
		<button class="btn text sm" onclick={stopGuide}>ツアーを終了</button>
	{/if}
</aside>

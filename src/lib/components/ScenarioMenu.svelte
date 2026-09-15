<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { startScenario } from '$lib/actions';
	import Icon from './Icon.svelte';

	// 仕様 11.4 — 8 シナリオ。文言は仕様のまま、番号順に並べる
	const SCENARIOS: { label: string; href: string }[] = [
		{
			label:
				'Today から予定追加 → 田中さん・ABC 社案件を選択 → Meet 作成 → Calendar / Today 反映 → Meeting 生成',
			href: '/calendar?new=1'
		},
		{
			label: 'Inbox から「KUROKO に依頼」→ 過去のやり取り照会 → 人物プロフィール',
			href: '/inbox?t=th-tanaka-next'
		},
		{
			label: 'KUROKO チャットで「金曜までに ABC 社へ見積提出、覚えて」→ 確認 → Task 登録',
			href: `/chat?q=${encodeURIComponent('金曜までに ABC 社へ見積提出、覚えて')}`
		},
		{
			label: 'People から名刺 OCR → 確認 → 登録 → 過去メールの関連付け提案',
			href: '/people?ocr=1'
		},
		{
			label: 'LINE Demo: 「@KUROKO 明日 17 時までに資料確認、ToDo 入れて」→ Tasks 反映',
			href: `/integrations?say=${encodeURIComponent('@KUROKO 明日 17 時までに資料確認、ToDo 入れて')}`
		},
		{
			label: 'LINE Demo: 承認を LINE で返す / Member 権限の挙動',
			href: '/integrations?scene=approve'
		},
		{
			label: 'KUROKO チャットから提案書生成',
			href: `/chat?q=${encodeURIComponent('ABC 社向けの提案書を作って')}`
		},
		{
			label: '移動時間の警告を発火させる予定作成 (渋谷 13:00 の後に 品川 14:30)',
			href: `/calendar?new=1&place=${encodeURIComponent('品川')}&start=14:30`
		}
	];

	function pick(i: number) {
		startScenario(i + 1);
		goto(SCENARIOS[i].href);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button {...props} class="btn sec">
				他のシナリオを試す
				<Icon name="ic-chev" size={18} />
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content class="menu scenario-menu" align="end" sideOffset={8}>
			{#each SCENARIOS as s, i (i)}
				<DropdownMenu.Item class="menu-item" onSelect={() => pick(i)}>
					<span class="num menu-n">{i + 1}</span>
					<span>{s.label}</span>
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

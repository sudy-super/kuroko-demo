<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { canStartGuide } from '$lib/derived';
	import { resetDemo, startGuide } from '$lib/actions';
	import { SCENARIOS, pickScenario } from '$lib/scenarios';
	import { ui } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';

	// Task 10m — デモの操作は本番の画面に出さず、上部バー右端のこのアイコンと ⌘K だけに置く
	// (ユーザー裁定 2026-09-16、仕様 5.1)。出し分けの条件は derived.ts に 1 つだけ置く
	const canStart = $derived(canStartGuide(db));

	function reset() {
		ui.demoReset = false;
		resetDemo();
		goto('/');
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button {...props} class="iconbtn" title="デモの操作" aria-label="デモの操作">
				<Icon name="ic-demo" size={20} />
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content class="demo-menu" align="end" sideOffset={14}>
			{#if canStart}
				<DropdownMenu.Item class="demo-item" onSelect={startGuide}>デモを開始する</DropdownMenu.Item>
			{/if}
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger class="demo-item">
					他のシナリオを試す
					<Icon name="ic-chev" size={18} />
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent class="demo-menu wide" sideOffset={8}>
					{#each SCENARIOS as s, i (i)}
						<DropdownMenu.Item class="demo-item scenario" onSelect={() => pickScenario(i)}>
							<span class="num demo-n">{i + 1}</span>
							<span>{s.label}</span>
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Item class="demo-item" onSelect={() => (ui.demoReset = true)}>
				デモをリセット
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

<!-- ⌘K パレットの「デモをリセット」もこの 1 枚を開く。確かめる問いを 2 か所に書かない -->
<Modal
	open={ui.demoReset}
	title="デモをリセット"
	description="初期状態に戻しますか? 承認や返信など、ここまでの操作はすべて消えます。"
	size="sm"
	onclose={() => (ui.demoReset = false)}
>
	{#snippet actions()}
		<button class="btn pri" onclick={reset}>初期状態に戻す</button>
		<button class="btn text" onclick={() => (ui.demoReset = false)}>やめる</button>
	{/snippet}
</Modal>

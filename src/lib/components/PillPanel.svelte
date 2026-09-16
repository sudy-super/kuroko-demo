<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Popover } from 'bits-ui';

	/* Task 10n — 浮かぶ上部のピルの中のボタンを押したときだけ、ピルの直下に開く小さな板。
	   island.md「広がる条件」— 常時は compact のまま、押した 1 つだけを一時的に開く。
	   bits-ui の Popover をそのまま使うのは、開閉ボタンの aria-expanded / aria-controls、
	   Esc、範囲外の押下、同じボタンの再押下がすべて既定で付いてくるためで、
	   island.md「キーボードと読み上げ」の Disclosure の要件がこれで満たせる。
	   ドロワー (Drawer.svelte)と違って履歴は積まない。ドロワーは画面の半分を覆うので
	   「戻る」で閉じられる必要があるが、この板は数件を見せるだけで、履歴を積むと
	   「戻る」が板の開閉に取られて画面の行き来ができなくなる。覆いも出ないので
	   markOverlay も呼ばない (カードのガラスを落とす必要がない) */
	let {
		open = $bindable(false),
		trigger,
		children
	}: {
		open?: boolean;
		/** 押すボタンそのもの。bits-ui が渡す属性 (aria-expanded ほか)を受け取って付ける */
		trigger: Snippet<[Record<string, unknown>]>;
		children: Snippet;
	} = $props();
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}{@render trigger(props)}{/snippet}
	</Popover.Trigger>
	<Popover.Portal>
		<!-- sideOffset 14 — ボタン (40px)はピル (52px)の中で上下 6px ずつ空いているので、
		     ボタンの下 14px はピルの下端から 8px。板がピルに掛からない最小の値 -->
		<Popover.Content class="pill-panel" align="center" sideOffset={14}>
			{@render children()}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

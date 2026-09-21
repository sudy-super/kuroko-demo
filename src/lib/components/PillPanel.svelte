<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Popover } from 'bits-ui';
	import { panels } from '$lib/ui.svelte';

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
		name,
		trigger,
		children
	}: {
		/** 上部バーで開いている板を 1 つに保つための名前 (ui.svelte.ts の panels) */
		name: string;
		/** 押すボタンそのもの。bits-ui が渡す属性 (aria-expanded ほか)を受け取って付ける */
		trigger: Snippet<[Record<string, unknown>]>;
		children: Snippet;
	} = $props();

	const open = $derived(panels.open === name);
</script>

<Popover.Root {open} onOpenChange={(v) => (panels.open = v ? name : null)}>
	<Popover.Trigger>
		{#snippet child({ props })}{@render trigger(props)}{/snippet}
	</Popover.Trigger>
	<Popover.Portal>
		<!-- sideOffset 14 — ボタン (40px)はピル (52px)の中で上下 6px ずつ空いているので、
		     ボタンの下 14px はピルの下端から 8px。板がピルに掛からない最小の値。
		     collisionPadding right 88 — floating-ui はこの余白を画面の外扱いにして板を左へ
		     押し出す。レールの左端は画面の右端から --rail-w (56) + --sp-4 (16) = 72px の位置
		     なので、そこからさらに 16px 離すには 72+16=88 が要る (レビューが挙げた 72 だと
		     レールの左端に触れるだけで実測 0px の余白しか残らないことを elementFromPoint で確認
		     したので、数値を修正した)。レールが無い画面では画面の右端から 24px を求めれば足りる
		     が、88 はそれも上回るので同じ 1 値で両方を満たす (review-task-10n.md Important 1) -->
		<Popover.Content class="pill-panel" align="center" sideOffset={14} collisionPadding={{ right: 88 }}>
			{@render children()}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

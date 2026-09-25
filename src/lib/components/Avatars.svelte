<script lang="ts">
	import type { Person } from '$lib/types';

	/* 関係する人物の頭文字の丸を最大 3 つ + 残りは +N。読み上げ名は人物名そのもの (WCAG 1.1.1) */
	let { people }: { people: Person[] } = $props();

	const shown = $derived(people.slice(0, 3));
	const rest = $derived(people.length - shown.length);
	const names = $derived(people.map((p) => p.name).join('、'));
</script>

{#if people.length}
	<span class="avatars" role="img" aria-label={names}>
		{#each shown as p (p.id)}
			<span class="avatar" aria-hidden="true">{p.name.charAt(0)}</span>
		{/each}
		{#if rest > 0}
			<span class="avatar avatar-more" aria-hidden="true">+{rest}</span>
		{/if}
	</span>
{/if}

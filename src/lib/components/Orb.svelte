<script lang="ts">
	let { size = 580, sparks = true }: { size?: number; sparks?: boolean } = $props();
</script>

<div class="orb" style="width:{size}px;height:{size}px" aria-hidden="true">
	<div class="orb-glow"></div>
	<img src="/orb.png" alt="" width={size} height={size} />
	{#if sparks}
		{#each Array(24) as _, i}
			<span class="spark" style="--i:{i}"></span>
		{/each}
	{/if}
</div>

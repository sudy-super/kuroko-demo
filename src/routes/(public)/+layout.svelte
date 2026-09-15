<script lang="ts">
	import Orb from '$lib/components/Orb.svelte';

	let { children } = $props();
</script>

<div class="public">
	<div class="public-stage">
		<Orb size={480} />
		<div class="glass public-panel">{@render children()}</div>
	</div>
</div>

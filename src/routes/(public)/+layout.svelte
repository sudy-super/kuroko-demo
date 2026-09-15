<script lang="ts">
	import Orb from '$lib/components/Orb.svelte';

	let { children } = $props();
</script>

<div class="public">
	<Orb size={520} />
	<div class="glass public-panel">{@render children()}</div>
</div>

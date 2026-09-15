<script lang="ts">
	import Orb from '$lib/components/Orb.svelte';
	import { glass, PANEL } from '$lib/glass';

	let { children } = $props();
</script>

<div class="public">
	<div class="public-stage">
		<Orb size={520} />
		<div class="glass public-panel" {@attach glass(PANEL)}>{@render children()}</div>
	</div>
</div>

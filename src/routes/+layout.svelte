<script lang="ts">
	import '../app.css';
	import Icons from '$lib/components/Icons.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();
</script>

<Icons />

<div class="bg" aria-hidden="true">
	<div class="bg-blob a"></div>
	<div class="bg-blob b"></div>
	<div class="bg-blob c"></div>
</div>

{@render children()}

<Toast />

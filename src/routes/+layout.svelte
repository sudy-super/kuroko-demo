<script lang="ts">
	import '../app.css';
	import Icons from '$lib/components/Icons.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();
</script>

<Icons />

<div class="bg" aria-hidden="true"></div>

{@render children()}

<Toast />

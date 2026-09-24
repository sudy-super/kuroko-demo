<script lang="ts">
	import '../app.css';
	import '../styles/palette.css';
	import '../styles/voice.css';
	import '../styles/liquid-glass.css';
	import '../styles/form.css';
	import '../styles/calendar.css';
	import '../styles/people.css';
	import Icons from '$lib/components/Icons.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();
</script>

<Icons />

<div class="bg" aria-hidden="true"></div>

{@render children()}

<Toast />

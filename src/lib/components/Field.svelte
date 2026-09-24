<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	/** 見出し付きの入力欄 1 つ分。残りの属性 (type・required・placeholder) は input にそのまま渡す */
	let { label, value = $bindable(), ...rest }: { label: string } & HTMLInputAttributes = $props();
	const id = $props.id();
</script>

<div class="field">
	<label class="label" for={id}>{label}</label>
	<input class="input" {id} bind:value {...rest} />
</div>

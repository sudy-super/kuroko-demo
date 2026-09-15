<script lang="ts">
	import { ui, dismissToast } from '$lib/ui.svelte';
</script>

{#if ui.toast}
	<div class="toast" role="status" aria-live="polite">
		{#if ui.toast.secondsLeft !== undefined}
			<span class="toast-ring num" style="--p:{ui.toast.secondsLeft / 5}">{ui.toast.secondsLeft}</span>
		{/if}
		<span class="toast-msg">{ui.toast.msg}</span>
		{#if ui.toast.undo}
			<button
				class="toast-undo"
				onclick={() => {
					ui.toast?.undo?.();
					dismissToast();
				}}>取り消す</button
			>
		{/if}
	</div>
{/if}

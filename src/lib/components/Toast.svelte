<script lang="ts">
	import { ui, dismissToast } from '$lib/ui.svelte';
</script>

{#if ui.toast}
	<!-- id で key し、取り消し猶予が改めて始まるたびに CSS アニメーションを最初から動かす -->
	{#key ui.toast.id}
		<div
			class="toast"
			class:leave={ui.toast.leaving}
			role="status"
			aria-live="polite"
			style={ui.toast.seconds ? `--dur:${ui.toast.seconds}s` : undefined}
		>
			{#if ui.toast.secondsLeft !== undefined}
				<span class="toast-ring num" aria-hidden="true">{ui.toast.secondsLeft}</span>
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
	{/key}
{/if}

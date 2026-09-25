<script lang="ts">
	import { ui, dismissToast } from '$lib/ui.svelte';

	/* 輪 + 文言 + 取り消す。Toast.svelte と Header.svelte (デスクトップのピル) の両方で使う */
</script>

{#if ui.toast?.secondsLeft !== undefined}
	<span class="toast-ring num" aria-hidden="true">{ui.toast.secondsLeft}</span>
{/if}
{#if ui.toast}<span class="toast-msg">{ui.toast.msg}</span>{/if}
{#if ui.toast?.undo}
	<button
		class="toast-undo"
		onclick={() => {
			ui.toast?.undo?.();
			dismissToast();
		}}>取り消す</button
	>
{/if}

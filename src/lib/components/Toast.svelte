<script lang="ts">
	import { ui } from '$lib/ui.svelte';
	import { mobile } from '$lib/media.svelte';
	import ToastCountdown from './ToastCountdown.svelte';

	/* 取り消しの猶予を持つトーストは、デスクトップでは上部バーのピルの中に出すのでここでは出さない。
	   モバイルの上部バーは伸ばす余地が無いのでここに出す */
	const hideForIsland = $derived(!mobile.current && !!ui.toast?.island);
</script>

{#if ui.toast && !hideForIsland}
	<!-- id で key し、取り消し猶予が改めて始まるたびに CSS アニメーションを最初から動かす -->
	{#key ui.toast.id}
		<div
			class="toast"
			class:leave={ui.toast.leaving}
			role="status"
			aria-live="polite"
			style={ui.toast.seconds ? `--dur:${ui.toast.seconds}s` : undefined}
		>
			<ToastCountdown />
		</div>
	{/key}
{/if}

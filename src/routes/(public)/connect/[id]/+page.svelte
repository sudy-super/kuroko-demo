<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { isConnectionId } from '$lib/connect';
	import ConnectStep from '$lib/components/ConnectStep.svelte';

	const id = $derived(page.params.id ?? '');

	/* 知らない id は導入画面へ。replaceState にしないと、戻るたびに同じ転送が起きる */
	$effect(() => {
		if (!isConnectionId(id)) goto('/connect', { replaceState: true });
	});
</script>

{#if isConnectionId(id)}
	<!-- 画面ごとに作り直す。同じルートのまま id だけ変わると、前の画面の待ち時間や
	     入場アニメーションが残る -->
	{#key id}
		<ConnectStep {id} />
	{/key}
{/if}

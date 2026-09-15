<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
</script>

<div class="public-main">
	<h1 class="brand in" style="--delay: 80ms">KUROKO AI</h1>
	<p class="muted in" style="--delay: 130ms">社長の仕事を、ひとつのインターフェースへ。</p>
	<p class="in" style="--delay: 180ms">予定・連絡・会議・ToDo・人と案件・資料を、秘書に頼む感覚で。</p>
	<p class="in" style="--delay: 220ms">Gmail やカレンダーを開く必要はありません。</p>
</div>

<div class="public-foot">
	<button class="btn pri public-cta in" style="--delay: 280ms" onclick={() => goto('/connect')}>
		デモを開始
	</button>
	{#if db.demo.started}
		<button class="btn text in" style="--delay: 320ms" onclick={() => goto('/today')}>
			続きから (Today へ)
		</button>
	{/if}
	<div class="muted note in" style="--delay: 320ms">
		<p>Demo Workspace / ログインは不要です</p>
		<p>※ デモのため実際の接続は行いません</p>
	</div>
</div>

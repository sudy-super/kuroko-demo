<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
</script>

<div>
	<h1 class="brand">KUROKO AI</h1>
	<p class="muted">社長の仕事を、ひとつのインターフェースへ。</p>
</div>

<div>
	<p>予定・連絡・会議・ToDo・人と案件・資料を、秘書に頼む感覚で。</p>
	<p>Gmail やカレンダーを開く必要はありません。</p>
</div>

<button class="btn pri lg" onclick={() => goto('/connect')}>デモを開始</button>
{#if db.demo.started}
	<button class="btn text" onclick={() => goto('/today')}>続きから (Today へ)</button>
{/if}

<div class="muted note">
	<p>Demo Workspace / ログインは不要です</p>
	<p>※ デモのため実際の接続は行いません</p>
</div>

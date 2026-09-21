<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
</script>

<svelte:head><title>見つかりません — KUROKO AI</title></svelte:head>

<!-- ルートの層に置くので、サイドナビや依頼バーの無い公開側と同じ骨格を使う
     ((public)/+layout.svelte と app.css の .public-*) -->
<div class="public">
	<div class="public-col">
		<div class="public-main">
			<h1 class="in">見つかりません</h1>
			<p class="muted in" style="--delay: 60ms">
				{page.status === 404 ? 'この画面はありません。' : '読み込めませんでした。'}
			</p>
		</div>
		<div class="public-foot">
			<a class="btn pri public-cta in" style="--delay: 110ms" href="/today">
				<Icon name="ic-home" size={18} />Today へ戻る
			</a>
		</div>
	</div>
</div>

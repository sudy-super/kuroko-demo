<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { todayCount } from '$lib/derived';
</script>

<h1>Today</h1>
<p>今日の残りは {todayCount(db)} 件です。</p>

<script lang="ts">
	/* label を渡した行だけ、支援技術に名前を出す図形として扱う (Apple HIG Icons —
	   カスタムアイコンには必ず代替テキストを付ける)。渡さなければ今まで通りの飾り */
	let {
		name,
		size = 24,
		label,
		class: cls = ''
	}: { name: string; size?: number; label?: string; class?: string } = $props();
</script>

<svg
	class="i {cls}"
	width={size}
	height={size}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}><use href="#{name}" /></svg>

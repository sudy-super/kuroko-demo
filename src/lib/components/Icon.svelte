<script lang="ts">
	/* label を渡したときだけ名前を持つ図形として扱う (HIG Icons)。渡さなければ飾り */
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

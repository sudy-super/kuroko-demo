<script lang="ts">
	let { name, size = 24, class: cls = '' }: { name: string; size?: number; class?: string } = $props();
</script>

<svg class="i {cls}" width={size} height={size} aria-hidden="true"><use href="#{name}" /></svg>

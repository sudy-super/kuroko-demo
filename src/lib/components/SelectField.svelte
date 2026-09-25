<script module lang="ts">
	export type Opt = { value: string; label: string };
</script>

<script lang="ts">
	import { Select } from 'bits-ui';
	import Icon from './Icon.svelte';

	let {
		label,
		items,
		value,
		onchange,
		multiple = false,
		placeholder = '選択しない'
	}: {
		label: string;
		items: Opt[];
		/** 単一なら文字列、複数なら文字列の配列 */
		value: string | string[];
		/* 単一と複数で bits-ui が渡す型が違う (string / string[])。
		   受け手側で確定させるので、ここでは絞らない */
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onchange: (v: any) => void;
		multiple?: boolean;
		placeholder?: string;
	} = $props();

	const id = $props.id();
	const labelOf = (v: string) => items.find((o) => o.value === v)?.label ?? v;
	const text = $derived(
		Array.isArray(value)
			? value.map(labelOf).join('、') || placeholder
			: value
				? labelOf(value)
				: placeholder
	);
	const empty = $derived(Array.isArray(value) ? value.length === 0 : !value);
</script>

{#snippet inner()}
	<Select.Trigger class="input select-trigger" aria-labelledby={id}>
		<span class:muted={empty}>{text}</span>
		<Icon name="ic-chev" size={18} />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content class="select-menu" sideOffset={4}>
			<Select.Viewport>
				{#each items as o (o.value)}
					<Select.Item class="select-item" value={o.value} label={o.label}>
						{#snippet children({ selected })}
							<span>{o.label}</span>
							{#if selected}<Icon name="ic-check" size={18} />{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
{/snippet}

<div class="field">
	<span class="label" {id}>{label}</span>
	{#if multiple}
		<Select.Root type="multiple" value={value as string[]} onValueChange={onchange} {items}>
			{@render inner()}
		</Select.Root>
	{:else}
		<Select.Root type="single" value={value as string} onValueChange={onchange} {items}>
			{@render inner()}
		</Select.Root>
	{/if}
</div>

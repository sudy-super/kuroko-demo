<script lang="ts">
	import { Select } from 'bits-ui';
	import type { Task } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { addTask, undo } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';

	let { open, onclose }: { open: boolean; onclose: () => void } = $props();

	const formId = $props.id();

	let title = $state('');
	let due = $state('');
	let time = $state('');
	let priority = $state<Task['priority']>('normal');
	let personId = $state('');
	let companyId = $state('');
	let projectId = $state('');
	let memo = $state('');

	type Opt = { value: string; label: string };
	const PRIORITY: Opt[] = [
		{ value: 'high', label: '高' },
		{ value: 'normal', label: '標準' },
		{ value: 'low', label: '低' }
	];
	const people = $derived<Opt[]>(db.people.map((p) => ({ value: p.id, label: p.name })));
	const companies = $derived<Opt[]>(db.companies.map((c) => ({ value: c.id, label: c.name })));
	const projects = $derived<Opt[]>(db.projects.map((p) => ({ value: p.id, label: p.name })));

	function reset() {
		title = '';
		due = '';
		time = '';
		priority = 'normal';
		personId = companyId = projectId = '';
		memo = '';
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		addTask(
			{
				title: title.trim(),
				due: due || undefined,
				time: time || undefined,
				priority,
				personId: personId || undefined,
				companyId: companyId || undefined,
				projectId: projectId || undefined,
				memo: memo.trim() || undefined
			},
			'tasks'
		);
		// addTask が今積んだログを取り消す。押された後に積まれたログには触らない
		const l = db.logs[0];
		toast('ToDo を登録しました', { undo: () => undo(l.id) });
		reset();
		onclose();
	}

	function cancel() {
		reset();
		onclose();
	}
</script>

<!-- $props.id() は初期化時にしか呼べないので、欄の id は formId から組み立てる -->
{#snippet select(name: string, label: string, opts: Opt[], value: string, set: (v: string) => void)}
	{@const id = `${formId}-${name}`}
	<div class="field">
		<span class="label" {id}>{label}</span>
		<Select.Root type="single" {value} onValueChange={set} items={opts}>
			<Select.Trigger class="input select-trigger" aria-labelledby={id}>
				<span class:muted={!value}>{opts.find((o) => o.value === value)?.label ?? '選択しない'}</span>
				<Icon name="ic-chev" size={18} />
			</Select.Trigger>
			<Select.Portal>
				<Select.Content class="select-menu" sideOffset={4}>
					<Select.Viewport>
						{#each opts as o (o.value)}
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
		</Select.Root>
	</div>
{/snippet}

<Modal {open} title="新しい ToDo を追加" onclose={cancel}>
	<form id={formId} onsubmit={submit}>
		<div class="field">
			<label class="label" for="{formId}-title">タイトル</label>
			<input class="input" id="{formId}-title" bind:value={title} required />
		</div>
		<div class="row form-pair">
			<div class="field">
				<label class="label" for="{formId}-due">期限</label>
				<input class="input" id="{formId}-due" type="date" bind:value={due} />
			</div>
			<div class="field">
				<label class="label" for="{formId}-time">時刻</label>
				<input class="input" id="{formId}-time" type="time" bind:value={time} />
			</div>
		</div>
		{@render select('priority', '優先度', PRIORITY, priority, (v) => (priority = v as Task['priority']))}
		{@render select('person', '関連人物', people, personId, (v) => (personId = v))}
		{@render select('company', '会社', companies, companyId, (v) => (companyId = v))}
		{@render select('project', '案件', projects, projectId, (v) => (projectId = v))}
		<div class="field">
			<label class="label" for="{formId}-memo">メモ</label>
			<textarea class="textarea" id="{formId}-memo" bind:value={memo}></textarea>
		</div>
	</form>
	{#snippet actions()}
		<button class="btn pri" type="submit" form={formId}>登録</button>
		<button class="btn text" type="button" onclick={cancel}>キャンセル</button>
	{/snippet}
</Modal>

<style>
	/* 期限と時刻だけは横に並べる。片方だけ広げず、同じ幅で割る */
	.form-pair {
		gap: var(--sp-4);
		align-items: flex-start;
	}
	.form-pair .field {
		flex: 1;
		min-width: 0;
	}
	/* 選ぶ欄は入力欄と同じ見た目にし、中身を両端に寄せる */
	:global(.select-trigger) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-2);
		text-align: left;
		cursor: pointer;
	}
	/* ic-chev は右向き。開く向きに合わせて下を向かせる */
	:global(.select-trigger .i) {
		transform: rotate(90deg);
	}
	/* 覆いの上に出すので、モーダル (z-index 75) より上に置く */
	:global(.select-menu) {
		z-index: 80;
		width: var(--bits-select-anchor-width);
		max-height: 280px;
		overflow-y: auto;
		padding: var(--sp-2);
		border-radius: var(--r-m);
		background: var(--solid);
		box-shadow: var(--e3);
	}
	:global(.select-menu:focus-visible) {
		outline: none;
	}
	:global(.select-item) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		min-height: 44px;
		padding: 0 var(--sp-4);
		border-radius: var(--r-s);
		font-size: 16px;
		cursor: pointer;
	}
	:global(.select-item[data-highlighted]) {
		background: var(--sel-soft);
	}
</style>

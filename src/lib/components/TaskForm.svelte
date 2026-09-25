<script lang="ts">
	import type { Task } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { addTask, undo } from '$lib/actions';
	import { addLogOf } from '$lib/derived';
	import { toast } from '$lib/ui.svelte';
	import Modal from './Modal.svelte';
	import Field from './Field.svelte';
	import SelectField, { type Opt } from './SelectField.svelte';

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

	const PRIORITY: Opt[] = [
		{ value: 'high', label: '高' },
		{ value: 'normal', label: '標準' },
		{ value: 'low', label: '低' }
	];
	// 先頭の空の値で、一度選んだ関連先を外せるようにする
	const NONE: Opt = { value: '', label: '指定しない' };
	const people = $derived<Opt[]>([NONE, ...db.people.map((p) => ({ value: p.id, label: p.name }))]);
	const companies = $derived<Opt[]>([NONE, ...db.companies.map((c) => ({ value: c.id, label: c.name }))]);
	const projects = $derived<Opt[]>([NONE, ...db.projects.map((p) => ({ value: p.id, label: p.name }))]);

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
		const t = addTask(
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
		// 今登録した ToDo のログを id で引く。押された後に積まれたログには触らない
		const l = addLogOf(db, t.id)!;
		toast('ToDo を登録しました', { undo: () => undo(l.id) });
		reset();
		onclose();
	}

	function cancel() {
		reset();
		onclose();
	}
</script>

<Modal {open} title="新しい ToDo を追加" onclose={cancel}>
	<form id={formId} onsubmit={submit}>
		<Field label="タイトル" bind:value={title} required />
		<div class="row form-pair">
			<Field label="期限" type="date" bind:value={due} />
			<Field label="時刻" type="time" bind:value={time} />
		</div>
		<SelectField
			label="優先度"
			items={PRIORITY}
			value={priority}
			onchange={(v: Task['priority']) => (priority = v)}
		/>
		<SelectField label="関連人物" items={people} value={personId} onchange={(v: string) => (personId = v)} />
		<SelectField label="会社" items={companies} value={companyId} onchange={(v: string) => (companyId = v)} />
		<SelectField label="案件" items={projects} value={projectId} onchange={(v: string) => (projectId = v)} />
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


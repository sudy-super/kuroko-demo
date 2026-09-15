<script lang="ts">
	import type { Task } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { addTask, undo } from '$lib/actions';
	import { addLogOf } from '$lib/derived';
	import { toast } from '$lib/ui.svelte';
	import Modal from './Modal.svelte';
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


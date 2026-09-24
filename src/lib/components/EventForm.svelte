<script lang="ts">
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { createEvent, undo } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import { minutes, toHm } from '$lib/dates';
	import { conflicts, travelWarning } from '$lib/calendar';
	import Modal from './Modal.svelte';
	import Field from './Field.svelte';
	import SelectField, { type Opt } from './SelectField.svelte';

	let {
		open,
		initial,
		onclose
	}: {
		open: boolean;
		initial?: { date?: string; start?: string; end?: string; place?: string };
		onclose: () => void;
	} = $props();

	const formId = $props.id();

	const ONLINE: { value: '' | 'meet' | 'zoom'; label: string }[] = [
		{ value: '', label: 'なし' },
		{ value: 'meet', label: 'Meet' },
		{ value: 'zoom', label: 'Zoom' }
	];
	const REMIND: Opt[] = [
		{ value: '', label: '通知しない' },
		{ value: '10', label: '10 分前' },
		{ value: '30', label: '30 分前' },
		{ value: '60', label: '1 時間前' }
	];
	const BUFFER: Opt[] = [
		{ value: '', label: 'なし' },
		{ value: '15', label: '15 分' },
		{ value: '30', label: '30 分' }
	];
	const people = $derived<Opt[]>(db.people.map((p) => ({ value: p.id, label: p.name })));
	const companies = $derived<Opt[]>(db.companies.map((c) => ({ value: c.id, label: c.name })));
	const projects = $derived<Opt[]>(db.projects.map((p) => ({ value: p.id, label: p.name })));

	let title = $state('');
	let date = $state('');
	let start = $state('10:00');
	let end = $state('11:00');
	let personIds = $state<string[]>([]);
	let companyId = $state('');
	let projectId = $state('');
	let place = $state('');
	let online = $state<'' | 'meet' | 'zoom'>('');
	let remind = $state('');
	let bufferBefore = $state('');
	let bufferAfter = $state('');
	let purpose = $state('');
	let withMeeting = $state(false);

	/* 保存前の確認。'form' 以外の間は、上に警告のモーダルを重ねる */
	let stage = $state<'form' | 'conflict' | 'travel'>('form');
	let hit = $state<CalendarEvent[]>([]);
	let warn = $state<{ prev: CalendarEvent; gapMin: number } | null>(null);

	// 開いた回ごとに初期値へ戻す。閉じている間の書き換えは持ち越さない
	$effect(() => {
		if (!open) return;
		title = '';
		date = initial?.date ?? db.seededOn;
		start = initial?.start ?? '10:00';
		end = initial?.end ?? toHm(minutes(initial?.start ?? '10:00') + 60);
		personIds = [];
		companyId = projectId = '';
		place = initial?.place ?? '';
		online = '';
		remind = bufferBefore = bufferAfter = '';
		purpose = '';
		withMeeting = false;
		stage = 'form';
	});

	const slot = $derived({ date, start, end, place: place.trim() || undefined });
	const num = (v: string) => (v ? Number(v) : undefined);

	function save() {
		createEvent({
			title: title.trim(),
			date,
			// 画面の時刻欄は '09:00' を返す。シードと同じ '9:00' に正規化して持つ
			start: toHm(minutes(start)),
			end: toHm(minutes(end)),
			place: place.trim() || undefined,
			online: online || undefined,
			personIds,
			companyId: companyId || undefined,
			projectId: projectId || undefined,
			remind: num(remind),
			bufferBefore: num(bufferBefore),
			bufferAfter: num(bufferAfter),
			purpose: purpose.trim() || undefined,
			withMeeting
		});
		// createEvent が今積んだログを取り消す。押された後に積まれたログには触らない
		const l = db.logs[0];
		toast(withMeeting ? '予定と会議の準備を登録しました' : '予定を登録しました', {
			undo: () => undo(l.id)
		});
		onclose();
	}

	function checkTravel() {
		warn = travelWarning(db, slot);
		if (warn) stage = 'travel';
		else save();
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		hit = conflicts(db, slot);
		if (hit.length) stage = 'conflict';
		else checkTravel();
	}

	/** 30 分後ろへずらして前の予定との間隔を空ける。ずらすのは開始と終了の両方 */
	function addBuffer() {
		start = toHm(minutes(start) + 30);
		end = toHm(minutes(end) + 30);
		bufferBefore = '30';
		// ずらした先に別の予定があることがあるので、重なりを測り直す
		hit = conflicts(db, slot);
		if (hit.length) {
			stage = 'conflict';
			return;
		}
		stage = 'form';
		save();
	}
</script>

{#snippet range(e: CalendarEvent)}
	<div class="list-row">
		<span class="badge">{e.place ?? 'オンライン'}</span>
		<span class="tc-text">{e.title}</span>
		<span class="num muted">{e.start}〜{e.end}</span>
	</div>
{/snippet}

<Modal {open} title="新しい予定" onclose={() => (onclose(), (stage = 'form'))}>
	<form id={formId} onsubmit={submit}>
		<Field label="タイトル" bind:value={title} required />
		<Field label="日付" type="date" bind:value={date} required />
		<div class="row form-pair">
			<Field label="開始" type="time" bind:value={start} required />
			<Field label="終了" type="time" bind:value={end} required />
		</div>
		<SelectField
			label="参加者"
			items={people}
			value={personIds}
			multiple
			placeholder="選択しない"
			onchange={(v: string[]) => (personIds = v)}
		/>
		<SelectField label="会社" items={companies} value={companyId} onchange={(v: string) => (companyId = v)} />
		<SelectField label="案件" items={projects} value={projectId} onchange={(v: string) => (projectId = v)} />
		<Field label="場所" bind:value={place} placeholder="渋谷、品川 など" />
		<!-- 3 つから 1 つなので、部品を足さず素の radio に .chip の見た目を当てる -->
		<fieldset class="field cal-radio">
			<legend class="label">オンライン</legend>
			<div class="row">
				{#each ONLINE as o (o.value)}
					<label class="chip" class:on={online === o.value}>
						<input type="radio" class="sr-only" name="{formId}-online" value={o.value} bind:group={online} />
						{o.label}
					</label>
				{/each}
			</div>
		</fieldset>
		<SelectField
			label="リマインド"
			items={REMIND}
			value={remind}
			placeholder="通知しない"
			onchange={(v: string) => (remind = v)}
		/>
		<div class="row form-pair">
			<SelectField
				label="前のバッファ"
				items={BUFFER}
				value={bufferBefore}
				placeholder="なし"
				onchange={(v: string) => (bufferBefore = v)}
			/>
			<SelectField
				label="後のバッファ"
				items={BUFFER}
				value={bufferAfter}
				placeholder="なし"
				onchange={(v: string) => (bufferAfter = v)}
			/>
		</div>
		<Field label="会議目的" bind:value={purpose} placeholder="次回の打ち合わせ など" />
		<label class="row cal-switch">
			<input type="checkbox" role="switch" bind:checked={withMeeting} />
			<span>
				会議準備を作成する
				<span class="help">ON にすると会議と Brief を同時に作ります</span>
			</span>
		</label>
	</form>
	{#snippet actions()}
		<button class="btn pri" type="submit" form={formId}>登録</button>
		<button class="btn text" type="button" onclick={onclose}>キャンセル</button>
	{/snippet}
</Modal>

<Modal
	open={stage === 'conflict'}
	size="sm"
	title="同じ時間に予定があります"
	onclose={() => (stage = 'form')}
>
	{#each hit as e (e.id)}{@render range(e)}{/each}
	{#snippet actions()}
		<button class="btn pri" onclick={() => ((stage = 'form'), checkTravel())}>そのまま保存</button>
		<button class="btn text" onclick={() => (stage = 'form')}>時間を変える</button>
	{/snippet}
</Modal>

<Modal
	open={stage === 'travel'}
	size="sm"
	title="移動時間が足りない可能性があります"
	description={warn
		? `前の予定が${warn.prev.place}、次が${place}です。間の ${warn.gapMin} 分では厳しい可能性があります。`
		: undefined}
	onclose={() => (stage = 'form')}
>
	{#if warn}
		{@render range(warn.prev)}
		<div class="list-row">
			<span class="badge">{place}</span>
			<span class="tc-text">{title || '新しい予定'}</span>
			<span class="num muted">{start}〜{end}</span>
		</div>
	{/if}
	<!-- 仕様 5.2 — 3 つとも塗りなし。主操作はバッファの追加 -->
	{#snippet actions()}
		<button class="btn sec" onclick={addBuffer}>バッファを 30 分追加</button>
		<button class="btn text" onclick={() => ((stage = 'form'), save())}>このまま保存</button>
		<button class="btn text" onclick={() => (stage = 'form')}>キャンセル</button>
	{/snippet}
</Modal>

<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { RadioGroup } from 'bits-ui';
	import { db, installStorageSync } from '$lib/store.svelte';
	import { eventOf, personOf, linkUrl } from '$lib/derived';
	import { confirmSlot, changeSlot, cancelScheduling } from '$lib/actions';
	import { parse, fmtMDW } from '$lib/dates';
	import { icsFor } from '$lib/ics';
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';

	const token = $derived(page.params.token ?? '');
	const s = $derived(db.scheduling.find((x) => x.token === token));
	const person = $derived(personOf(db, s?.personId));
	const slots = $derived(s?.slots.filter((x) => x.selected) ?? []);
	const chosen = $derived(s?.slots.find((x) => x.id === s.chosenSlotId));
	const event = $derived(eventOf(db, s?.eventId));

	let value = $state('');
	// 候補が決まった時点 (sent への遷移) で一度だけ初期値を入れる。以後はユーザーの選択を尊重する
	let initedFor = $state('');
	$effect(() => {
		if (s?.status === 'sent' && initedFor !== s.token && slots.length) {
			value = slots[0].id;
			initedFor = s.token;
		}
	});

	let cancelOpen = $state(false);
	/* Task 18 修正ラウンド 1 (review-task-18.md C2) — 日時を変更して選び直すと event が
	   作り直される。作った URL を持ち続けると古い日時の .ics が落ちるので、event.id が
	   変わったら作り直す。使い終わった URL は必ず解放する */
	let icsUrl = $state('');
	let icsFor_ = $state('');
	$effect(() => {
		const id = event?.id ?? '';
		if (id === icsFor_) return;
		if (icsUrl) URL.revokeObjectURL(icsUrl);
		icsUrl = '';
		icsFor_ = id;
		if (!event || !person) return;
		icsUrl = URL.createObjectURL(
			new Blob([icsFor(event, `${person.name}様との打ち合わせ`)], { type: 'text/calendar' })
		);
	});

	function confirm() {
		if (!s || !value) return;
		confirmSlot(s.token, value);
	}

	function doCancel() {
		if (!s) return;
		cancelScheduling(s.token);
		cancelOpen = false;
	}

	onMount(() => {
		const off = installStorageSync();
		return () => {
			off();
			if (icsUrl) URL.revokeObjectURL(icsUrl);
		};
	});
</script>

<svelte:head><title>日程調整 — KUROKO AI</title></svelte:head>

{#if !s}
	<div class="public-main">
		<h1 class="in">このリンクは無効です</h1>
	</div>
{:else if s.status === 'cancelled'}
	<div class="public-main">
		<h1 class="in">この打ち合わせはキャンセルされました</h1>
	</div>
{:else if s.status === 'confirmed' && chosen && event}
	<div class="public-main">
		<Icon name="ic-check-c" size={40} class="in" />
		<h1 class="in" style="--delay: 60ms">日程が確定しました</h1>
	</div>
	<div class="sched-summary in" style="--delay: 110ms">
		<div class="list-row lg">
			<span class="tc-text">{fmtMDW(parse(chosen.date))} {chosen.start}〜{chosen.end}</span>
		</div>
		<div class="list-row lg">
			<span class="tc-text">{person?.name}様</span>
		</div>
		{#if event.url}
			<div class="list-row lg">
				<span class="badge">{event.online === 'zoom' ? 'Zoom' : 'Meet'}</span>
				<a class="tc-text" href={linkUrl(event.url)} target="_blank" rel="noreferrer">{event.url}</a>
			</div>
		{/if}
	</div>
	<div class="public-foot">
		<a class="btn pri public-cta in" style="--delay: 160ms" href={icsUrl} download="meeting.ics">
			<Icon name="ic-download" size={18} />カレンダーに追加
		</a>
		<button class="btn sec public-cta in" style="--delay: 200ms" onclick={() => changeSlot(s.token)}>
			日時を変更する
		</button>
		<button class="btn danger public-cta in" style="--delay: 240ms" onclick={() => (cancelOpen = true)}>
			キャンセルする
		</button>
		<p class="muted note in" style="--delay: 280ms">確定の内容はメールでもお送りしました</p>
	</div>
{:else if s.status === 'sent'}
	<div class="public-main">
		<h1 class="in">{person?.name}様</h1>
		<p class="muted in" style="--delay: 60ms">株式会社 KUROKO 佐々木健との打ち合わせ (60 分)</p>
		<p class="in" style="--delay: 100ms">以下からご都合の良い時間をお選びください</p>
	</div>
	<RadioGroup.Root bind:value class="sched-slots in" style="--delay: 150ms">
		{#each slots as slot (slot.id)}
			<RadioGroup.Item id="slot-{slot.id}" value={slot.id} class="list-row lg sched-slot">
				{#snippet children({ checked })}
					<span class="sched-radio" class:on={checked}></span>
					<span class="tc-text">{fmtMDW(parse(slot.date))} {slot.start}〜{slot.end}</span>
				{/snippet}
			</RadioGroup.Item>
		{/each}
	</RadioGroup.Root>
	<div class="public-foot">
		<button class="btn pri public-cta in" style="--delay: 200ms" aria-disabled={!value} onclick={confirm}>
			この日時で確定する
		</button>
		<p class="muted note in" style="--delay: 240ms">時刻は日本時間 (JST) です</p>
	</div>
{/if}

<Modal
	open={cancelOpen}
	title="キャンセルしますか?"
	description="この打ち合わせの日程調整をキャンセルします。相手にもキャンセル済みと表示されます。"
	size="sm"
	onclose={() => (cancelOpen = false)}
>
	{#snippet actions()}
		<button class="btn danger" onclick={doCancel}>キャンセルする</button>
		<button class="btn text" onclick={() => (cancelOpen = false)}>やめる</button>
	{/snippet}
</Modal>

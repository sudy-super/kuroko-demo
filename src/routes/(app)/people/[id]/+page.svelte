<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { companyOf, projectOf } from '$lib/derived';
	import { identitiesOf, personHistory, personStats } from '$lib/people';
	import { parse, rel, fmtMDW } from '$lib/dates';
	import { ui, toast } from '$lib/ui.svelte';
	import { updatePersonMemo } from '$lib/actions';
	import Icon from '$lib/components/Icon.svelte';
	import { glass, REGULAR } from '$lib/glass';

	const CHANNELS = [
		{ kind: 'email', label: 'Gmail', icon: 'b-gmail' },
		{ kind: 'slack_id', label: 'Slack', icon: 'b-slack' },
		{ kind: 'line_id', label: 'LINE', icon: 'b-line' }
	] as const;

	const id = $derived(page.params.id!);
	const person = $derived(db.people.find((p) => p.id === id));
	const company = $derived(companyOf(db, person?.companyId));
	const identities = $derived(person ? identitiesOf(db, person.id) : []);
	const projects = $derived(person ? person.projectIds.map((x) => projectOf(db, x)) : []);
	const history = $derived(person ? personHistory(db, person.id) : []);
	const stats = $derived(person ? personStats(db, person.id) : undefined);
	const documents = $derived(
		person
			? db.documents.filter(
					(d) => d.personId === person.id || (d.projectId && person.projectIds.includes(d.projectId))
				)
			: []
	);

	// 書きかけは人物ごとに持つ。別の人物へ移ったら id が合わなくなり、その人のメモに戻る
	let draft = $state({ id: '', text: '' });
	const memo = $derived(draft.id === id ? draft.text : (person?.memo ?? ''));
	const dirty = $derived(!!person && memo !== person.memo);

	function saveMemo() {
		if (!person) return;
		updatePersonMemo(person.id, memo);
		toast('メモを保存しました');
	}

	const day = (at: string) => `${rel(parse(at.slice(0, 10)), parse(db.seededOn))} ${at.slice(11, 16)}`;

	/** 依頼バーにこの人物の文脈を載せ、入力欄へ焦点を移す (仕様 5.5) */
	function ask() {
		if (!person) return;
		ui.context = { label: `${person.name}様について`, personId: person.id };
		document.querySelector<HTMLInputElement>('.chatbar input')?.focus();
	}
</script>

<svelte:head><title>{person?.name ?? '人物'} — KUROKO AI</title></svelte:head>

<div class="people">
	<header class="people-head">
		<a class="btn text sm people-back" href="/people">
			<Icon name="ic-left" size={18} />会社・人物・案件
		</a>
		{#if person}
			<div class="people-title">
				<h1>{person.name}</h1>
				<p class="muted">{person.kana}</p>
			</div>
			<button class="btn pri" onclick={ask}>
				<Icon name="ic-spark" size={20} />KUROKO に頼む
			</button>
		{:else}
			<div class="people-title"><h1>見つかりません</h1></div>
		{/if}
	</header>

	{#if !person}
		<p class="people-missing">この人物は登録されていません。</p>
	{:else}
		<div class="people-cards" {@attach glass({ ...REGULAR, targets: '.card' })}>
			<section class="card people-sec">
				<h2>基本情報</h2>
				<dl class="kv">
					<dt>会社</dt>
					<dd>
						{#if company}<a href="/companies/{company.id}">{company.name}</a>{:else}登録なし{/if}
					</dd>
					<dt>役職</dt>
					<dd>{person.title}</dd>
					<dt>電話</dt>
					<dd class="num">{person.phone ?? '登録なし'}</dd>
					<dt>最終商談</dt>
					<dd>{stats?.lastMeeting ? fmtMDW(parse(stats.lastMeeting)) : '記録なし'}</dd>
				</dl>
				{#if person.tags.length}
					<div class="row people-tagrow">
						{#each person.tags as t (t)}<span class="badge">{t}</span>{/each}
					</div>
				{/if}
			</section>

			<section class="card people-sec">
				<h2>連絡先</h2>
				{#each CHANNELS as ch (ch.kind)}
					{@const found = identities.find((i) => i.kind === ch.kind)}
					<div class="list-row">
						<Icon name={ch.icon} size={20} />
						{#if found}
							<span class="people-ident">{found.value}</span>
							<span class="badge src">{ch.label}</span>
						{:else}
							<span class="people-ident muted">{ch.label} 未連携</span>
						{/if}
					</div>
				{/each}
			</section>

			<section class="card people-sec">
				<h2>案件</h2>
				{#each projects as pj (pj?.id)}
					{#if pj}
						<a class="list-row" href="/projects/{pj.id}">
							<span class="people-ident">{pj.name}</span>
							<span class="badge">{pj.status}</span>
							<span class="num muted">{pj.amount}</span>
						</a>
					{/if}
				{/each}
				{#if !projects.length}<p class="muted">紐づく案件はありません</p>{/if}
			</section>

			<section class="card people-sec">
				<h2>最近のやりとり</h2>
				<p class="people-stat">メール {stats?.mails} 通 / 会議 {stats?.meetings} 件</p>
				{#each history.slice(0, 5) as h (h.href + h.at)}
					<a class="list-row" href={h.href}>
						<span class="badge src">{h.label}</span>
						<span class="people-ident">{h.title}</span>
						<span class="num muted">{day(h.at)}</span>
					</a>
				{/each}
				{#if !history.length}<p class="muted">やりとりの記録はありません</p>{/if}
				{#if history.length > 5}<p class="muted">残り {history.length - 5} 件</p>{/if}
			</section>

			<section class="card people-sec">
				<h2>メモ</h2>
				<textarea
					class="textarea"
					aria-label="メモ"
					rows="5"
					value={memo}
					oninput={(e) => (draft = { id: person.id, text: e.currentTarget.value })}
				></textarea>
				<div class="row people-memo-foot">
					<button class="btn pri sm" disabled={!dirty} onclick={saveMemo}>保存する</button>
					<button
						class="btn text sm"
						disabled={!dirty}
						onclick={() => (draft = { id: person.id, text: person.memo })}
					>
						書きかけを捨てる
					</button>
				</div>
			</section>

			<section class="card people-sec">
				<h2>関連資料</h2>
				{#each documents as d (d.id)}
					<a class="list-row" href="/documents/{d.id}">
						<span class="badge src">{d.kind}</span>
						<span class="people-ident">{d.title}</span>
					</a>
				{/each}
				{#if !documents.length}<p class="muted">関連する資料はありません</p>{/if}
			</section>
		</div>
	{/if}
</div>

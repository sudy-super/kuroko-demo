<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { companyOf, contactOf, personOf, projectOf } from '$lib/derived';
	import { identitiesOf, personHistory, personStats, HISTORY_ICON } from '$lib/people';
	import { parse, rel, fmtMDW } from '$lib/dates';
	import { ui, toast, focusChatbar } from '$lib/ui.svelte';
	import { updatePersonMemo } from '$lib/actions';
	import Icon from '$lib/components/Icon.svelte';
	import ListSection from '$lib/components/ListSection.svelte';
	import Tip from '$lib/components/Tip.svelte';
	import ProjectStatusIcon from '$lib/components/ProjectStatusIcon.svelte';
	import DocKindIcon from '$lib/components/DocKindIcon.svelte';

	const CHANNELS = [
		{ kind: 'email', label: 'Gmail', icon: 'b-gmail' },
		{ kind: 'slack_id', label: 'Slack', icon: 'b-slack' },
		{ kind: 'line_id', label: 'LINE', icon: 'b-line' }
	] as const;

	const id = $derived(page.params.id!);
	const person = $derived(personOf(db, id));
	const company = $derived(companyOf(db, person?.companyId));
	const identities = $derived(person ? identitiesOf(db, person.id) : []);
	const projects = $derived(
		person ? person.projectIds.map((x) => projectOf(db, x)).filter((x) => !!x) : []
	);
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
		focusChatbar();
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
		<!-- Task 10w — HIG 上ガラスを持たないコンテンツ層なので、Task 10c のガラス (glass()) を外して
		     普通のカードの面 (.card) に戻した (glass-scope.md 6 節) -->
		<div class="people-cards">
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
						<!-- 人物のタグは分類 (Atlassian の Tag) なので、状態の Lozenge とは見た目を分ける (audit 4) -->
						{#each person.tags as t (t)}<span class="badge tag">{t}</span>{/each}
					</div>
				{/if}
			</section>

			<section class="card people-sec">
				<h2>連絡先</h2>
				{#each CHANNELS as ch (ch.kind)}
					{@const found = identities.find((i) => i.kind === ch.kind)}
					<div class="list-row">
						{#if found}
							<!-- indicators.md 結論 2 — 出所はブランドの記号 1 個と aria-label にとどめ、
							     同じ意味の文字バッジを右端に重ねない (audit 5) -->
							<Tip text="{ch.label} の連絡先" name={ch.icon} size={20} />
							<!-- メール以外は内部の ID を出さない (derived.ts の contactOf) -->
							<span class="people-ident">{contactOf(found)}</span>
						{:else}
							<!-- 文言側に名前が出るので、こちらの記号は飾りのままにする -->
							<Icon name={ch.icon} size={20} />
							<span class="people-ident muted">{ch.label} 未連携</span>
						{/if}
					</div>
				{/each}
			</section>

			<ListSection title="案件" items={projects} key={(pj) => pj.id} empty="紐づく案件はありません">
				{#snippet row(pj)}
					<a class="list-row" href="/projects/{pj.id}">
						<span class="people-ident">{pj.name}</span>
						<ProjectStatusIcon status={pj.status} />
						<span class="num muted">{pj.amount}</span>
					</a>
				{/snippet}
			</ListSection>

			<ListSection title="最近のやりとり" items={history} key={(h) => h.href + h.at} empty="やりとりの記録はありません">
				{#snippet head()}
					<p class="people-stat">メール {stats?.mails} 通 / 会議 {stats?.meetings} 件</p>
				{/snippet}
				{#snippet row(h)}
					<a class="list-row" href={h.href}>
						<Tip text={h.label} name={HISTORY_ICON[h.kind]} size={20} class="ph-history-icon" />
						<span class="people-ident">{h.title}</span>
						<span class="num muted">{day(h.at)}</span>
					</a>
				{/snippet}
			</ListSection>

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
					<!-- この画面の塗りの主ボタンは見出しの「KUROKO に頼む」なので、メモの保存は副ボタン -->
					<button class="btn sec sm" disabled={!dirty} onclick={saveMemo}>保存する</button>
					<button
						class="btn text sm"
						disabled={!dirty}
						onclick={() => (draft = { id: person.id, text: person.memo })}
					>
						書きかけを捨てる
					</button>
				</div>
			</section>

			<ListSection title="関連資料" items={documents} key={(d) => d.id} empty="関連する資料はありません">
				{#snippet row(d)}
					<a class="list-row" href="/documents?d={d.id}">
						<DocKindIcon kind={d.kind} />
						<span class="people-ident">{d.title}</span>
					</a>
				{/snippet}
			</ListSection>
		</div>
	{/if}
</div>

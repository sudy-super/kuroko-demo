<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { companyOf, contactOf, identityOf, personOfIdentity, projectOf, projectStatusClass } from '$lib/derived';
	import { identitiesOf, personStats } from '$lib/people';
	import { parse, fmtMDW } from '$lib/dates';
	import Icon from './Icon.svelte';
	import OcrFlow from './OcrFlow.svelte';

	/** compact は狭い場所 (メールのスレッドの頭) 向け。メモと実績を落として身元だけ出す。
	    headingLevel — 人物名の見出しレベルは置かれる場所によって正しい階層が変わるので
	    呼び出し側から渡す (rereview-task-10p.md 新規 1)。デスクトップの右欄は <h1>Inbox</h1>
	    の下なので既定の 2、Drawer のシートは題名の <h3> の下なので 4 を渡す */
	let {
		identityId,
		compact = false,
		headingLevel = 2
	}: { identityId: string; compact?: boolean; headingLevel?: 2 | 4 } = $props();

	let addOpen = $state(false);

	const identity = $derived(identityOf(db, identityId));
	const person = $derived(personOfIdentity(db, identityId));
	const company = $derived(companyOf(db, person?.companyId));
	/* 連絡先はその人のメールを優先する。メールを持たない相手 (社内は slack_id / line_id しか
	   持たない — seed.ts) の表し方は derived.ts の contactOf に閉じる (内部の ID は出さない) */
	const contact = $derived.by(() => {
		const idn = person ? (identitiesOf(db, person.id).find((i) => i.kind === 'email') ?? identity) : identity;
		return idn && contactOf(idn);
	});
	const projects = $derived(
		person ? person.projectIds.map((x) => projectOf(db, x)).filter((x) => !!x) : []
	);
	const stats = $derived(person ? personStats(db, person.id) : undefined);
</script>

<aside class="card person-panel" aria-label="差出人の情報">
	{#if person}
		<svelte:element this={`h${headingLevel}`} class="pp-name">{person.name}</svelte:element>
		<p class="muted">{company?.name ?? '会社の登録なし'} {person.title}</p>
		<p class="pp-mail">{contact}</p>

		{#each projects as pj (pj.id)}
			<a class="list-row" href="/projects/{pj.id}">
				<span class="people-ident">{pj.name}</span>
				<span class="badge {projectStatusClass(pj.status)}">{pj.status}</span>
				<span class="num muted">{pj.amount}</span>
			</a>
		{/each}

		{#if !compact}
			<dl class="kv pp-stats">
				<dt>最終商談</dt>
				<dd>{stats?.lastMeeting ? fmtMDW(parse(stats.lastMeeting)) : '記録なし'}</dd>
				<dt>メール</dt>
				<dd class="num">{stats?.mails} 通</dd>
				<dt>会議</dt>
				<dd class="num">{stats?.meetings} 件</dd>
			</dl>
			{#if person.memo}<p class="pp-memo">{person.memo}</p>{/if}
		{/if}

		<a class="btn sec sm" href="/people/{person.id}">プロフィールを開く</a>
	{:else}
		<svelte:element this={`h${headingLevel}`} class="pp-name"
			>{identity?.value ?? '不明な差出人'}</svelte:element
		>
		<p class="muted">この方はまだ登録されていません</p>
		<!-- 同じ画面に出る ReplyBox の「採用」が塗りの主ボタンなので、こちらは副ボタン
		     (buttons.md 観点 A 原則 3) -->
		<button class="btn sec sm" onclick={() => (addOpen = true)}>
			<Icon name="ic-plus" size={18} />人物に追加
		</button>
	{/if}
</aside>

<!-- 名刺と同じ確認画面を、差出人のメールアドレスで段階 2 から開く -->
<OcrFlow
	open={addOpen}
	onclose={() => (addOpen = false)}
	from={identity ? { email: identity.value } : undefined}
	origin="inbox"
/>

<script lang="ts">
	import type { CardFields, MessageThread, Origin } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { addPerson, linkIdentity, createProjectFor } from '$lib/actions';
	import { identityOf, pendingThreadsFor } from '$lib/derived';
	import { integrations } from '$lib/integrations';
	import { toast } from '$lib/ui.svelte';
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';

	let {
		open,
		onclose,
		from,
		origin = 'people'
	}: {
		open: boolean;
		onclose: () => void;
		/** Inbox の未登録パネルから開くとき。画像を選ばせず段階 2 から始める */
		from?: { email: string };
		origin?: Origin;
	} = $props();

	const formId = $props.id();

	/** 入力欄の並び。lowConfidence の判定と読み上げの結び付けを 1 か所で回す */
	const FIELDS: { key: keyof CardFields; label: string; type?: string }[] = [
		{ key: 'name', label: '氏名' },
		{ key: 'kana', label: 'ふりがな' },
		{ key: 'company', label: '会社名' },
		{ key: 'title', label: '役職' },
		{ key: 'email', label: 'メールアドレス', type: 'email' },
		{ key: 'phone', label: '電話番号', type: 'tel' }
	];
	const BLANK: CardFields = { name: '', kana: '', company: '', title: '', email: '', phone: '', lowConfidence: [] };

	/** 控えと編集中の値を別の実体にする。$state の proxy を共有すると控えまで書き換わる */
	const copy = (c: CardFields): CardFields => ({ ...c, lowConfidence: [...c.lowConfidence] });

	let stage = $state<'pick' | 'scan' | 'confirm' | 'done'>('pick');
	let fields = $state<CardFields>({ ...BLANK });
	/** KUROKO が出した元の値。人が直した後も戻せるように控える (軸 2 原則 10) */
	let aiFields = $state<CardFields>({ ...BLANK });
	let preview = $state('');
	let error = $state('');
	let personId = $state('');
	let linked = $state(false);
	let projected = $state(false);

	const source = $derived(from ? 'メールの本文' : '名刺の画像');
	/* 電話番号のように確信度の低い項目だけに付ける印 (軸 2)。利用者が直した項目は
	   AI の値ではなくなるので外す (Carbon「手で書き換えたら通常の部品に戻す」) */
	const low = (k: keyof CardFields) => fields.lowConfidence.includes(k as string);
	/* 戻すボタンを出すかどうか。控えが全部空のとき (読み取りに失敗して手で入力する場合)は
	   戻す先が無い。要確認の印も比べるのは、人が元と同じ値を打ち直したときに印だけ
	   消えたまま戻せなくなるのを防ぐため */
	const edited = $derived(
		FIELDS.some((f) => aiFields[f.key] !== '') &&
			(fields.lowConfidence.length !== aiFields.lowConfidence.length ||
				FIELDS.some((f) => fields[f.key] !== aiFields[f.key]))
	);

	/** 関連付けの候補。メールアドレスが一致する、まだ人物に結び付いていないスレッド */
	let pending = $state<MessageThread[]>([]);
	const identity = $derived(
		db.identities.find((i) => i.kind === 'email' && i.value === fields.email && !i.personId)
	);
	/* 役職からの推定。デモの範囲の当て推量なので、提案として出すだけで勝手には作らない */
	const projectName = $derived(
		`${fields.company.replace(/^(株式会社|合同会社|有限会社)/, '')}社 ${fields.title.replace('担当', '支援')}`
	);

	// 開いた回ごとに初めからやり直す。閉じている間の書き換えは持ち越さない
	$effect(() => {
		if (!open) return;
		// 読むと書くが同じ状態になって $effect が自分を呼び戻すので、一度 local に取る
		const scanned = from ? guessFrom(from.email) : { ...BLANK };
		aiFields = scanned;
		fields = copy(scanned);
		stage = from ? 'confirm' : 'pick';
		preview = error = personId = '';
		linked = projected = false;
		pending = [];
	});

	// 選んだ画像の URL は使い終わったら必ず解放する
	$effect(() => () => preview && URL.revokeObjectURL(preview));

	/** 差出人のメールから埋められる範囲。氏名は本文の署名 (「〜の鈴木です」)からの推定 */
	function guessFrom(email: string): CardFields {
		const ids = db.threads.filter((t) => identityOf(db, t.identityId)?.value === email).map((t) => t.id);
		const body = db.messages.find((m) => m.from === 'them' && ids.includes(m.threadId))?.body ?? '';
		const name = body.match(/の([^\s、。]{1,6})です/)?.[1] ?? '';
		return {
			...BLANK,
			name,
			// ドメインの一致は推定ではないので確信度の印を付けない
			company: db.companies.find((c) => c.domain === email.split('@')[1])?.name ?? '',
			email,
			lowConfidence: name ? ['name'] : []
		};
	}

	async function pick(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		preview = URL.createObjectURL(file);
		stage = 'scan';
		let scanned: CardFields;
		try {
			scanned = await integrations.ocr.scanBusinessCard(file);
		} catch {
			// 読み取れなくても手で入力する道を残す (HIG Limitations)
			scanned = { ...BLANK };
			error = '名刺を読み取れませんでした。お手数ですが、内容を手で入力してください。';
		}
		aiFields = scanned;
		fields = copy(scanned);
		stage = 'confirm';
	}

	/* 手直しが効いたことをはっきり示す (HIG — provide a clear signal that their action had an effect)。
	   戻すと要確認の印も控えのものに復活する */
	function revert() {
		fields = copy(aiFields);
		toast('読み取った内容に戻しました');
	}

	/* エラーは送信時にだけ出す。一次資料は割れており (GOV.UK は送信時、Carbon は焦点が
	   外れた直後)、この製品の判断として打ち終える前に叱らない GOV.UK 側を採った */
	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!fields.name.trim()) {
			error = '氏名を入力してください。名刺に載っている読み方のままで構いません。';
			return;
		}
		error = '';
		pending = pendingThreadsFor(db, fields.email);
		personId = addPerson({ ...fields, name: fields.name.trim() }, origin).id;
		stage = 'done';
	}

	function link() {
		if (!identity) return;
		linkIdentity(identity.id, personId);
		linked = true;
		toast(`過去のメール ${pending.length} 件を関連付けました`);
	}

	function project() {
		createProjectFor(personId, projectName);
		projected = true;
		toast(`案件「${projectName}」を作成しました`);
	}
</script>

<Modal
	{open}
	title={stage === 'done' ? '登録しました' : from ? '人物に追加' : '名刺から追加'}
	size={stage === 'confirm' ? 'md' : 'sm'}
	{onclose}
>
	{#if stage === 'pick'}
		<p>名刺の画像を選ぶと、KUROKO が氏名・会社・連絡先を読み取ります。</p>
		<!-- GOV.UK File upload の改良版と同じ構成。accept を働かせるため素の input を土台に
		     残し、その上に見た目をかぶせる -->
		<label class="btn sec ocr-pick">
			<Icon name="ic-cam" size={20} />画像を選ぶ
			<input class="sr-only" type="file" accept="image/*" onchange={pick} />
		</label>
	{:else if stage === 'scan'}
		<div class="ocr-scan">
			{#if preview}<img class="ocr-img" src={preview} alt="選んだ名刺" />{/if}
			<!-- HIG — 「処理中…」ではなく何をしているかを書く -->
			<p aria-live="polite"><Icon name="ic-spark" size={20} />名刺を読み取っています</p>
		</div>
	{:else if stage === 'confirm'}
		<!-- 軸 1: AI が読み取ったものであることの表示。確信度によらず画面に 1 回 (Carbon)。
		     読み上げソフトは <form> に入ると入力部品しか読まないので form の外に置く (W3C) -->
		<p class="ocr-ai"><Icon name="ic-spark" size={20} />
			この内容は{source}から KUROKO が読み取りました。誤りがあれば、そのまま直せます。</p>
		<p class="help ocr-note">氏名だけは必ず入力してください。ほかは空のままでも登録できます。</p>
		{#if preview}<img class="ocr-img" src={preview} alt="選んだ名刺" />{/if}
		{#if error}<p class="error" role="alert"><Icon name="ic-alert" size={16} />{error}</p>{/if}
		<form id={formId} onsubmit={submit} novalidate>
			{#each FIELDS as f (f.key)}
				<div class="field">
					<label class="label" for="{formId}-{f.key}">
						{f.label}
						<!-- GOV.UK は必須の星印を禁じるので語で示す。任意の側に語を添えるかは
						     一次資料が割れており、印の数を減らす製品の判断として上の 1 文にまとめた -->
						{#if f.key === 'name'}<span class="ocr-req">必須</span>{/if}
						<!-- 軸 2: 確信度の低い項目だけ。色だけに頼らないようアイコンと文言を併せる
						     (WCAG 1.4.1)。検証の失敗ではないので aria-invalid は使わない (ARIA21) -->
						{#if low(f.key)}<span class="badge warn"><Icon name="ic-alert" size={12} />要確認</span>{/if}
					</label>
					<input
						class="input"
						class:low={low(f.key)}
						id="{formId}-{f.key}"
						type={f.type ?? 'text'}
						aria-describedby={low(f.key) ? `${formId}-${f.key}-low` : undefined}
						bind:value={fields[f.key] as string}
						oninput={() => (fields.lowConfidence = fields.lowConfidence.filter((k) => k !== f.key))}
					/>
					{#if low(f.key)}
						<p class="help ocr-low" id="{formId}-{f.key}-low">
							読み取りの確信度が低い項目です。{source}と見比べてください。
						</p>
					{/if}
				</div>
			{/each}
		</form>
		<!-- 軸 2 原則 10: 書き換えた後も元の読み取り結果に戻せる道を残す (Carbon revert to AI)。
		     form の外なので読み上げソフトのフォームモードに埋もれない (W3C)。登録ボタンの直前に
		     置くと、直し終えて下まで送ったところに必ず入る。この段階の塗りの主ボタンは
		     「確認して登録」だけなので、枠だけの .sec にする (buttons.md 観点 A) -->
		{#if edited}
			<button class="btn sec sm" type="button" onclick={revert}>
				<Icon name="ic-undo" size={16} />読み取った内容に戻す
			</button>
		{/if}
	{:else}
		<p class="ocr-ai"><Icon name="ic-check-c" size={20} />{fields.name} さんを登録しました</p>
		<!-- 確からしい順。メールアドレスの一致は確実、案件の名前は役職からの推定 -->
		{#if pending.length && !linked}
			<section class="ocr-sg" aria-label="過去のメールの関連付け">
				<p>このメールアドレスからの過去のメールが {pending.length} 件見つかりました。関連付けますか?</p>
				{#each pending as t (t.id)}
					<div class="list-row"><span class="tc-text">{t.subject}</span></div>
				{/each}
				<div class="row">
					<button class="btn sec" onclick={link}>関連付ける</button>
					<button class="btn text" onclick={() => (pending = [])}>あとで</button>
				</div>
			</section>
		{/if}
		{#if fields.company && !projected}
			<section class="ocr-sg" aria-label="案件の作成">
				<p>案件「{projectName}」を作成して紐づけますか?</p>
				<div class="row">
					<button class="btn sec" onclick={project}>紐づける</button>
					<button class="btn text" onclick={() => (projected = true)}>あとで</button>
				</div>
			</section>
		{/if}
	{/if}

	{#snippet actions()}
		{#if stage === 'confirm'}
			<button class="btn pri" type="submit" form={formId}>確認して登録</button>
			<button class="btn text" type="button" onclick={onclose}>キャンセル</button>
		{:else if stage === 'done'}
			<button class="btn pri" onclick={onclose}>完了</button>
		{:else}
			<button class="btn text" onclick={onclose}>キャンセル</button>
		{/if}
	{/snippet}
</Modal>

<style>
	/* 土台の input は sr-only なので、焦点の輪はかぶせた見た目の側に出す */
	.ocr-pick:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.ocr-ai,
	.ocr-scan p {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin-bottom: var(--sp-3);
		color: var(--ink-2);
	}
	.ocr-ai :global(svg) {
		flex: none;
		color: var(--accent);
	}
	.ocr-note {
		margin-bottom: var(--sp-5);
	}
	.ocr-img {
		display: block;
		width: 100%;
		max-height: 160px;
		margin-bottom: var(--sp-5);
		object-fit: contain;
		border-radius: var(--r-s);
		background: var(--disabled-soft);
	}
	.label {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	/* 「必須」は語で示す。バッジにすると要確認の印と強さが並んでしまう */
	.ocr-req {
		font-weight: 400;
		color: var(--ink-3);
	}
	/* 枠の強調は .input.bad (赤 = 危険)ではなく .badge.warn と同じ橙。
	   確信度が低いことは誤りではないので、強さを一段落とす (indicators.md) */
	.input.low {
		border-color: #ba4e00;
		box-shadow: inset 0 0 0 1px #ba4e00;
	}
	.ocr-low {
		margin-top: var(--sp-2);
		margin-bottom: 0;
	}
	.ocr-sg {
		margin-top: var(--sp-5);
		padding-top: var(--sp-5);
		border-top: 1px solid var(--border);
	}
	.ocr-sg .row {
		flex-wrap: wrap;
		margin-top: var(--sp-3);
	}
</style>

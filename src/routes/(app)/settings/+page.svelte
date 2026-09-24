<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { db } from '$lib/store.svelte';
	import { setAutomation, toggleConnection } from '$lib/actions';
	import { CONNECT_NAME, CONNECT_BENEFIT } from '$lib/connect';
	import { ui, toast } from '$lib/ui.svelte';
	import type { Automation, Connection } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';

	// /people /tasks と同じチップのタブ (components 3.6)
	const TABS = [
		{ key: 'connect', label: '連携', icon: 'ic-link' },
		{ key: 'auto', label: '自動化レベル', icon: 'ic-bolt' },
		{ key: 'data', label: 'セキュリティとデータ', icon: 'ic-shield' }
	] as const;
	let tab: (typeof TABS)[number]['key'] = $state('connect');

	const LEVELS: { key: Automation; label: string; desc: string }[] = [
		{
			key: 'draft',
			label: '下書きまで',
			desc: 'KUROKO は下書きを作って止まります。実行はすべて確認してから進めます。'
		},
		{
			key: 'internal_auto',
			label: '社内は自動、社外は確認する',
			desc: '社内の共有や登録は自動で進めます。社外へ出るものは必ず確認します。'
		},
		{
			key: 'trusted',
			label: 'ほぼ任せる',
			desc: '確認の要らない操作は KUROKO が進めます。社外へ出る 8 つは、この設定でも確認します。'
		}
	];

	/* 仕様 5.13 — 設定にかかわらず必ず確認する操作 */
	const ALWAYS = [
		'メール送信',
		'Slack 送信',
		'LINE 送信',
		'日程確定',
		'外部共有',
		'請求',
		'購入',
		'予約'
	];

	/* 自動で実行するかどうかの境目は actions.ts の autoExecutes が決めている。
	   社外送信は常に確認し、それ以外は「下書きまで」を外したときだけ自動になる。
	   ここはその判定の表示側で、判定そのものを持たない */
	const runsAuto = (level: Automation) => level !== 'draft';
	const CHANGING = ['アジェンダの社内共有', '議事録の社内共有', 'ToDo の登録'];

	/** 適用前に見せる確認。null の間はモーダルを出さない */
	let pending: Automation | null = $state(null);
	const target = $derived(LEVELS.find((l) => l.key === pending));
	const flips = $derived(!!pending && runsAuto(pending) !== runsAuto(db.settings.automation));
	// 変わるときは移り先を矢印で、変わらないときは今の扱いをそのまま出す
	const arrow = $derived(
		pending && runsAuto(pending) ? (flips ? '確認 → 自動' : '自動') : flips ? '自動 → 確認' : '確認'
	);

	function apply() {
		if (!pending) return;
		setAutomation(pending);
		toast(`自動化レベルを「${target?.label}」にしました`);
		pending = null;
	}

	/** 仕様 5.13 — どのサービスが正本を持つか */
	const SOURCE_OF_TRUTH: [string, string][] = [
		['予定', 'Google カレンダー'],
		['メール', 'Gmail'],
		['チャット', 'Slack / LINE'],
		['人物・会社・案件', 'KUROKO'],
		['ToDo', 'KUROKO'],
		['会議', 'KUROKO']
	];

	const retention = $derived(db.settings.retention);
	const DATA = $derived<[string, string][]>([
		['メール本文の保存', retention.saveMailBody ? '保存します' : '保存しません'],
		['文字起こしの保持期間', `${retention.transcriptMonths} か月で自動削除`],
		['学習利用', retention.learning ? '行います' : '行いません'],
		['保存場所', retention.region]
	]);

	const sync = (c: Connection) => (c.lastSync ? `最終同期 ${c.lastSync.slice(11, 16)}` : '');
</script>

<svelte:head><title>設定 — KUROKO AI</title></svelte:head>

<div class="settings">
	<header class="page-head">
		<div class="page-title">
			<h1>設定</h1>
			<p class="page-desc">連携するサービス、どこまで任せるか、データの扱いを確認します。</p>
		</div>
	</header>

	<div class="row set-tabs" role="group" aria-label="設定の切り替え">
		{#each TABS as t (t.key)}
			<button
				class="chip"
				class:on={tab === t.key}
				aria-pressed={tab === t.key}
				onclick={() => (tab = t.key)}
			>
				{t.label}
			</button>
		{/each}
	</div>

	{#if tab === 'connect'}
		<div class="set-panes">
			<section class="card set-list" aria-labelledby="set-conn-head">
				<h2 class="list-head" id="set-conn-head"><Icon name="ic-link" size={16} />連携</h2>
				{#each db.settings.connections as c (c.id)}
					<div class="list-row set-row">
						<Icon name="b-{c.id}" size={24} />
						<span class="people-col">
							<span class="set-name">{CONNECT_NAME[c.id]}</span>
							<span class="set-meta">
								<!-- indicators.md 5 — 形の違うアイコン + 文言 + 色の 3 つで示す。
								     色だけでは接続済みと未接続を分けない (WCAG 1.4.1) -->
								<Icon
									name={c.connected ? 'ic-check-c' : 'ic-x-c'}
									size={16}
									label={c.connected ? '接続済み' : '未接続'}
									class={c.connected ? 'set-on' : 'set-off'}
								/>
								{c.connected ? '接続済み' : '未接続'}
								<span class="sub">{c.connected ? sync(c) : CONNECT_BENEFIT[c.id]}</span>
							</span>
						</span>
						<!-- buttons.md 観点 A 原則 3 — 繰り返される行に塗りの主ボタンは置かない
						     (Carbon「Ghost buttons in productive cards」) -->
						<button class="btn sm sec" onclick={() => toggleConnection(c.id)}>
							{c.connected ? '解除' : '接続'}
						</button>
					</div>
				{/each}
			</section>

			<section class="card set-truth" aria-labelledby="set-truth-head">
				<h2 class="list-head" id="set-truth-head"><Icon name="ic-db" size={16} />データの正本</h2>
				<dl class="kv">
					{#each SOURCE_OF_TRUTH as [what, where] (what)}
						<dt>{what}</dt>
						<dd>{where}</dd>
					{/each}
				</dl>
				<p class="muted set-note">
					予定とメールの正本は各サービスにあります。KUROKO は読み書きするだけで、勝手に持ち出しません。
				</p>
			</section>
		</div>
	{:else if tab === 'auto'}
		<div class="set-panes">
			<section aria-labelledby="set-auto-head">
				<h2 class="list-head" id="set-auto-head"><Icon name="ic-bolt" size={16} />どこまで任せるか</h2>
				<!-- /schedule と同じ RadioGroup。選んだ瞬間には変えず、確認のモーダルを開く。
				     値は db のものだけを写す (関数の bind)。setter が書かないので、「やめる」で
				     閉じたときに印だけ動いたまま残らない -->
				<RadioGroup.Root
					bind:value={
						() => db.settings.automation,
						(v) => {
							if (v !== db.settings.automation) pending = v as Automation;
						}
					}
					class="set-levels"
				>
					{#each LEVELS as l (l.key)}
						<RadioGroup.Item id="lv-{l.key}" value={l.key} class="card set-level">
							{#snippet children({ checked })}
								<span class="sched-radio" class:on={checked}></span>
								<span class="set-level-text">
									<span class="set-name">
										{l.label}
										{#if l.key === 'internal_auto'}<span class="badge">既定</span>{/if}
									</span>
									<span class="sub">{l.desc}</span>
								</span>
							{/snippet}
						</RadioGroup.Item>
					{/each}
				</RadioGroup.Root>
			</section>

			<section class="card set-always" aria-labelledby="set-always-head">
				<h2 class="list-head" id="set-always-head">
					<Icon name="ic-lock" size={16} />必ず確認が必要な操作
				</h2>
				<p class="muted set-note">どの設定でも、この 8 つは KUROKO が勝手に実行しません。</p>
				<ul class="set-always-list">
					{#each ALWAYS as a (a)}
						<li><Icon name="ic-check-c" size={16} class="set-on" />{a}</li>
					{/each}
				</ul>
			</section>
		</div>
	{:else}
		<!-- 計画 Task 27 — このタブは表示のみ。押せる要素を置かない -->
		<section class="card set-data" aria-labelledby="set-data-head">
			<h2 class="list-head" id="set-data-head">
				<Icon name="ic-shield" size={16} />セキュリティとデータ
			</h2>
			<dl class="kv">
				{#each DATA as [what, how] (what)}
					<dt>{what}</dt>
					<dd>{how}</dd>
				{/each}
			</dl>
		</section>
	{/if}

	<!-- 取り返しのつかない操作なので独立した色と具体的な動詞で出す (buttons.md 観点 A 原則 6)。
	     確かめる問いは上部バーの「デモの操作」と同じ 1 枚 (DemoMenu の Modal)を開く -->
	<div class="set-foot">
		<button class="btn danger" onclick={() => (ui.demoReset = true)}>デモをリセット</button>
		<p class="muted set-note">初期状態に戻し、Welcome 画面へ戻ります。</p>
	</div>
</div>

<Modal
	open={!!pending}
	title="この設定に変えると"
	description={flips
		? `「${target?.label}」に変えます。変わる操作と変わらない操作を確かめてください。`
		: `「${target?.label}」に変えます。社内の扱いは今と同じで、社外へ出るものは変わりません。`}
	onclose={() => (pending = null)}
>
	<div class="set-diff">
		<section aria-labelledby="set-diff-a">
			<h4 id="set-diff-a">{flips ? '変わる操作' : '変わらない操作 (社内)'}</h4>
			{#if flips}
				<ul>
					{#each CHANGING as c (c)}
						<li><span class="tc-text">{c}</span><span class="badge warn">{arrow}</span></li>
					{/each}
				</ul>
			{:else}
				<!-- 社外以外を自動で進める点は「社内は自動」と「ほぼ任せる」で同じなので、
				     ここは実際に変わらない (actions.ts の autoExecutes)。空欄にせず、
				     何がそのままなのかを書く -->
				<ul>
					{#each CHANGING as c (c)}
						<li><span class="tc-text">{c}</span><span class="badge">今のまま {arrow}</span></li>
					{/each}
				</ul>
				<p class="muted">
					この操作は今も同じ扱いです。社外へ出るものは、どの設定でも必ず確認します。
				</p>
			{/if}
		</section>
		<section aria-labelledby="set-diff-b">
			<h4 id="set-diff-b">変わらない操作 (社外)</h4>
			<ul>
				{#each ALWAYS as a (a)}
					<li><span class="tc-text">{a}</span><span class="badge">常に確認</span></li>
				{/each}
			</ul>
		</section>
	</div>
	{#snippet actions()}
		<button class="btn pri" onclick={apply}>この設定にする</button>
		<button class="btn text" onclick={() => (pending = null)}>やめる</button>
	{/snippet}
</Modal>

<style>
	.set-tabs {
		flex-wrap: wrap;
		gap: var(--sp-2);
		padding: 0 var(--sp-5) var(--sp-4);
	}
	/* 連携と正本、レベルと必ず確認の 2 列。960px 以下は 1 列に落ちる */
	.set-panes {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		align-items: start;
		gap: var(--sp-4);
		padding: 0 var(--sp-5);
	}
	.set-list {
		padding-inline: var(--sp-5);
		padding-block: var(--sp-2);
	}
	/* 名前・状態・説明が 2 段で入る。高さを 48px に固定したままだと、狭い幅で折り返した
	   中身が次の行に重なるので、行の高さは中身に追従させる */
	.set-row {
		height: auto;
		padding-block: var(--sp-3);
		cursor: default;
	}
	.set-row:hover {
		background: none;
	}
	.set-name {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sp-2);
		font-weight: 500;
	}
	/* 状態と説明は 1 行に流す。狭い幅では説明だけが次の行に落ちる */
	.set-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0 var(--sp-2);
		min-width: 0;
		color: var(--ink-2);
		font-size: 14px;
	}
	.set-row .sub {
		color: var(--ink-3);
		font-size: 14px;
	}
	.settings :global(.set-on) {
		color: var(--ok);
	}
	.settings :global(.set-off) {
		color: var(--ink-3);
	}
	.set-note {
		margin-top: var(--sp-3);
		font-size: 14px;
		line-height: 1.7;
	}
	.set-truth .kv,
	.set-data .kv {
		margin-top: var(--sp-2);
	}
	/* 1 枚しか無いので、2 列のときの連携側と同じ幅で止める (幅いっぱいだと値が遠くなる) */
	.set-data {
		max-width: 680px;
		margin: 0 var(--sp-5);
	}
	.settings :global(.set-levels) {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.settings :global(.set-level) {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-3);
		width: 100%;
		border: 0;
		padding: var(--sp-4) var(--sp-5);
		text-align: left;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.settings :global(.set-level:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.settings :global(.set-level .sched-radio) {
		margin-top: 2px;
	}
	.set-level-text {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.set-level-text .sub {
		color: var(--ink-2);
		font-size: 14px;
		line-height: 1.7;
	}
	.set-always-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--sp-2) var(--sp-4);
		margin: var(--sp-3) 0 0;
		padding: 0;
		list-style: none;
	}
	.set-always-list li {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-width: 0;
		font-size: 14px;
	}
	.set-foot {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-2);
		padding: var(--sp-6) var(--sp-5) 0;
	}
	/* モーダルの中の対比。左が変わる操作、右が変わらない操作 */
	.set-diff {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--sp-4);
		margin-top: var(--sp-4);
	}
	.set-diff h4 {
		margin: 0 0 var(--sp-2);
		color: var(--ink-3);
		font-size: 12px;
		font-weight: 500;
	}
	.set-diff ul {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.set-diff li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-2);
		min-width: 0;
		font-size: 14px;
	}
	@media (max-width: 960px) {
		.set-panes {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 520px) {
		.set-always-list,
		.set-diff {
			grid-template-columns: minmax(0, 1fr);
		}
		/* この幅では「Google カレンダー」がカードと行の左右の余白に押されて折り返す。
		   カード側の余白を外し、行の 16px だけ残す */
		.set-list {
			padding-inline: 0;
		}
		/* 2 列だと値が 1 語ずつ折り返すので、見出しの上に値を積む */
		.set-truth .kv,
		.set-data .kv {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
		}
		.set-truth .kv dd,
		.set-data .kv dd {
			margin-bottom: var(--sp-3);
		}
	}
</style>

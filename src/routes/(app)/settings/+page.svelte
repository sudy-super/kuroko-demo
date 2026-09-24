<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { db } from '$lib/store.svelte';
	import { setAutomation, toggleConnection } from '$lib/actions';
	import { CONNECT_NAME } from '$lib/connect';
	import { ui, toast } from '$lib/ui.svelte';
	import type { Automation } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import GlassSwitch from '$lib/components/GlassSwitch.svelte';
	import Modal from '$lib/components/Modal.svelte';

	// /people /tasks と同じ表示の切り替え (Segmented.svelte)
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

	/** 仕様 5.13 — どのデータをどのサービスに保存するか */
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

</script>

<svelte:head><title>設定 — KUROKO AI</title></svelte:head>

<div class="settings">
	<h1 class="sr-only">設定</h1>

	<div class="set-tabs">
		<Segmented label="設定の切り替え" items={[...TABS]} value={tab} onchange={(k) => (tab = k)} />
	</div>

	{#if tab === 'connect'}
		<!-- settings-connect.md — HIG Lists and tables の grouped の形。見出し (header) はカードの上、
		     補足 (footer) はカードの下に置き、行はロゴ・名前・スイッチの 3 つに絞る
		     ("Keep item text succinct")。サービスごとの説明は接続の手順 (ConnectStep) で見せている -->
		<div class="set-panes">
			<section aria-labelledby="set-conn-head">
				<h2 class="set-group-head" id="set-conn-head">連携</h2>
				<div class="card set-group">
					{#each db.settings.connections as c (c.id)}
						<!-- 接続はスイッチにする (ユーザー裁定 2026-09-25)。本来はオンにすると各サービスの
						     許可の画面へ移り、許可をやめたらオフに戻る。デモでは押した瞬間に切り替わる。
						     HIG Toggles「switch は一覧の行の中で使う」。見た目は Liquid Glass (GlassSwitch) -->
						<div class="list-row set-row has-logo">
							<Icon name="b-{c.id}" size={24} />
							<span class="set-name">{CONNECT_NAME[c.id]}</span>
							<GlassSwitch
								checked={c.connected}
								label="{CONNECT_NAME[c.id]}との連携"
								onchange={() => toggleConnection(c.id)}
							/>
						</div>
					{/each}
				</div>
				<p class="set-group-foot">接続したサービスの予定とメールを、KUROKO が自動で読み込みます。</p>
			</section>

			<section aria-labelledby="set-truth-head">
				<h2 class="set-group-head" id="set-truth-head">データの保存先</h2>
				<!-- iOS の設定の「項目名 … 値」の行。値は行の右端に二次的な文字で置く -->
				<dl class="card set-group">
					{#each SOURCE_OF_TRUTH as [what, where] (what)}
						<div class="list-row set-row">
							<dt>{what}</dt>
							<dd>{where}</dd>
						</div>
					{/each}
				</dl>
				<p class="set-group-foot">
					予定とメールは各サービスに保存されたままです。KUROKO は読み書きするだけで、勝手に持ち出しません。
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
		<!-- 計画 Task 27 — このタブは表示のみ。押せる要素を置かない。形は連携タブと同じ grouped -->
		<section class="set-data" aria-labelledby="set-data-head">
			<h2 class="set-group-head" id="set-data-head">セキュリティとデータ</h2>
			<dl class="card set-group">
				{#each DATA as [what, how] (what)}
					<div class="list-row set-row">
						<dt>{what}</dt>
						<dd>{how}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/if}

	<!-- HIG Buttons — 破壊的な操作は赤の文字で示し、主の役割を与えない。iOS の設定と同じく
	     独立したグループの 1 行に置き、押すと確かめる問い (DemoMenu の Modal) を開く -->
	<section class="set-reset" aria-label="デモのリセット">
		<div class="card set-group">
			<button class="list-row set-row set-danger" onclick={() => (ui.demoReset = true)}>デモをリセット</button>
		</div>
		<p class="set-group-foot">初期状態に戻し、Welcome 画面へ戻ります。</p>
	</section>
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
		padding: 0 var(--sp-5) var(--sp-4);
	}
	/* 連携と保存先、レベルと必ず確認の 2 列。960px 以下は 1 列に落ちる */
	.set-panes {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		align-items: start;
		gap: var(--sp-4);
		padding: 0 var(--sp-5);
	}
	/* grouped の見出しと補足。見出しはカードの左の余白にそろえる */
	.set-group-head {
		margin: 0 0 var(--sp-2);
		padding-inline: var(--sp-5);
		color: var(--ink-3);
		font-size: 13px;
		font-weight: 500;
	}
	.set-group-foot {
		margin: var(--sp-2) 0 0;
		padding-inline: var(--sp-5);
		color: var(--ink-3);
		font-size: 13px;
		line-height: 1.6;
	}
	.set-group {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
	.set-row {
		gap: var(--sp-3);
		height: 52px;
		padding-inline: var(--sp-5);
		cursor: default;
	}
	/* 区切り線 (.list-row::after) は文字の始まりから引く (iOS の inset の区切り)。
	   ロゴのある行はロゴの右 (24px + 間隔 12px) から */
	.set-row::after {
		left: var(--sp-5);
		right: 0;
	}
	.set-row.has-logo::after {
		left: calc(var(--sp-5) + 24px + var(--sp-3));
	}
	div.set-row:hover,
	dl .set-row:hover {
		background: none;
	}
	.set-name {
		flex: 1;
		min-width: 0;
		font-weight: 500;
	}
	.set-group dt {
		flex: 1;
		color: var(--ink);
	}
	.set-group dd {
		margin: 0;
		color: var(--ink-2);
	}
	.set-danger {
		justify-content: center;
		color: var(--warn);
		font-weight: 500;
		cursor: pointer;
	}
	.set-reset {
		max-width: 480px;
		padding: var(--sp-6) var(--sp-5) 0;
	}
	.set-note {
		margin-top: var(--sp-3);
		font-size: 14px;
		line-height: 1.7;
	}
	/* 1 枚しか無いので、2 列のときの連携側と同じ幅で止める (幅いっぱいだと値が遠くなる) */
	.set-data {
		max-width: 680px;
		padding: 0 var(--sp-5);
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
		.set-row {
			padding-inline: var(--sp-4);
		}
		.set-row::after {
			left: var(--sp-4);
		}
		.set-row.has-logo::after {
			left: calc(var(--sp-4) + 24px + var(--sp-3));
		}
	}
</style>

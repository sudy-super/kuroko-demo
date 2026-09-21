<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { badgeCount, pendingApprovals, guideSection } from '$lib/derived';
	import { fmtYMDW, fmtMDW, hm } from '$lib/dates';
	import { stopGuide } from '$lib/actions';
	import { panels, ui } from '$lib/ui.svelte';
	import { media } from '$lib/media.svelte';
	import Icon from './Icon.svelte';
	import DemoMenu from './DemoMenu.svelte';
	import PillPanel from './PillPanel.svelte';
	import ApprovalIcon from './ApprovalIcon.svelte';

	/* 仕様 11.3 — 節ごとの見出しと手順。Task 10n で GuideCard.svelte から移した。
	   案内のために本文の領域を使わない (ユーザー裁定 2026-09-16)ので、見出しはピルの中に、
	   手順と「ツアーを終了」は押したときだけ開く板に置く。文言も段階の進み方も変えていない */
	const SECTIONS: Record<1 | 2 | 3 | 4 | 5, { title: string; steps: string }> = {
		1: { title: '承認を片付ける', steps: 'Today の承認待ちを開き、2 件を承認します' },
		2: {
			title: '田中様に返信する',
			steps:
				'メールの一覧から田中様のメールを開き、「日程候補を入れる」で返信案を作って送信し、承認します'
		},
		3: {
			title: '日程が決まる',
			steps:
				'Today の「日程調整の返信待ち」を押して相手の画面を開き、候補を選んで確定します。元のタブに反映されます'
		},
		4: {
			title: '会議の前後',
			steps:
				'Today の「次の会議」から Brief を確認し、アジェンダを作成、文字起こしを追加して ToDo 候補を 2 件登録します'
		},
		5: { title: '今日を終える', steps: '今日の ToDo 3 件を完了にします' }
	};
	const DONE = {
		title: '完了しました',
		steps: 'ひととおりの流れをお試しいただきました。'
	};

	let now = $state(new Date());

	const pending = $derived(pendingApprovals(db));
	const logs = $derived(db.logs.slice(0, 3));
	const guideOn = $derived(db.demo.guide.on);
	const section = $derived(guideSection(db));
	const guide = $derived(section === 0 ? DONE : SECTIONS[section]);

	/* island.md「常時見せる情報」— compact に残すのは一目で分かる最小限だけ。
	   案内の最中は段階の表示を足すぶん、日付を短い形に畳んで幅を 560px に収める */
	const shortDate = $derived(media.mobile || guideOn);

	// 1 分ごとに時計を進める
	$effect(() => {
		const t = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(t);
	});
</script>

{#snippet tools()}
	<!-- island.md「広がったときの中身」— 板には直近の数件だけを出し、全件は既存のドロワーへ送る -->
	<PillPanel name="log">
		{#snippet trigger(props)}
			<button {...props} class="iconbtn" title="作業履歴" aria-label="作業履歴">
				<Icon name="ic-history" size={20} />
			</button>
		{/snippet}
		<h3 class="pill-title">作業履歴</h3>
		{#if logs.length === 0}
			<p class="muted">まだ記録はありません。</p>
		{:else}
			{#each logs as l (l.id)}
				<div class="pill-row">
					<span class="num sub">{l.at.slice(11, 16)}</span>
					<span>{l.text}</span>
				</div>
			{/each}
		{/if}
		<button
			class="btn text sm"
			onclick={() => {
				panels.open = null;
				ui.activityDrawer = true;
			}}
		>
			すべて見る
		</button>
	</PillPanel>

	<PillPanel name="approvals">
		{#snippet trigger(props)}
			<button
				{...props}
				class="iconbtn"
				style="overflow: visible"
				title="承認待ち"
				aria-label="承認待ち {pending.length} 件"
			>
				<Icon name="ic-check-c" size={20} />
				{#if pending.length > 0}
					<span class="badge count num" style="position: absolute; top: -2px; right: -2px">
						{badgeCount(pending.length)}
					</span>
				{/if}
			</button>
		{/snippet}
		<h3 class="pill-title">承認待ち {pending.length} 件</h3>
		{#if pending.length === 0}
			<p class="muted">承認をお待ちいただいているものはありません。</p>
		{:else}
			{#each pending.slice(0, 3) as a (a.id)}
				<div class="pill-row">
					<ApprovalIcon kind={a.kind} />
					<span class="tc-text">{a.title}</span>
				</div>
			{/each}
		{/if}
		<button
			class="btn text sm"
			onclick={() => {
				panels.open = null;
				ui.approvalDrawer = true;
			}}
		>
			すべて見る
		</button>
	</PillPanel>

	<DemoMenu />
{/snippet}

{#snippet bar()}
	<span class="num hdr-date">{shortDate ? fmtMDW(now) : fmtYMDW(now)}</span>
	<!-- island.md「常時見せる情報」で時計は畳む対象に無い (brief 3 項も時刻を常時表示に挙げる)。
	     デスクトップは案内中も時計を残し、代わりに利用者名を畳む (review-task-10n.md Minor 2)。
	     モバイルは 390px 幅にハンバーガー・アイコン 3 個まで並ぶので、案内中に段階の札を出す
	     ぶんは時計を畳んだままにする (この幅は Minor 2 の指摘の対象外、既存のまま) -->
	{#if !(guideOn && media.mobile)}<span class="num muted">{hm(now)}</span>{/if}
	{#if guideOn}
		<!-- 仕様 11.3 の案内。段階が進んでも入れ物は作り直さず、中の文字だけが変わる
		     (island.md「動きの時間と緩急」の「既存の要素を保ったまま動かす」)。
		     ピルの幅の変化は .header.glass の transition が 300ms で追う -->
		<PillPanel name="guide">
			{#snippet trigger(props)}
				<button
					{...props}
					class="pill-guide"
					aria-label="操作の案内 {guide.title}{section > 0 ? ` ${section} / 5` : ''}"
				>
					<span class="pg-title">{guide.title}</span>
					{#if section > 0}<span class="num">{section} / 5</span>{/if}
				</button>
			{/snippet}
			<!-- 960px 以下ではピルの札が段階だけになるので、見出しはここで出す -->
			<h3 class="pill-title">{guide.title}</h3>
			<p class="pill-steps">{guide.steps}</p>
			<button class="btn text sm" onclick={stopGuide}>
				{section === 0 ? '閉じる' : 'ツアーを終了'}
			</button>
		</PillPanel>
	{/if}
	<div class="row" style="margin-left: auto; gap: var(--sp-3)">
		{#if !media.mobile && !guideOn}<span class="muted">{db.user.name}</span>{/if}
		{@render tools()}
	</div>
{/snippet}

{#if media.mobile}
	<header class="header solid">
		<button class="iconbtn" aria-label="メニューを開く" onclick={() => (ui.mobileMenu = true)}>
			<Icon name="ic-list" size={20} />
		</button>
		{@render bar()}
	</header>
{:else}
	<!-- Task 10n — 画面幅いっぱいの帯をやめ、右上に浮く小さなピルにする (island.md の結論、
	     ユーザー裁定 2026-09-16: 中央ではなく右上)。高さは操作領域の下限を割らない 52px の
	     まま保ち、取り戻すのは帯が確保していた本文の上の余白のほう -->
	<header class="header glass">{@render bar()}</header>
{/if}

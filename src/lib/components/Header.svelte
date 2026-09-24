<script lang="ts">
	import { clock } from '$lib/clock.svelte';
	import { db } from '$lib/store.svelte';
	import { badgeCount, pendingApprovals, guideSection } from '$lib/derived';
	import { fmtYMDW, fmtMDW, hm } from '$lib/dates';
	import { stopGuide } from '$lib/actions';
	import { panels, ui } from '$lib/ui.svelte';
	import { mobile } from '$lib/media.svelte';
	import Icon from './Icon.svelte';
	import DemoMenu from './DemoMenu.svelte';
	import PillPanel from './PillPanel.svelte';
	import ApprovalIcon from './ApprovalIcon.svelte';
	import ToastCountdown from './ToastCountdown.svelte';

	/* 仕様 11.3 の節ごとの見出しと手順。案内に本文の領域を使わないので、見出しはピルの中、
	   手順と「ツアーを終了」は押したときだけ開く板に置く */
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

	const now = $derived(clock.now);

	const pending = $derived(pendingApprovals(db));
	const logs = $derived(db.logs.slice(0, 3));
	const guideOn = $derived(db.demo.guide.on);
	const section = $derived(guideSection(db));
	const guide = $derived(section === 0 ? DONE : SECTIONS[section]);

	/* island.md「常時見せる情報」— compact に残すのは一目で分かる最小限だけ。
	   案内の最中は段階の表示を足すぶん、日付を短い形に畳んで幅を 560px に収める */
	const shortDate = $derived(mobile.current || guideOn);

	/* 取り消しの猶予を持つトーストは、デスクトップではピルの中に出す。その間は日付・利用者名・段階札を畳む
	   (island.md — 1 度に 1 項目)。時計・承認待ちの件数・アイコン 3 つは常時見せる情報なので残す */
	const counting = $derived(!mobile.current && !!ui.toast?.island && !ui.toast.leaving);

	/* max-content のままだと中身が入れ替わった瞬間に幅が跳ぶ (interpolate-size は指定値が変わらないと効かない)。
	   中身 (.hdr-inner) の自然な幅を測って px で渡し、.header.glass の transition に追わせる */
	let inner: HTMLElement | undefined = $state();
	let pillW = $state<number>();
	$effect(() => {
		if (!inner) return;
		const ro = new ResizeObserver(([e]) => (pillW = e.borderBoxSize[0].inlineSize));
		ro.observe(inner);
		return () => ro.disconnect();
	});

</script>

<!-- 板を閉じてから、全件のドロワーを開く -->
{#snippet all(openDrawer: () => void)}
	<button
		class="btn text sm"
		onclick={() => {
			panels.open = null;
			openDrawer();
		}}
	>
		すべて見る
	</button>
{/snippet}

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
		{@render all(() => (ui.activityDrawer = true))}
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
		{@render all(() => (ui.approvalDrawer = true))}
	</PillPanel>

	<DemoMenu />
{/snippet}

{#snippet bar()}
	{#if !counting}
		<!-- 日付・時刻・名前は同じ色と書体でそろえる -->
		<span class="num hdr-date">{shortDate ? fmtMDW(now) : fmtYMDW(now)}</span>
	{/if}
	<!-- 時計は常時見せる情報 (island.md)。デスクトップは案内中も時計を残して利用者名を畳む。
	     モバイルは 390px に並びきらないので、案内中は時計を畳む -->
	{#if !(guideOn && mobile.current)}<span class="num">{hm(now)}</span>{/if}
	{#if guideOn && !counting}
		<!-- 段階が進んでも入れ物は作り直さず中の文字だけ変える (island.md)。幅の変化は .header.glass の transition が追う -->
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
	<!-- 読み上げの箱は常駐させ中身だけを出し入れする。足されたばかりのライブ領域を読まない読み上げソフトがある。
	     空の間は display: contents -->
	<div class="pill-live" role="status" aria-live="polite">
		{#if counting}
			<!-- id で key し、猶予が改めて始まるたびに輪の CSS アニメーションを最初から動かす -->
			{#key ui.toast?.id}
				<div class="pill-countdown" style:--dur="{ui.toast?.seconds}s">
					<ToastCountdown />
				</div>
			{/key}
		{/if}
	</div>
	<div class="row" style="margin-left: auto; gap: var(--sp-3)">
		{#if !mobile.current && !guideOn && !counting}<span class="num">{db.user.name}</span>{/if}
		{@render tools()}
	</div>
{/snippet}

{#if mobile.current}
	<header class="header solid">
		<button class="iconbtn" aria-label="メニューを開く" onclick={() => (ui.mobileMenu = true)}>
			<Icon name="ic-list" size={20} />
		</button>
		{@render bar()}
	</header>
{:else}
	<!-- 右上に浮く小さなピル (island.md)。高さは操作領域の下限を割らない 52px -->
	<header class="header glass" style:width={pillW ? `calc(${pillW}px + var(--sp-4) * 2)` : undefined}>
		<div class="hdr-inner" bind:this={inner}>{@render bar()}</div>
	</header>
{/if}

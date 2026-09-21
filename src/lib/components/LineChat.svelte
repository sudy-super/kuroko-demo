<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import type { LineMessage } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { lineApprove, lineSay } from '$lib/actions';
	import { visibleActions } from '$lib/kuroko/line';
	import { ui } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';

	// 見た目の差だけを受け取る。LINE と Slack で部品を分けない
	let { channel, role }: { channel: 'line' | 'slack'; role: 'owner' | 'member' } = $props();

	const messages = $derived(channel === 'line' ? db.line : db.slack);
	const title = $derived(channel === 'line' ? '社内グループ (4)' : '#sales');

	let text = $state('');
	// 考えている間に何をしているかを書く (chat.md 観点 3.1)。空文字の間は待っていない
	let busy = $state('');
	let logEl: HTMLDivElement | undefined = $state();

	async function send(q = text.trim()) {
		if (!q || busy) return;
		text = '';
		const before = messages.length;
		busy = q.startsWith('@KUROKO') ? 'KUROKO が内容を確かめています' : '';
		await lineSay(q, role);
		busy = '';
		// 末尾まで飛ばさず、新しい発言の先頭に位置を合わせる (chat.md 観点 1.4)
		await tick();
		logEl?.children[before]?.scrollIntoView({ block: 'nearest' });
	}

	/** 見せてよい操作の切り分けは kuroko/line.ts (handleMention の role と同じ場所) */
	const actionsOf = (card: NonNullable<LineMessage['card']>) => visibleActions(card, role);

	/** カードのボタン。押すまで何も確定しない (chat.md 観点 2.2、Apple HIG 資料 1) */
	function act(a: NonNullable<LineMessage['card']>['actions'][number]) {
		// 用件の言い直し。押すとその文をそのまま送り直す (/chat のチップと同じ)
		if (a.act === 'say') return void send(a.arg!);
		if (a.act === 'open') return goto(a.arg!);
		// role は actions.ts 側でも見る。画面に出していないだけで通るようにはしない。
		// 本文を見る操作も同じ扱い (visibleActions が出さない操作は、通り道も塞ぐ)
		if (a.act === 'preview') return void (role === 'owner' && (ui.approvalDrawer = true));
		if (a.act === 'approve') return void lineApprove(a.arg!, role, channel);
		throw new Error(`知らない操作です: ${a.act}`);
	}
</script>

<section class="lc" class:slack={channel === 'slack'} aria-label="{title}の会話">
	<header class="lc-head">
		<Icon name={channel === 'line' ? 'ic-chat' : 'ic-grid'} size={20} />
		<h2>{title}</h2>
	</header>

	<!-- chat.md 観点 6.1 — 発言の積み上がりは role="log" (W3C ARIA23 の例 1 がチャットそのもの)。
	     入れ物は最初から DOM に置く (同 6.2) -->
	<div class="lc-log" role="log" aria-label="{title}のやり取り" bind:this={logEl}>
		{#each messages as m (m.id)}
			{@const mine = m.who !== 'KUROKO' && m.role === role}
			<div class="lc-turn" class:mine>
				<!-- 送り手は位置や色だけでなく名前でも示す (chat.md 観点 1.2)。
				     KUROKO の印は Carbon for AI (資料 10) の「AI であることの表示」も兼ねる -->
				<p class="lc-who">
					{#if m.who === 'KUROKO'}<Icon name="ic-robot" size={16} />{/if}
					{m.who}<span class="lc-at">{m.at}</span>
				</p>
				<div class="lc-bubble">
					<p class="lc-text">{m.text}</p>
					{#if m.card}
						<div class="lc-card">
							<p class="lc-card-title">{m.card.title}</p>
							{#each m.card.lines as line (line)}<p class="lc-card-line">{line}</p>{/each}
							<!-- buttons.md 観点 A + research-repeated-primary.md — 吹き出しが積み上がる画面なので
							     カードごとに塗りの主ボタンを置かない。枠と文字だけで段を付ける -->
							<div class="row lc-acts">
								<!-- 鍵は並び順。同じ act を複数持つカード (用件の言い直しは 3 つとも say) があるので
								     act では重複する。この列は並び替わらない -->
								{#each actionsOf(m.card) as a, i (i)}
									<button class="btn {i === 0 ? 'sec' : 'text'} sm" onclick={() => act(a)}>{a.label}</button>
								{/each}
							</div>
							{#if m.card.actions.some((a) => a.act === 'approve')}
								<p class="lc-note">
									{role === 'owner' ? '押すまで送信されません' : '承認はオーナーのみが行えます'}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- chat.md 観点 3.3 — 待ちの表示は role="status"。WCAG 2.2 の 4.1.3 (レベル AA) の要求。
	     入れ物は常設し中身の文字だけ入れ替える (同 6.2。領域ごと出し入れすると読まれない) -->
	<p class="lc-busy" role="status">{busy}</p>

	<form
		class="row lc-form"
		onsubmit={(e) => {
			e.preventDefault();
			send();
		}}
	>
		<input
			class="input"
			bind:value={text}
			placeholder="@KUROKO 〜"
			aria-label="{title}へ送る内容 ({role === 'owner' ? '社長' : '山田'}として)"
		/>
		<button class="btn sec" type="submit" aria-disabled={!text.trim() || !!busy}>
			<Icon name="ic-send" size={20} />送信
		</button>
	</form>
</section>

<style>
	.lc {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-radius: var(--r-m);
		background: #fff;
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.lc-head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-3) var(--sp-4);
		border-bottom: 1px solid var(--line);
	}
	.lc-head h2 {
		margin: 0;
		font-size: 15px;
		overflow-wrap: anywhere;
	}
	.lc-log {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		/* LINE / Slack の地の色。既存のサービスの見た目に寄せる (chat.md に左右の振り分けや
		   吹き出しの形を規定した一次資料は無いと書かれている) */
		padding: var(--sp-4);
		background: var(--bg);
		overflow-y: auto;
	}
	.lc-turn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-1);
		/* 割合で詰めない。カードの中のボタンは折り返さないので、幅 360px では割合の余白が
		   カードの最小幅を割り、行からはみ出す (chat/+page.svelte と同じ理由) */
		max-width: min(520px, 100%);
	}
	/* LINE は自分が右・緑。Slack は全員左寄せなので .mine を打ち消す */
	.lc-turn.mine {
		margin-left: auto;
		align-items: flex-end;
	}
	.lc.slack .lc-turn.mine {
		margin-left: 0;
		align-items: flex-start;
	}
	.lc-who {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--ink-3);
		font-size: 12px;
	}
	.lc-at {
		color: var(--ink-3);
	}
	.lc-bubble {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--r-m);
		background: #fff;
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.lc-turn.mine .lc-bubble {
		background: var(--line-2);
	}
	/* Slack は吹き出しを持たない。枠と塗りを落として本文だけにする */
	.lc.slack .lc-bubble,
	.lc.slack .lc-turn.mine .lc-bubble {
		padding: 0;
		background: none;
		box-shadow: none;
	}
	.lc-text {
		font-size: 14px;
		white-space: pre-wrap;
		/* 高さを決め打ちしないので、折り返した分だけ伸びる (下の行に重ならない) */
		overflow-wrap: anywhere;
	}
	.lc-text:empty {
		display: none;
	}
	.lc-card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		padding: var(--sp-3);
		border-radius: var(--r-s);
		background: var(--bg);
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.lc-card-title {
		font-size: 14px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.lc-card-line,
	.lc-note {
		color: var(--ink-2);
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.lc-note {
		color: var(--ink-3);
	}
	.lc-acts {
		flex-wrap: wrap;
		gap: var(--sp-2);
		margin-top: var(--sp-1);
	}
	.lc-busy {
		padding: var(--sp-2) var(--sp-4) 0;
		color: var(--ink-2);
		font-size: 13px;
	}
	/* 待っていない間も入れ物は残す (読み上げのため)。空の行が余白を作らないようにする */
	.lc-busy:empty {
		padding: 0;
	}
	.lc-form {
		gap: var(--sp-2);
		padding: var(--sp-3) var(--sp-4);
		border-top: 1px solid var(--line);
	}
	.lc-form .input {
		flex: 1;
		min-width: 0;
	}
</style>

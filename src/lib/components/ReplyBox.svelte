<script lang="ts">
	import type { MessageThread } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { identityOf, personOf } from '$lib/derived';

	let { thread }: { thread: MessageThread } = $props();

	// 社外宛はメールアドレスを省略しない (仕様 5.3)
	const identity = $derived(identityOf(db, thread.identityId));
	const person = $derived(personOf(db, thread.personId));
	const to = $derived(
		person && identity ? `${person.name} <${identity.value}>` : (identity?.value ?? thread.sender)
	);

	let body = $state('');
	const id = $props.id();
</script>

<section class="card reply" aria-label="返信">
	<p class="to">宛先 {to}</p>
	<textarea {id} class="textarea" rows="5" aria-label="返信の本文" bind:value={body}></textarea>
	<p class="note">返信案の作成と送信は、次の手順で使えるようになります。</p>
</section>

<style>
	.reply {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.to {
		margin: 0;
		color: var(--ink-2);
		font-size: 14px;
	}
	.note {
		margin: 0;
		color: var(--ink-2);
		font-size: 12px;
	}
</style>

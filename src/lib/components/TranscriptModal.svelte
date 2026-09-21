<script lang="ts">
	import { addTranscript } from '$lib/actions';
	import { SAMPLE_TRANSCRIPT } from '$lib/kuroko/samples';
	import Modal from './Modal.svelte';

	let { open, meetingId, onclose }: { open: boolean; meetingId: string; onclose: () => void } = $props();

	const formId = $props.id();

	let text = $state('');
	let ta: HTMLTextAreaElement | undefined = $state();

	function submit(e: SubmitEvent) {
		e.preventDefault();
		addTranscript(meetingId, text.trim());
		text = '';
		onclose();
	}

	function cancel() {
		text = '';
		onclose();
	}
</script>

<Modal
	{open}
	title="文字起こしを追加"
	description="打ち合わせの文字起こしを貼り付けると、議事録と ToDo 候補を作ります。"
	onclose={cancel}
	openFocus={() => ta ?? null}
>
	<form id={formId} onsubmit={submit}>
		<div class="field">
			<label class="label" for="{formId}-text">文字起こし</label>
			<!-- 話者の行が続くので、既定の 96px より背を高くして流れを追えるようにする -->
			<textarea
				class="textarea"
				id="{formId}-text"
				rows="12"
				required
				bind:value={text}
				bind:this={ta}
			></textarea>
		</div>
	</form>
	{#snippet actions()}
		<!-- buttons.md 観点A 原則 3 — 塗りの主ボタンは 1 画面 1 つ。モーダルは Carbon が認める
		     例外 (別フローが被さる) なので、ここの「議事録を作成」だけが塗りになる -->
		<button class="btn pri" type="submit" form={formId}>議事録を作成</button>
		<button class="btn sec" type="button" onclick={() => (text = SAMPLE_TRANSCRIPT)}>
			サンプル文字起こしを読み込む
		</button>
		<button class="btn text" type="button" onclick={cancel}>キャンセル</button>
	{/snippet}
</Modal>

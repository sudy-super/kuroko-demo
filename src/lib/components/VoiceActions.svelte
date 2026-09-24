<script lang="ts">
	/* 話している間の操作。ChatGPT の音声モード・Gemini Live・Copilot Voice はどれもアイコンだけの
	   丸いボタン 2 個 (docs/research/voice-controls.md)。KurokoBar と VoiceOverlay の両方で使うので
	   ここに切り出す。ユーザー指示 2026-09-24 — 「やり直す」は無く、自動送信もしない */
	import { ui } from '$lib/ui.svelte';
	import { hearing } from '$lib/voice.svelte';
	import Icon from './Icon.svelte';
</script>

<div class="voice-acts">
	<button
		type="button"
		class="voice-act voice-act-close"
		onclick={() => (ui.voice = false)}
		aria-label="閉じる"
		title="閉じる"
	>
		<Icon name="ic-x" size={24} />
	</button>
	<button
		type="button"
		class="voice-act voice-act-send"
		onclick={() => hearing.send(400)}
		disabled={!hearing.heard.trim() || hearing.thinking}
		aria-label="KUROKO に送る"
		title="KUROKO に送る"
	>
		<Icon name="ic-send" size={24} />
	</button>
</div>

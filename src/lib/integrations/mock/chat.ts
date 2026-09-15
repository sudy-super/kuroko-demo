// TODO(real): LINE Messaging API と Slack Events API (app_mention)に差し替える
import type { LineMessage } from '../../types';
import type { ChatProvider } from '../types';
import { db } from '../../store.svelte';
import { hm } from '../../dates';
import { uid } from '../../kuroko/generate';

export const chat: ChatProvider = {
	post(channel, text) {
		const m: LineMessage = { id: uid('ln'), who: 'KUROKO', text, at: hm() };
		(channel === 'line' ? db.line : db.slack).push(m);
	}
};

// TODO(real): Gmail API users.messages.send に差し替える。restricted scope のため CASA 審査が必要
import type { Message, MessageThread } from '../../types';
import type { MailProvider } from '../types';
import { db } from '../../store.svelte';
import { nowIso } from '../../dates';
import { uid } from '../../kuroko/generate';

export const mail: MailProvider = {
	sendMessage(thread: MessageThread, body: string): Message {
		const m: Message = { id: uid('mg'), threadId: thread.id, from: 'me', body, at: nowIso(), sentVia: 'approval' };
		db.messages.push(m);
		thread.lastAt = m.at;
		return m;
	}
};

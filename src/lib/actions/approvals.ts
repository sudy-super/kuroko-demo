import type { Approval, Origin, UndoPayload, Automation } from '../types';
import { db, save } from '../store.svelte';
import { toast, dismissToast } from '../ui.svelte';
import { nowIso } from '../dates';
import { meetingOf, threadOf, approvalOf } from '../derived';
import { uid } from '../kuroko/generate';
import { integrations } from '../integrations';
import { log, undo, unshifted, closeThread, stopTimer, timers } from './core';

export const SEND_DELAY_MS = 5000;

// 社外への送信だけは自動化レベルによらず必ず承認を求める
const autoExecutes = (risk: Approval['risk'], level: Automation) => risk !== 'external_send' && level !== 'draft';

export function addApproval(input: Omit<Approval, 'id' | 'status' | 'createdAt'>): Approval {
	const a = unshifted(db.approvals, { ...input, id: uid('ap'), status: 'pending', createdAt: nowIso() });
	if (autoExecutes(a.risk, db.settings.automation)) {
		executeApproval(a.id, true);
	}
	save();
	return a;
}

export function approve(id: string, origin: Origin = 'approval') {
	const a = approvalOf(db, id);
	if (!a || a.status !== 'pending') return;
	if (a.risk === 'external_send') {
		a.status = 'sending';
		a.sendingAt = nowIso();
		a.origin = origin;
		timers.set(
			id,
			setTimeout(() => executeApproval(id), SEND_DELAY_MS)
		);
		// Gmail の送信取り消しと同じく、「送信しました」を先に出して 5 秒だけ取り消せる。
		// key: id で、別の送信の取り消しがこのトーストを閉じないようにする
		toast('送信しました (デモのため実送信していません)', {
			seconds: SEND_DELAY_MS / 1000,
			undo: () => undoApproval(id),
			key: id
		});
	} else {
		executeApproval(id);
		// 押された時点ではなく、今できたログを取り消す。取り消せない種類には取り消しを出さない
		const l = db.logs[0];
		toast('実行しました', l?.undo ? { undo: () => undo(l.id) } : {});
	}
	save();
}

/**
 * LINE / Slack のカードからの承認。社外への送信を伴うので、承認できるのはオーナーだけ
 * (仕様 5.13 と handleMention の role の切り分けと同じ考え方)。member には呼ばせない
 */
export function lineApprove(id: string, role: 'owner' | 'member', channel: 'line' | 'slack') {
	if (role !== 'owner') return false;
	approve(id, channel);
	return true;
}

export function undoApproval(id: string) {
	const a = approvalOf(db, id);
	if (!a || a.status !== 'sending') return;
	stopTimer(id);
	a.status = 'pending';
	a.sendingAt = undefined;
	save();
	// この承認の送信のトーストだけを閉じる。別の送信が表示中なら閉じない
	dismissToast(id);
}

export function editApproval(id: string, body: string) {
	const a = approvalOf(db, id);
	if (!a || a.status !== 'pending') return;
	a.body = body;
	// reply 以外の payload は本文を持たないので、種類ごとに更新先を分ける
	if (a.payload.type === 'reply') a.payload.body = body;
	save();
}

export function reject(id: string, origin: Origin = 'approval') {
	const a = approvalOf(db, id);
	if (!a || (a.status !== 'pending' && a.status !== 'sending')) return;
	// 送信待ちを却下したら、待っている送信も止める
	stopTimer(id);
	a.status = 'rejected';
	a.sendingAt = undefined;
	log(`${a.title}を却下しました`, 'other', { actor: 'user', origin });
	toast('却下しました');
	save();
}

// 送信待ちのままタブが閉じられた分は、起動時に承認待ちへ戻す
export function restoreStaleSending() {
	for (const a of db.approvals)
		if (a.status === 'sending' && a.sendingAt && Date.now() - Date.parse(a.sendingAt) > 10000) {
			a.status = 'pending';
			a.sendingAt = undefined;
		}
	save();
}

export function executeApproval(id: string, auto = false) {
	const a = approvalOf(db, id);
	// 却下済みと実行済みは動かさない。待機中のタイマーが後から発火しても素通りさせる
	if (!a || (a.status !== 'pending' && a.status !== 'sending')) return;
	a.status = 'executed';
	a.executedAt = nowIso();
	timers.delete(id);
	const p = a.payload;
	const ext = a.risk === 'external_send';
	const sent = (text: string, undo?: UndoPayload) =>
		log(text, 'send', { actor: 'user', origin: a.origin, approved: true, undo });
	if (p.type === 'reply') {
		const th = threadOf(db, p.threadId)!;
		integrations.mail.sendMessage(th, p.body);
		closeThread(th);
		const s = p.schedulingId && db.scheduling.find((x) => x.id === p.schedulingId);
		if (s) {
			s.status = 'sent';
			s.token = uid('tok');
			s.threadId = th.id;
		}
		db.demo.stats.replied++;
		// 送った先はスレッドの出所そのもの。sendReply が決めた kind と文言を食い違わせない
		const via = a.kind === 'mail' ? 'メール' : a.kind === 'line' ? 'LINE' : 'Slack';
		sent(`${a.to.split(' <')[0].split(' (')[0]}へ${via}を送信しました`);
	} else if (p.type === 'share') {
		sent(`${a.title}を実行しました`);
	} else if (p.type === 'agenda') {
		const m = meetingOf(db, p.meetingId)!;
		m.agendaShared = true;
		sent('アジェンダを参加者に共有しました', { kind: 'agenda_share', meetingId: m.id });
	} else if (p.type === 'document') {
		sent(`${a.title}を送信しました`);
	} else if (p.type === 'followup') {
		// 相手のスレッドがあれば reply と同じように閉じる。無い会議 (threadId は省略可能) では何もしない
		const th = threadOf(db, p.threadId);
		if (th) closeThread(th);
		sent('フォローメールを送信しました');
	} else if (p.type === 'line') {
		integrations.chat.post('line', p.text);
		sent('LINE に返信しました');
	}
	if (auto) {
		db.logs[0].approved = false;
		db.logs[0].text += ' (自動化レベルにより承認を省略)';
	}
	if (ext && !auto) db.demo.stats.approved++;
	save();
}

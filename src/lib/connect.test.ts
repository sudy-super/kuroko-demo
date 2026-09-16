import { describe, it, expect } from 'vitest';
import type { Connection } from './types';
import { nextStep, isConnectionId, CONNECT_NAME, CONNECT_BENEFIT } from './connect';

const conns = (...connected: Connection['id'][]): Connection[] =>
	(['gmail', 'gcal', 'slack', 'line'] as const).map((id) => ({
		id,
		connected: connected.includes(id)
	}));

describe('nextStep', () => {
	it('何も繋いでいなければ先頭から始まる', () => {
		expect(nextStep(conns())).toBe('gmail');
	});
	it('接続済みの画面は飛ばす', () => {
		expect(nextStep(conns('gmail', 'gcal'))).toBe('slack');
	});
	it('after の次から探す (after 自身は見ない)', () => {
		expect(nextStep(conns('gmail'), 'gmail')).toBe('gcal');
		expect(nextStep(conns(), 'gmail')).toBe('gcal');
	});
	it('after より後ろの接続済みも飛ばす', () => {
		expect(nextStep(conns('gmail', 'gcal', 'slack'), 'gmail')).toBe('line');
	});
	it('after が一覧に無ければ先頭から探し直さず undefined', () => {
		// isConnectionId を通らない id が万一渡っても、別の画面へ送らずに止める
		expect(nextStep(conns(), 'notion' as Connection['id'])).toBeUndefined();
	});
	it('残りが無ければ undefined (Today へ入る合図)', () => {
		expect(nextStep(conns('gmail', 'gcal', 'slack', 'line'))).toBeUndefined();
		expect(nextStep(conns('line'), 'slack')).toBeUndefined();
		expect(nextStep(conns(), 'line')).toBeUndefined();
	});
});

describe('isConnectionId', () => {
	it('4 つの id だけを通す', () => {
		expect(isConnectionId('gmail')).toBe(true);
		expect(isConnectionId('line')).toBe(true);
		expect(isConnectionId('notion')).toBe(false);
		expect(isConnectionId('')).toBe(false);
		// prototype の名前が漏れないこと
		expect(isConnectionId('toString')).toBe(false);
	});
});

describe('文言', () => {
	it('名前と効能は 4 つそろっている', () => {
		for (const id of ['gmail', 'gcal', 'slack', 'line'] as const) {
			expect(CONNECT_NAME[id]).toBeTruthy();
			expect(CONNECT_BENEFIT[id]).toBeTruthy();
		}
	});
});

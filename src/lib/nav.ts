import type { Db } from './types';
import { guideSection } from './derived';

/** short はボトムナビ用の短い名前。長い名前は 390px 幅で 2 行になり、ボトムナビの高さを超える */
export type NavItem = { href: string; label: string; icon: string; short?: string };

export const PRIMARY: NavItem[] = [
	{ href: '/today', label: 'Today', icon: 'ic-home' },
	{ href: '/calendar', label: 'カレンダー', icon: 'ic-cal' },
	{ href: '/inbox', label: 'メール', icon: 'ic-mail' },
	{ href: '/tasks', label: 'ToDo', icon: 'ic-todo' },
	{ href: '/people', label: '会社・人物・案件', icon: 'ic-people' },
	{ href: '/chat', label: 'KUROKO', icon: 'ic-chat' }
];

export const SECONDARY: NavItem[] = [
	{ href: '/meetings', label: '会議・議事録', icon: 'ic-bell' },
	{ href: '/documents', label: 'ドキュメント生成', icon: 'ic-doc' },
	{ href: '/integrations', label: 'LINE / Slack', icon: 'ic-grid' },
	{ href: '/activity', label: '作業履歴', icon: 'ic-history' }
];

/** Task 10p (参考の良い点 1) — 設定のような補助中の補助は、下端に区切り線で分けて固定する */
export const UTILITY: NavItem[] = [{ href: '/settings', label: '設定', icon: 'ic-gear' }];

export const BOTTOM: NavItem[] = [
	{ href: '/today', label: 'Today', icon: 'ic-home' },
	{ href: '/inbox', label: 'メール', icon: 'ic-mail' },
	{ href: '/tasks', label: 'ToDo', icon: 'ic-todo' },
	{ href: '/people', label: '会社・人物・案件', icon: 'ic-people', short: '人物' },
	{ href: '/chat', label: 'KUROKO', icon: 'ic-chat' }
];

export const isActive = (pathname: string, href: string) => pathname.startsWith(href);

/** 仕様 11.3 — 案内の節ごとに光らせるナビ項目 */
export const GUIDE_TARGET: Record<1 | 2 | 3 | 4 | 5, string> = {
	1: '/today',
	2: '/inbox',
	3: '/calendar',
	4: '/meetings',
	5: '/tasks'
};

export function guideTarget(db: Db): string | null {
	const s = guideSection(db);
	return s === 0 ? null : GUIDE_TARGET[s];
}

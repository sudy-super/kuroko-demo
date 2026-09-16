import type { Connection } from './types';

export const CONNECT_NAME: Record<Connection['id'], string> = {
	gmail: 'Gmail',
	gcal: 'Google カレンダー',
	slack: 'Slack',
	line: 'LINE'
};

/* 裁定 3 — 画面ごとに「つなぐと何が起きるか」を 1 行だけ添える。
   HIG Onboarding「許可を求める場面で、なぜ要るのかと利点を示す」(onboarding.md 2.1) */
export const CONNECT_BENEFIT: Record<Connection['id'], string> = {
	gmail: '要対応のメールだけを Today に並べます。',
	gcal: '予定の重なりと移動時間を KUROKO が見ます。',
	slack: '@KUROKO への依頼を ToDo にします。',
	line: 'LINE の依頼も同じように扱います。'
};

/* in 演算子だと prototype の名前 (toString など) まで通ってしまうので hasOwn で見る */
export function isConnectionId(v: string): v is Connection['id'] {
	return Object.hasOwn(CONNECT_NAME, v);
}

/**
 * 接続の流れで次に見せる画面。`after` を渡すとその次から探す。
 * 既に接続済みのサービスは飛ばし、残りが無ければ undefined (= Today へ入る)。
 * `after` が一覧に無いときも undefined を返す。呼び出し側は導入画面へ戻すこと。
 */
export function nextStep(
	connections: Connection[],
	after?: Connection['id']
): Connection['id'] | undefined {
	let from = 0;
	if (after) {
		const i = connections.findIndex((c) => c.id === after);
		/* 見つからないときに先頭から探し直すと「after の次から」という約束が黙って
		   変わるので、ここで止める (fail-close) */
		if (i < 0) return undefined;
		from = i + 1;
	}
	return connections.slice(from).find((c) => !c.connected)?.id;
}

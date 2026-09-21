import { goto } from '$app/navigation';
import { startScenario } from './actions';

// 仕様 11.4 — 8 シナリオ。文言は仕様のまま、番号順に並べる。
// ヘッダーのメニューと ⌘K パレットの 2 か所から使うので、一覧はここに 1 つだけ置く
export const SCENARIOS: { label: string; href: string }[] = [
	{
		label:
			'Today から予定追加 → 田中さん・ABC 社案件を選択 → Meet 作成 → カレンダー / Today 反映 → 会議の生成',
		href: '/calendar?new=1'
	},
	{
		label: 'メールから「KUROKO に依頼」→ 過去のやり取り照会 → 人物プロフィール',
		href: '/inbox?t=th-tanaka-next'
	},
	{
		label: 'KUROKO チャットで「金曜までに ABC 社へ見積提出、覚えて」→ 確認 → ToDo 登録',
		href: `/chat?q=${encodeURIComponent('金曜までに ABC 社へ見積提出、覚えて')}`
	},
	{
		label: '人物から名刺 OCR → 確認 → 登録 → 過去メールの関連付け提案',
		href: '/people?ocr=1'
	},
	{
		label: 'LINE デモ: 「@KUROKO 明日 17 時までに資料確認、ToDo 入れて」→ ToDo 反映',
		href: `/integrations?say=${encodeURIComponent('@KUROKO 明日 17 時までに資料確認、ToDo 入れて')}`
	},
	{
		label: 'LINE デモ: 承認を LINE で返す / Member 権限の挙動',
		href: '/integrations?scene=approve'
	},
	{
		label: 'KUROKO チャットから提案書生成',
		href: `/chat?q=${encodeURIComponent('ABC 社向けの提案書を作って')}`
	},
	{
		label: '移動時間の警告を発火させる予定作成 (渋谷 13:00 の後に 品川 14:30)',
		href: `/calendar?new=1&place=${encodeURIComponent('品川')}&start=14:30`
	}
];

/** i は 0 起点。db.demo.scenario は 1 起点なので足してから遷移する */
export function pickScenario(i: number) {
	startScenario(i + 1);
	goto(SCENARIOS[i].href);
}

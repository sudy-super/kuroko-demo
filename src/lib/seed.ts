import type { Db, MessageThread, Message, Document, Suggestion } from './types';
import { key, bizDay, addDays, nextWeekday, fmtMD } from './dates';
import { FILLER_SUBJECTS, DOC_TEMPLATES } from './kuroko/samples';

/* 2 — 承認の kind から 'share' / 'schedule' / 'document' をなくした (何で送るかだけにした)。
   古い保存を読むと記号が引けないので、版を上げて初期状態から作り直させる。
   4 — 件名だけだったメールに本文と差出人のアドレスを足した */
export const DB_VERSION = 4;

export function seed(base: Date = new Date()): Db {
	const b = new Date(base);
	b.setHours(0, 0, 0, 0);
	const T = key(b),
		B1 = key(bizDay(1, b)),
		B3 = key(bizDay(3, b)),
		B4 = key(bizDay(4, b)),
		B5 = key(bizDay(5, b));
	const Y = key(addDays(-1, b)),
		// 商談当日 (B1) と重ならないよう、B1 より後の直近の水曜にする
		WED = key(nextWeekday(3, bizDay(1, b)));
	const at = (dayKey: string, h: string) => `${dayKey}T${h.padStart(5, '0')}:00`;
	// 過去の出来事は base からの相対日数で表す (基準日 9/15 のとき 7/20、8/5、8/25、8/28、9/1 になる)
	const md = (n: number) => fmtMD(addDays(n, b));
	const prevMonth = new Date(b.getFullYear(), b.getMonth(), 0).getMonth() + 1;

	const queueThreads: MessageThread[] = [
		{
			id: 'th-tanaka-next',
			source: 'gmail',
			subject: '次回お打ち合わせについて',
			sender: '田中 太郎 / ABC 株式会社',
			identityId: 'id-tanaka-mail',
			personId: 'p-tanaka',
			companyId: 'c-abc',
			projectId: 'pj-abc-dx',
			reasons: ['question', 'project', 'known_contact'],
			needsReply: true,
			done: false,
			inQueue: true,
			lastAt: at(T, '9:12')
		},
		{
			id: 'th-sato-training',
			source: 'gmail',
			subject: '研修内容のご相談',
			sender: '佐藤 美咲 / XYZ 株式会社',
			identityId: 'id-sato-mail',
			personId: 'p-sato',
			companyId: 'c-xyz',
			projectId: 'pj-xyz-ai',
			reasons: ['question', 'project', 'known_contact'],
			needsReply: false,
			done: false,
			inQueue: true,
			lastAt: at(T, '8:45')
		},
		{
			id: 'th-yamada-quote',
			source: 'slack',
			subject: '見積書の確認をお願いします',
			sender: '山田 健二 / Slack',
			identityId: 'id-yamada-slack',
			personId: 'p-yamada',
			companyId: 'c-kuroko',
			reasons: ['unanswered_3d', 'known_contact'],
			needsReply: false,
			done: false,
			inQueue: true,
			lastAt: at(T, '8:20')
		},
		{
			id: 'th-abc-invoice',
			source: 'gmail',
			subject: '請求書送付のご連絡',
			sender: '経理部 / ABC 株式会社',
			identityId: 'id-abc-keiri',
			companyId: 'c-abc',
			reasons: ['project'],
			needsReply: false,
			done: false,
			inQueue: true,
			lastAt: at(T, '8:05')
		},
		{
			id: 'th-tanaka-line',
			source: 'line',
			subject: '先ほどの件、了解しました',
			sender: '田中 太郎 / LINE',
			identityId: 'id-tanaka-line',
			personId: 'p-tanaka',
			companyId: 'c-abc',
			projectId: 'pj-abc-dx',
			reasons: ['known_contact'],
			needsReply: false,
			done: false,
			inQueue: true,
			lastAt: at(Y, '19:40')
		},
		{
			id: 'th-sunrise-interview',
			source: 'gmail',
			subject: '面談日程のご相談',
			sender: '採用担当 / 株式会社サンライズ',
			identityId: 'id-sunrise',
			reasons: ['overdue'],
			needsReply: false,
			done: false,
			inQueue: true,
			lastAt: at(Y, '17:05')
		},
		{
			id: 'th-sato-thanks',
			source: 'gmail',
			subject: '資料ありがとうございました',
			sender: '佐藤 美咲 / XYZ 株式会社',
			identityId: 'id-sato-mail',
			personId: 'p-sato',
			companyId: 'c-xyz',
			projectId: 'pj-xyz-ai',
			reasons: ['project', 'known_contact'],
			needsReply: false,
			done: false,
			inQueue: true,
			lastAt: at(key(addDays(-2, b)), '15:30')
		},
		{
			id: 'th-soumu-office',
			source: 'gmail',
			subject: 'オフィス移転の件',
			sender: '総務 / 株式会社 KUROKO',
			identityId: 'id-soumu',
			companyId: 'c-kuroko',
			reasons: [],
			needsReply: false,
			done: false,
			inQueue: true,
			lastAt: at(key(addDays(-2, b)), '11:20')
		}
	];

	// 未登録の差出人 (サンライズ鈴木様)の過去のやり取り。People への登録提案の材料になる
	const sunriseThreads: MessageThread[] = [
		{
			id: 'th-sunrise-quote',
			source: 'gmail',
			subject: 'ご見積のご送付',
			sender: '採用担当 / 株式会社サンライズ',
			identityId: 'id-sunrise',
			reasons: [],
			needsReply: false,
			done: false,
			inQueue: false,
			lastAt: at(key(addDays(-20, b)), '14:10')
		},
		{
			id: 'th-sunrise-thanks',
			source: 'gmail',
			subject: 'デモのお礼',
			sender: '採用担当 / 株式会社サンライズ',
			identityId: 'id-sunrise',
			reasons: [],
			needsReply: false,
			done: false,
			inQueue: false,
			lastAt: at(key(addDays(-35, b)), '11:25')
		}
	];

	const fillerThreads: MessageThread[] = FILLER_SUBJECTS.map((f, i) => ({
		id: `th-f-${i + 1}`,
		source: 'gmail' as const,
		subject: f.subject,
		sender: f.from,
		identityId: `id-f-${i + 1}`,
		reasons: [],
		needsReply: false,
		done: false,
		inQueue: false,
		lastAt: at(key(addDays(-Math.floor(i / 4) - 1, b)), `${7 + (i % 12)}:${String((i * 7) % 60).padStart(2, '0')}`)
	}));

	const messages: Message[] = [
		{
			id: 'mg-tanaka-next-me',
			threadId: 'th-tanaka-next',
			from: 'me',
			body: '田中様\n\nお世話になっております。株式会社 KUROKO の佐々木です。\n\nご検討いただきありがとうございます。\n提案書の修正版をお送りしますので、ご確認のほどよろしくお願いいたします。',
			at: at(Y, '18:22'),
			sentVia: 'approval'
		},
		{
			id: 'mg-tanaka-next',
			threadId: 'th-tanaka-next',
			from: 'them',
			body: '佐々木様\n\nお世話になっております。ABC 株式会社の田中です。\n\n先日の提案について社内で検討が進んでおります。\n次回のお打ち合わせを来週で設定できればと思うのですが、\nご都合はいかがでしょうか。\n\nよろしくお願いいたします。',
			at: at(T, '9:12')
		},
		{
			id: 'mg-sato-training',
			threadId: 'th-sato-training',
			from: 'them',
			body: '佐々木様\n\nいつもお世話になっております。XYZ 株式会社の佐藤です。\n\nAI 研修の内容について、対象者を管理職に絞る案が社内で出ています。\nカリキュラムの調整は可能でしょうか。',
			at: at(T, '8:45')
		},
		{
			id: 'mg-yamada-quote',
			threadId: 'th-yamada-quote',
			from: 'them',
			body: '佐々木さん、XYZ 社向けの見積書を作成しました。\n金額と条件をご確認ください。\n(Slack #sales より)',
			at: at(T, '8:20')
		},
		{
			id: 'mg-abc-invoice',
			threadId: 'th-abc-invoice',
			from: 'them',
			body: `佐々木様\n\n${prevMonth} 月分の請求書をお送りいたします。\nご確認のほどよろしくお願いいたします。`,
			at: at(T, '8:05')
		},
		{
			id: 'mg-tanaka-line',
			threadId: 'th-tanaka-line',
			from: 'them',
			body: '先ほどの件、了解しました。社内で共有しておきます。',
			at: at(Y, '19:40')
		},
		{
			id: 'mg-sunrise-interview',
			threadId: 'th-sunrise-interview',
			from: 'them',
			body: '佐々木様\n\n株式会社サンライズの鈴木です。\n先日ご相談した面談の日程について、今週中にご希望をいただけますでしょうか。',
			at: at(Y, '17:05')
		},
		{
			id: 'mg-sato-thanks',
			threadId: 'th-sato-thanks',
			from: 'them',
			body: '佐々木様\n\n研修資料をお送りいただきありがとうございました。\n社内で共有いたします。',
			at: at(key(addDays(-2, b)), '15:30')
		},
		{
			id: 'mg-soumu-office',
			threadId: 'th-soumu-office',
			from: 'them',
			body: '佐々木社長\n\nオフィス移転の候補物件を 3 件に絞りました。\n来週、内見の日程を調整させてください。',
			at: at(key(addDays(-2, b)), '11:20')
		},
		{
			id: 'mg-sunrise-quote',
			threadId: 'th-sunrise-quote',
			from: 'them',
			body: '佐々木様\n\n株式会社サンライズの鈴木です。\nご依頼いただいたお見積をお送りいたします。ご確認をお願いいたします。',
			at: at(key(addDays(-20, b)), '14:10')
		},
		{
			id: 'mg-sunrise-thanks',
			threadId: 'th-sunrise-thanks',
			from: 'them',
			body: '佐々木様\n\n株式会社サンライズの鈴木です。\n本日はデモのお時間をいただきありがとうございました。',
			at: at(key(addDays(-35, b)), '11:25')
		},
		// 件名だけだったメールにも本文を 1 通ずつ持たせる (一覧の「すべて」から開けるため)
		...fillerThreads.map((t, i) => ({
			id: `mg-f-${i + 1}`,
			threadId: t.id,
			from: 'them' as const,
			body: FILLER_SUBJECTS[i].body,
			at: t.lastAt
		}))
	];

	const documents: Document[] = [
		{
			id: 'doc-abc-proposal',
			kind: '提案書',
			title: 'ABC 株式会社 DX 導入提案書',
			projectId: 'pj-abc-dx',
			personId: 'p-tanaka',
			createdBy: 'KUROKO',
			createdAt: at(Y, '10:24'),
			sections: [...DOC_TEMPLATES['提案書']('ABC 株式会社', 'DX 導入')]
		},
		{
			id: 'doc-xyz-quote',
			kind: '見積書',
			title: 'XYZ 株式会社 AI 研修 御見積書',
			projectId: 'pj-xyz-ai',
			personId: 'p-sato',
			createdBy: 'KUROKO',
			createdAt: at(key(addDays(-2, b)), '16:32'),
			sections: [...DOC_TEMPLATES['見積書']('XYZ 株式会社', 'AI 研修')]
		},
		{
			id: 'doc-report-prev',
			kind: '報告書',
			title: `${prevMonth} 月活動報告`,
			createdBy: 'user',
			createdAt: at(key(addDays(-6, b)), '9:15'),
			sections: [...DOC_TEMPLATES['報告書']('ABC 株式会社', '')]
		},
		{
			id: 'doc-abc-quote',
			kind: '見積書',
			title: 'ABC 社_見積書.pdf',
			projectId: 'pj-abc-dx',
			personId: 'p-tanaka',
			createdBy: 'KUROKO',
			createdAt: at(key(addDays(-21, b)), '16:40'),
			sections: [
				{
					heading: 'ABC 社_見積書.pdf',
					body: 'DX 導入の初期費用、月額利用料、研修費用をまとめた見積書です。'
				}
			]
		},
		{
			id: 'doc-abc-minutes',
			kind: '報告書',
			title: `議事録 ${md(-21)}`,
			projectId: 'pj-abc-dx',
			personId: 'p-tanaka',
			createdBy: 'KUROKO',
			createdAt: at(key(addDays(-21, b)), '17:30'),
			sections: [
				{
					heading: `議事録 ${md(-21)}`,
					body: '見積の提示と価格条件のすり合わせを行い、社内稟議の進め方を確認しました。'
				}
			]
		},
		{
			id: 'doc-xyz-training',
			kind: '提案書',
			title: 'XYZ 社_研修提案.pdf',
			projectId: 'pj-xyz-ai',
			personId: 'p-sato',
			createdBy: 'KUROKO',
			createdAt: at(key(addDays(-18, b)), '14:05'),
			sections: [
				{
					heading: 'XYZ 社_研修提案.pdf',
					body: '管理職向け AI 研修のカリキュラム案と実施スケジュールをまとめた資料です。'
				}
			]
		}
	];

	const quoteBody =
		'佐藤様\n\nお世話になっております。ご依頼の見積書 (修正版) をお送りします。\n添付: XYZ 社_見積書.pdf\n\nご確認のほどよろしくお願いいたします。';

	return {
		version: DB_VERSION,
		seededOn: T,
		user: { id: 'u-sasaki', name: '佐々木 健', company: '株式会社 KUROKO', title: '代表取締役' },
		companies: [
			{ id: 'c-abc', name: 'ABC 株式会社', domain: 'abc.co.jp', industry: '製造業', size: '従業員 320 名' },
			{ id: 'c-xyz', name: 'XYZ 株式会社', domain: 'xyz.co.jp', industry: '小売業', size: '従業員 120 名' },
			{ id: 'c-kuroko', name: '株式会社 KUROKO', domain: 'kuroko.co.jp', industry: 'IT', size: '従業員 12 名' },
			{ id: 'c-sunrise', name: '株式会社サンライズ', domain: 'sunrise.co.jp', industry: '人材', size: '従業員 40 名' }
		],
		people: [
			{
				id: 'p-tanaka',
				name: '田中 太郎',
				kana: 'たなか たろう',
				companyId: 'c-abc',
				title: '営業部長',
				phone: '03-1234-5678',
				memo: '佐藤さんから紹介。\n価格について慎重。\n決裁は本人。',
				tags: ['重要', '決裁者'],
				projectIds: ['pj-abc-dx', 'pj-abc-analysis']
			},
			{
				id: 'p-sato',
				name: '佐藤 美咲',
				kana: 'さとう みさき',
				companyId: 'c-xyz',
				title: '人事部 課長',
				phone: '03-9876-5432',
				memo: 'AI 研修の担当。\n今月中に見積が欲しい。',
				tags: ['研修'],
				projectIds: ['pj-xyz-ai', 'pj-xyz-elearning']
			},
			{
				id: 'p-yamada',
				name: '山田 健二',
				kana: 'やまだ けんじ',
				companyId: 'c-kuroko',
				title: '営業',
				phone: '090-1111-2222',
				memo: '社内。見積書の確認担当。',
				tags: ['社内'],
				projectIds: []
			}
		],
		identities: [
			{ id: 'id-tanaka-mail', personId: 'p-tanaka', kind: 'email', value: 'tanaka@abc.co.jp', label: 'Gmail' },
			{ id: 'id-tanaka-line', personId: 'p-tanaka', kind: 'line_id', value: 'Uabcdef01', label: 'LINE' },
			{ id: 'id-sato-mail', personId: 'p-sato', kind: 'email', value: 'sato@xyz.co.jp', label: 'Gmail' },
			{ id: 'id-sato-slack', personId: 'p-sato', kind: 'slack_id', value: 'U0123SATO', label: 'Slack' },
			{ id: 'id-yamada-slack', personId: 'p-yamada', kind: 'slack_id', value: 'U0123YAMA', label: 'Slack' },
			{ id: 'id-yamada-line', personId: 'p-yamada', kind: 'line_id', value: 'Uyamada02', label: 'LINE' },
			{ id: 'id-abc-keiri', kind: 'email', value: 'keiri@abc.co.jp', label: 'Gmail' },
			{ id: 'id-sunrise', kind: 'email', value: 'suzuki@sunrise.co.jp', label: 'Gmail' },
			{ id: 'id-soumu', kind: 'email', value: 'soumu@kuroko.co.jp', label: 'Gmail' },
			...FILLER_SUBJECTS.map((f, i) => ({ id: `id-f-${i + 1}`, kind: 'email' as const, value: f.mail, label: 'Gmail' }))
		],
		projects: [
			{
				id: 'pj-abc-dx',
				name: 'ABC 社 DX 導入',
				companyId: 'c-abc',
				status: '提案中',
				amount: '300 万円',
				nextDate: B1,
				personIds: ['p-tanaka'],
				documentIds: ['doc-abc-proposal', 'doc-abc-quote', 'doc-abc-minutes']
			},
			{
				id: 'pj-xyz-ai',
				name: 'XYZ 社 AI 研修',
				companyId: 'c-xyz',
				status: '見積提出',
				amount: '120 万円',
				personIds: ['p-sato'],
				documentIds: ['doc-xyz-training', 'doc-xyz-quote']
			},
			/* 進行中の 2 件の前後にある案件。状態の色分けは derived.ts の projectStatusClass。
			   並び順は先頭を変えない (人物の projectIds[0] を既定の案件として使う箇所がある) */
			{
				id: 'pj-abc-analysis',
				name: 'ABC 社 業務分析',
				companyId: 'c-abc',
				status: '受注',
				amount: '80 万円',
				personIds: ['p-tanaka'],
				documentIds: []
			},
			{
				id: 'pj-xyz-elearning',
				name: 'XYZ 社 店舗向け e ラーニング',
				companyId: 'c-xyz',
				status: '検討中',
				amount: '90 万円',
				personIds: ['p-sato'],
				documentIds: []
			},
			// 面談日程の相談 (th-sunrise-interview) がこれから始まる案件。担当者は未登録
			{
				id: 'pj-sunrise-interview',
				name: 'サンライズ社 面談代行',
				companyId: 'c-sunrise',
				status: '商談前',
				amount: '未定',
				personIds: [],
				documentIds: []
			},
			// 見積を出したが見送られた案件 (th-sunrise-quote が当時のやり取り)
			{
				id: 'pj-sunrise-ats',
				name: 'サンライズ社 採用管理ツール',
				companyId: 'c-sunrise',
				status: '失注',
				amount: '150 万円',
				personIds: [],
				documentIds: []
			}
		],
		threads: [...queueThreads, ...sunriseThreads, ...fillerThreads],
		messages,
		events: [
			{ id: 'ev-standup', date: T, start: '10:00', end: '11:00', title: '社内定例', place: '渋谷', personIds: ['p-yamada'], source: 'gcal' },
			{ id: 'ev-shibuya', date: T, start: '13:00', end: '14:00', title: '打ち合わせ', place: '渋谷', personIds: [], source: 'gcal' },
			{ id: 'ev-sato-call', date: T, start: '17:30', end: '18:00', title: 'XYZ 株式会社 佐藤様 電話', personIds: ['p-sato'], companyId: 'c-xyz', projectId: 'pj-xyz-ai', source: 'gcal' },
			{
				id: 'ev-abc-meeting',
				date: B1,
				start: '15:00',
				end: '16:00',
				title: 'ABC 株式会社 商談',
				place: 'オンライン',
				online: 'meet',
				url: 'meet.google.com/abc-defg-hij',
				personIds: ['p-tanaka'],
				companyId: 'c-abc',
				projectId: 'pj-abc-dx',
				meetingId: 'm-abc',
				source: 'gcal',
				purpose: '価格条件を詰めて契約時期を決める'
			},
			/* 過去の商談 2 件。m-abc の Brief の履歴 (デモ実施 / 見積提示) と日付をそろえる。
			   People の「最終商談」と「会議 N 件」はここから値が出る */
			{
				id: 'ev-abc-demo',
				date: key(addDays(-41, b)),
				start: '14:00',
				end: '15:00',
				title: 'ABC 株式会社 デモ実施',
				place: 'オンライン',
				online: 'meet',
				personIds: ['p-tanaka'],
				companyId: 'c-abc',
				projectId: 'pj-abc-dx',
				meetingId: 'm-abc-demo',
				source: 'gcal'
			},
			{
				id: 'ev-abc-quote',
				date: key(addDays(-21, b)),
				start: '15:00',
				end: '16:30',
				title: 'ABC 株式会社 見積提示',
				place: '渋谷',
				personIds: ['p-tanaka'],
				companyId: 'c-abc',
				projectId: 'pj-abc-dx',
				meetingId: 'm-abc-quote',
				source: 'gcal'
			},
			{ id: 'ev-standup-2', date: B4, start: '10:00', end: '11:00', title: '社内定例', place: '渋谷', personIds: ['p-yamada'], source: 'gcal' },
			{ id: 'ev-shinagawa', date: B5, start: '14:00', end: '15:30', title: '外出 (取引先訪問)', place: '品川', personIds: [], source: 'gcal' },
			{ id: 'ev-wed', date: WED, start: '13:00', end: '15:00', title: '打ち合わせ', place: '品川', personIds: [], source: 'gcal' }
		],
		meetings: [
			{
				id: 'm-abc',
				eventId: 'ev-abc-meeting',
				title: 'ABC 株式会社 商談',
				personIds: ['p-tanaka'],
				companyId: 'c-abc',
				projectId: 'pj-abc-dx',
				purpose: '価格条件を詰めて契約時期を決める',
				briefRead: false,
				agenda: [],
				agendaShared: false,
				transcriptIds: [],
				brief: {
					createdAt: at(Y, '21:00'),
					history: [`${md(-57)} 初回商談`, `${md(-41)} デモ実施`, `${md(-21)} 見積提示`],
					lastPoints: ['価格について懸念あり'],
					homework: ['未提出: 導入スケジュールの提出'],
					recentContacts: [`社内稟議中との連絡あり (${md(-14)} LINE)`],
					documentIds: ['doc-abc-proposal', 'doc-abc-quote']
				}
			},
			{
				id: 'm-abc-demo',
				eventId: 'ev-abc-demo',
				title: 'ABC 株式会社 デモ実施',
				personIds: ['p-tanaka'],
				companyId: 'c-abc',
				projectId: 'pj-abc-dx',
				purpose: '製品デモで適用範囲の当たりを付ける',
				briefRead: true,
				agenda: [],
				agendaShared: true,
				transcriptIds: [],
				minutes: {
					summary: '基幹システムとの連携範囲をデモで確認し、次は見積の提示に進むことで合意しました。',
					decisions: ['対象部署は営業部から始める', '見積は 2 週間以内に提示する'],
					followUpMail: {
						to: '田中 太郎 <tanaka@abc.co.jp>',
						subject: '本日のデモのお礼',
						body: '田中様\n\n本日はデモのお時間をいただきありがとうございました。\n見積は 2 週間以内にお送りいたします。'
					}
				}
			},
			{
				id: 'm-abc-quote',
				eventId: 'ev-abc-quote',
				title: 'ABC 株式会社 見積提示',
				personIds: ['p-tanaka'],
				companyId: 'c-abc',
				projectId: 'pj-abc-dx',
				purpose: '見積を提示して価格条件をすり合わせる',
				briefRead: true,
				agenda: [],
				agendaShared: true,
				transcriptIds: [],
				minutes: {
					summary: '初期費用と月額の内訳を説明し、価格について社内稟議を進めていただくことになりました。',
					decisions: ['稟議の結果は次回商談までに共有', '導入スケジュールは別途提出'],
					followUpMail: {
						to: '田中 太郎 <tanaka@abc.co.jp>',
						subject: '御見積の送付',
						body: '田中様\n\n本日はお時間をいただきありがとうございました。\n御見積をお送りしますので、ご確認のほどよろしくお願いいたします。'
					}
				}
			}
		],
		transcripts: [],
		tasks: [
			{ id: 't-abc-proposal', title: 'ABC 社へ提案書の修正版を送る', due: T, time: '18:00', priority: 'high', projectId: 'pj-abc-dx', status: 'todo', origin: 'tasks', createdAt: at(Y, '9:00') },
			{ id: 't-xyz-quote', title: 'XYZ 社の見積を確認する', due: T, priority: 'normal', projectId: 'pj-xyz-ai', status: 'todo', origin: 'today', createdAt: at(T, '8:30') },
			{ id: 't-cards', title: '名刺の登録 (展示会分)', due: T, priority: 'low', status: 'todo', origin: 'tasks', createdAt: at(Y, '9:00') },
			{ id: 't-training', title: '研修日程を佐藤様に連絡する', due: B3, priority: 'normal', personId: 'p-sato', status: 'todo', origin: 'tasks', memo: `${md(-18)}の打ち合わせで依頼`, createdAt: at(Y, '9:00') },
			{ id: 't-standup-doc', title: '社内定例の資料をまとめる', due: B4, priority: 'normal', status: 'todo', origin: 'tasks', createdAt: at(Y, '9:00') },
			{ id: 't-expense', title: '先週分の経費を提出する', due: key(addDays(-3, b)), priority: 'low', status: 'done', origin: 'tasks', createdAt: at(key(addDays(-7, b)), '9:00') }
		],
		documents,
		approvals: [
			{
				id: 'ap-xyz-quote',
				title: 'XYZ 社 佐藤様への見積書 (修正版) の送付',
				risk: 'external_send',
				kind: 'mail',
				to: '佐藤 美咲 <sato@xyz.co.jp>',
				subject: 'AI 研修 御見積書 (修正版) のご送付',
				body: quoteBody,
				status: 'pending',
				createdAt: at(T, '9:58'),
				payload: { type: 'reply', threadId: 'th-sato-training', body: quoteBody },
				origin: 'inbox'
			},
			{
				id: 'ap-abc-minutes',
				title: 'ABC 社 田中様への前回議事録の共有',
				risk: 'external_send',
				kind: 'mail',
				to: '田中 太郎 <tanaka@abc.co.jp>',
				body: `前回商談 (${md(-21)}) の議事録を Google ドライブのリンクで共有します。`,
				status: 'pending',
				createdAt: at(T, '8:55'),
				payload: { type: 'share', personId: 'p-tanaka', what: `議事録 ${md(-21)}` },
				origin: 'meeting'
			},
			/* 社内の 3 件。初期の自動化レベル (下の settings.automation) では社内は自動で実行される
			   ので、承認待ちではなく実行済みとして持つ (actions.ts の autoExecutes と同じ切り分け)。
			   出る場所は承認待ちドロワーの「実行済み」(ApprovalDrawer が executedAt の新しい順に 3 件)。
			   承認待ちの件数には入らない (derived.ts の pendingApprovals は pending のみ) */
			{
				id: 'ap-yamada-quote-ok',
				title: '山田さんへの見積書の確認結果の返信',
				risk: 'internal',
				kind: 'slack',
				to: '山田 健二 (Slack)',
				body: '見積書を確認しました。金額と条件ともにこの内容で問題ありません。',
				status: 'executed',
				createdAt: at(T, '8:32'),
				executedAt: at(T, '8:32'),
				payload: { type: 'reply', threadId: 'th-yamada-quote', body: '見積書を確認しました。' },
				origin: 'slack'
			},
			{
				id: 'ap-standup-doc',
				title: '社内定例の資料のたたき台の共有',
				risk: 'internal_low',
				kind: 'slack',
				to: '山田 健二 (Slack)',
				subject: '社内定例 資料のたたき台',
				body: '前回の決定事項と今週の進捗をまとめたたたき台です。',
				status: 'executed',
				createdAt: at(T, '8:12'),
				executedAt: at(T, '8:12'),
				payload: { type: 'share', personId: 'p-yamada', what: '社内定例 資料のたたき台' },
				origin: 'slack'
			},
			{
				id: 'ap-yamada-line-remind',
				title: '山田さんへの内見の日程の確認',
				risk: 'internal_low',
				kind: 'line',
				to: '山田 健二 (LINE)',
				body: 'オフィスの内見、来週で日程を押さえておいてください。',
				status: 'executed',
				createdAt: at(Y, '20:05'),
				executedAt: at(Y, '20:05'),
				payload: { type: 'line', text: 'オフィスの内見、来週で日程を押さえておいてください。' },
				origin: 'line'
			}
		],
		suggestions: [
			/* 田中様のメールから拾った宿題の候補。KUROKO は登録まではせず、必ず人が選ぶ (仕様 5.4)。
			   中身は m-abc の Brief の homework と同じ宿題を指す。出る場所は /tasks の候補カード */
			{
				id: 'sg-abc-schedule',
				source: 'email',
				kind: 'task',
				status: 'pending',
				reason: '「次回お打ち合わせについて」の社内検討中との連絡から抽出',
				payload: {
					type: 'task',
					title: 'ABC 社へ導入スケジュールを提出する',
					due: B3,
					personId: 'p-tanaka',
					projectId: 'pj-abc-dx'
				},
				createdAt: at(T, '9:15')
			}
		] satisfies Suggestion[],
		scheduling: [],
		logs: [
			{ id: 'log-1', at: at(T, '9:58'), actor: 'KUROKO', kind: 'draft', text: 'XYZ 社 見積書 (修正版) の下書きを作成し承認待ちにしました', origin: 'inbox', approved: false },
			{ id: 'log-2', at: at(T, '9:12'), actor: 'KUROKO', kind: 'other', text: `受信 ${8 + FILLER_SUBJECTS.length} 件から 8 件を要対応として選びました`, origin: 'inbox', approved: false },
			{ id: 'log-3', at: at(T, '8:55'), actor: 'KUROKO', kind: 'draft', text: '前回議事録の共有を承認待ちにしました', origin: 'meeting', approved: false },
			{ id: 'log-4', at: at(T, '8:30'), actor: 'user', kind: 'register', text: 'ToDo「XYZ 社の見積を確認する」を登録しました', origin: 'today', approved: false },
			{ id: 'log-5', at: at(Y, '21:00'), actor: 'KUROKO', kind: 'other', text: 'ABC 株式会社商談の Brief を作成しました', origin: 'meeting', approved: false },
			{ id: 'log-6', at: at(Y, '18:22'), actor: 'user', kind: 'send', text: '田中様へメールを送信しました', origin: 'inbox', approved: true }
		],
		chat: [],
		line: [
			{ id: 'ln-1', who: '佐藤', text: '明日の資料どうします?', at: '10:12' },
			{ id: 'ln-2', who: '山田', text: '確認します', at: '10:15' }
		],
		slack: [],
		settings: {
			automation: 'internal_auto',
			connections: [
				{ id: 'gmail', connected: false },
				{ id: 'gcal', connected: false },
				{ id: 'slack', connected: false },
				{ id: 'line', connected: false }
			],
			retention: { saveMailBody: false, transcriptMonths: 12, learning: false, region: '東京リージョン' }
		},
		demo: {
			started: false,
			guide: { on: false },
			recent: [],
			stats: { approved: 0, replied: 0, confirmed: 0, tasksAdded: 0, tasksDone: 0 },
			lineRole: 'owner',
			lineTab: 'line'
		}
	};
}

# KUROKO AI デモ

投資家向けのデモです。SvelteKit 2 + Svelte 5 で作られていて、**ブラウザの中だけで動きます**。サーバーもデータベースもありません。メール送信、カレンダー連携、名刺の読み取りなどはすべて `src/lib/integrations/mock/` の擬似実装が返しており、外部のサービスには一切つながっていません。

## 起動方法

```
npm i
npm run dev      # 開発サーバー
npm run build    # 静的ファイルを出力 (adapter-static)
npm run preview  # build の結果を確認する
npm test         # vitest
npm run check    # svelte-check による型検査
```

## デモの流れ

### ゴールデンパス

通しで見せる手順です。上部バー右端の「デモの操作」アイコンから **「デモを開始する」** を選ぶと案内が始まり、進み具合に応じて次の 5 つの段階が順に表示されます (段階の判定は `src/lib/derived.ts` の `guideSection`)。

1. **承認を片付ける** — Today の承認待ちを開き、2 件を承認します
2. **田中様に返信する** — Inbox で田中様のメールを開き、「日程候補を入れる」で返信案を作って送信し、承認します
3. **日程が決まる** — Today の「日程調整の返信待ち」を押すと相手側の画面 (`/schedule/[token]`) が別タブで開きます。候補を選んで確定すると、元のタブに反映されます
4. **会議の前後** — Today の「次の会議」から Brief を確認し、アジェンダを作成、文字起こしを追加して ToDo 候補を 2 件登録します
5. **今日を終える** — 今日の ToDo 3 件を完了にします

5 つを終えると完了画面が出ます。

最初から見せる場合は、ルート (`/`) の Welcome 画面から「接続」(`/connect`) を経て Today に入る流れになります。Welcome 画面には接続を飛ばして Today へ直行するボタンもあります。

### 8 つのシナリオ

「デモの操作」メニューの **「他のシナリオを試す」**、または `⌘K` のコマンドパレットから選べます。定義は `src/lib/scenarios.ts` の `SCENARIOS` にあります。

1. Today から予定追加 → 田中さん・ABC 社案件を選択 → Meet 作成 → Calendar / Today 反映 → Meeting 生成
2. Inbox から「KUROKO に依頼」→ 過去のやり取り照会 → 人物プロフィール
3. KUROKO チャットで「金曜までに ABC 社へ見積提出、覚えて」→ 確認 → Task 登録
4. People から名刺 OCR → 確認 → 登録 → 過去メールの関連付け提案
5. LINE Demo: 「@KUROKO 明日 17 時までに資料確認、ToDo 入れて」→ Tasks 反映
6. LINE Demo: 承認を LINE で返す / Member 権限の挙動
7. KUROKO チャットから提案書生成
8. 移動時間の警告を発火させる予定作成 (渋谷 13:00 の後に 品川 14:30)

同じメニューの **「デモをリセット」** で初期状態に戻せます。

## 状態の保存場所

`localStorage` のキー `kuroko-demo` に、状態全体を JSON で書き出しています (`src/lib/store.svelte.ts`)。

読み込み時 (`loadFromStorage`)に次のどちらかに当てはまると、保存された内容を捨てて初期データ (`src/lib/seed.ts` の `seed()`) を作り直します。

- データの版 (`DB_VERSION`)が現在のものと違う
- 作られた日 (`seededOn`)が今日ではない

デモのデータは「今日の 15:00」のように今日を基準にした日時を持っているため、**日付が変わると初期化されます**。

同じブラウザで複数のタブを開いている場合、`installStorageSync` が `storage` イベントを受けて他のタブの変更を取り込みます。ゴールデンパスの 3 番目で、別タブの日程確定が元のタブに反映されるのはこの仕組みによるものです。

## 5 秒の送信保留について

社外へ送るものを承認すると、すぐには実行せず 5 秒待ってから実行します (`src/lib/actions.ts` の `SEND_DELAY_MS`、`approve()`)。この間は通知から取り消せます (`undoApproval()`)。

デモでは `setTimeout` で待っているだけなので、ページを閉じると待機中の処理は消えます。実運用ではジョブキューに載せ、予約した実行をサーバー側で保持する形になります。

## 実 API 化する際の接続ポイント

外部サービスとの境界は `src/lib/integrations/types.ts` のインターフェースに集めてあり、擬似実装は `src/lib/integrations/mock/` にあります。`src/lib/integrations/index.ts` がそれらをまとめて `integrations` として公開しているので、差し替えるのはこのディレクトリだけで済みます。

| 境界 | 擬似実装 | 接続先 | 検討が必要な点 |
| --- | --- | --- | --- |
| `MailProvider`<br>`listThreads` / `sendMessage` / `createDraft` | `mock/mail.ts` | Gmail API `users.messages.send` / `users.messages.list` | restricted scope に当たるため、CASA (Google が求める第三者のセキュリティ審査)を通す必要があります |
| `CalendarProvider`<br>`listEvents` / `createEvent` / `updateEvent` / `deleteEvent` / `findFreeSlots` | `mock/calendar.ts` | Google Calendar API | 双方向に同期するため、同じ予定が両側で変更されたときにどちらを採るかの方針を決める必要があります |
| `ChatProvider` (LINE)<br>`post` | `mock/chat.ts` | LINE Messaging API | 社外のメンバーが混ざったグループに投稿しうるため、何を出して何を出さないかの制御が必要です |
| `ChatProvider` (Slack)<br>`post` | `mock/chat.ts` | Slack Events API / Web API | 受け取るのは `app_mention` (アプリ宛のメンション)だけに限ります |
| 会議の録音 | — | — | 対象外です。参加者全員の同意と、各会議サービスが Bot の参加に課す規約が壁になります |
| `OcrProvider`<br>`scanBusinessCard` | `mock/ocr.ts` | Vision 系の API | 名刺の画像を保存するのか、読み取ったあと破棄するのかの方針を決める必要があります |
| `ConferenceProvider`<br>`createMeetingUrl` | `mock/conference.ts` | Google Meet API / Zoom API | — |
| `DocumentProvider`<br>`generate` / `brief` | `mock/document.ts` | 大規模言語モデルによる生成 | — |

各擬似実装の先頭には、差し替え先を書いた `TODO(real):` のコメントを置いてあります。

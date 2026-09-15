export type Source = 'gmail' | 'gcal' | 'slack' | 'line' | 'kuroko';
export type RiskLevel = 'external_send' | 'internal' | 'internal_low';
export type Origin = 'today' | 'chat' | 'inbox' | 'line' | 'slack' | 'approval' | 'calendar' | 'meeting' | 'people' | 'tasks' | 'documents' | 'schedule' | 'palette';
export const ORIGIN_LABEL: Record<Origin, string> = { today: 'Today', chat: 'チャット', inbox: 'Inbox', line: 'LINE', slack: 'Slack', approval: '承認センター', calendar: 'カレンダー', meeting: '会議', people: 'People', tasks: 'ToDo', documents: 'ドキュメント', schedule: '日程調整', palette: '検索' };
export type Reason = 'overdue' | 'unanswered_3d' | 'question' | 'project' | 'known_contact';
export const REASON_ORDER: Reason[] = ['overdue', 'unanswered_3d', 'question', 'project', 'known_contact'];
export const REASON_LABEL: Record<Reason, string> = { overdue: '返信期限超過', unanswered_3d: '3日間未返信', question: '質問が含まれています', project: '案件', known_contact: '登録済みの相手' };
export type LogKind = 'draft' | 'hold' | 'send' | 'register' | 'other';
export type Automation = 'draft' | 'internal_auto' | 'trusted';

export interface User { id: string; name: string; company: string; title: string }
export interface Person { id: string; name: string; kana: string; companyId?: string; title: string; phone?: string; memo: string; tags: string[]; projectIds: string[] }
export interface ChannelIdentity { id: string; personId?: string; kind: 'email' | 'slack_id' | 'line_id'; value: string; label: string }
export interface Company { id: string; name: string; domain: string; industry: string; size: string }
export type ProjectStatus = '商談前' | '提案中' | '見積提出' | '検討中' | '受注' | '失注';
export interface Project { id: string; name: string; companyId: string; status: ProjectStatus; amount: string; nextDate?: string; personIds: string[]; documentIds: string[] }
export interface MessageThread { id: string; source: Source; subject: string; sender: string; identityId: string; personId?: string; companyId?: string; projectId?: string; reasons: Reason[]; needsReply: boolean; done: boolean; inQueue: boolean; lastAt: string }
export interface Message { id: string; threadId: string; from: 'me' | 'them'; body: string; at: string; sentVia?: 'approval' }
export interface CalendarEvent { id: string; date: string; start: string; end: string; title: string; place?: string; online?: 'meet' | 'zoom'; url?: string; personIds: string[]; companyId?: string; projectId?: string; meetingId?: string; source: 'gcal' | 'kuroko'; tentative?: boolean; bufferBefore?: number; bufferAfter?: number; remind?: number; purpose?: string }
export interface Brief { createdAt: string; note?: string; history: string[]; lastPoints: string[]; homework: string[]; recentContacts: string[]; documentIds: string[] }
export interface Minutes { summary: string; decisions: string[]; followUpMail: { to: string; subject: string; body: string } }
export interface Meeting { id: string; eventId: string; title: string; personIds: string[]; companyId?: string; projectId?: string; purpose: string; brief?: Brief; briefRead: boolean; agenda: string[]; agendaShared: boolean; transcriptIds: string[]; minutes?: Minutes }
export interface Transcript { id: string; meetingId: string; text: string; addedAt: string }
export interface Task { id: string; title: string; due?: string; time?: string; priority: 'high' | 'normal' | 'low'; personId?: string; companyId?: string; projectId?: string; meetingId?: string; memo?: string; status: 'todo' | 'doing' | 'done'; origin: Origin; createdAt: string }
export interface Document { id: string; kind: '提案書' | '見積書' | '報告書'; title: string; projectId?: string; personId?: string; createdBy: 'KUROKO' | 'user'; createdAt: string; sections: { heading: string; body: string }[] }
export type ApprovalKind = 'mail' | 'line' | 'slack' | 'share' | 'schedule' | 'document';
export interface Approval { id: string; title: string; risk: RiskLevel; kind: ApprovalKind; to: string; subject?: string; body: string; effectLine: string; status: 'pending' | 'sending' | 'executed' | 'rejected'; createdAt: string; sendingAt?: string; executedAt?: string; payload: ApprovalPayload; origin: Origin }
export type ApprovalPayload =
  | { type: 'reply'; threadId: string; body: string; schedulingId?: string }
  | { type: 'share'; personId: string; what: string }
  | { type: 'agenda'; meetingId: string }
  | { type: 'document'; documentId: string; personId: string }
  | { type: 'followup'; meetingId: string; threadId?: string }
  | { type: 'line'; text: string };
export type SuggestionKind = 'task' | 'person' | 'link_threads' | 'link_project' | 'event';
export interface Suggestion { id: string; source: 'chat' | 'transcript' | 'ocr' | 'email' | 'line'; kind: SuggestionKind; status: 'pending' | 'accepted' | 'rejected'; reason: string; payload: SuggestionPayload; createdAt: string }
export type SuggestionPayload =
  | { type: 'task'; title: string; due?: string; time?: string; meetingId?: string; personId?: string; projectId?: string }
  | { type: 'person'; fields: CardFields }
  | { type: 'link_threads'; identityId: string; personId: string; threadIds: string[] }
  | { type: 'link_project'; personId: string; projectName: string; companyId: string }
  | { type: 'event'; title: string; date: string; start: string; end: string; personIds: string[]; projectId?: string; online?: 'meet' | 'zoom' };
export interface TimeSlot { id: string; date: string; start: string; end: string; selected: boolean; note?: string; warn?: string }
export interface SchedulingRequest { id: string; token: string; personId: string; duration: number; range: { from: string; to: string }; online: 'meet' | 'zoom' | 'none'; slots: TimeSlot[]; status: 'draft' | 'sent' | 'confirmed' | 'cancelled'; chosenSlotId?: string; threadId?: string; eventId?: string; meetingId?: string; text: string }
export interface ActivityLog { id: string; at: string; actor: 'user' | 'KUROKO'; kind: LogKind; text: string; origin: Origin; approved: boolean; undo?: UndoPayload; undone?: boolean }
export type UndoPayload =
  | { kind: 'task_add'; taskId: string }
  | { kind: 'task_done'; taskId: string }
  | { kind: 'event_add'; eventId: string }
  | { kind: 'agenda_share'; meetingId: string }
  | { kind: 'link_identity'; identityId: string }
  | { kind: 'approval_exec'; approvalId: string };
export interface ChatMessage { id: string; role: 'user' | 'kuroko'; text?: string; card?: ChatCard; chips?: string[]; at: string }
export interface ChatCard { icon: string; title: string; lines: string[]; reason?: string; actions: { label: string; act: string; arg?: string; primary?: boolean }[] }
export interface LineMessage { id: string; who: string; text: string; at: string; card?: { title: string; lines: string[]; actions?: { label: string; act: string; arg?: string; primary?: boolean }[] }; role?: 'owner' | 'member' }
export interface Connection { id: 'gmail' | 'gcal' | 'slack' | 'line'; connected: boolean; lastSync?: string }
export interface Settings { automation: Automation; connections: Connection[]; retention: { saveMailBody: boolean; transcriptMonths: number; learning: boolean; region: string } }
export interface Demo { started: boolean; guide: { on: boolean }; scenario?: number; recent: string[]; stats: { approved: number; replied: number; confirmed: number; tasksAdded: number; tasksDone: number }; lineRole: 'owner' | 'member'; lineTab: 'line' | 'slack' }
export interface CardFields { name: string; kana: string; company: string; title: string; email: string; phone: string; lowConfidence: string[] }
export interface TodayItem { kind: 'approval' | 'reply' | 'brief' | 'tasks' | 'sched'; n: number; label: string; detail: string; href: string }
export interface Db { version: number; seededOn: string; user: User; people: Person[]; identities: ChannelIdentity[]; companies: Company[]; projects: Project[]; threads: MessageThread[]; messages: Message[]; events: CalendarEvent[]; meetings: Meeting[]; transcripts: Transcript[]; tasks: Task[]; documents: Document[]; approvals: Approval[]; suggestions: Suggestion[]; scheduling: SchedulingRequest[]; logs: ActivityLog[]; chat: ChatMessage[]; line: LineMessage[]; slack: LineMessage[]; settings: Settings; demo: Demo }

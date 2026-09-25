import type {
	Brief,
	CalendarEvent,
	CardFields,
	Db,
	Document,
	LineMessage,
	Message,
	MessageThread
} from '../types';

// 外部サービスとの境界。デモでは mock/ が実装を持ち、実接続時はここだけ差し替える
export interface MailProvider {
	sendMessage(thread: MessageThread, body: string): Message;
}
export interface CalendarProvider {
	createEvent(db: Db, e: CalendarEvent): CalendarEvent;
	deleteEvent(db: Db, id: string): void;
}
export interface ChatProvider {
	post(channel: 'slack' | 'line', text: string, card?: LineMessage['card']): void;
}
export interface ConferenceProvider {
	createMeetingUrl(kind: 'meet' | 'zoom'): string;
}
export interface OcrProvider {
	scanBusinessCard(file: File): Promise<CardFields>;
}
export interface DocumentContext {
	companyName?: string;
	theme?: string;
	projectId?: string;
	personId?: string;
}
export interface DocumentProvider {
	generate(kind: Document['kind'], ctx: DocumentContext): Document;
	brief(db: Db, personId?: string, projectId?: string): Brief;
}

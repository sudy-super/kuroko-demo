import { mail } from './mock/mail';
import { calendar } from './mock/calendar';
import { chat } from './mock/chat';
import { conference } from './mock/conference';
import { ocr } from './mock/ocr';
import { document } from './mock/document';

export const integrations = { mail, calendar, chat, conference, ocr, document };
export type * from './types';

// TODO(real): Google Meet API と Zoom API に差し替える
import type { ConferenceProvider } from '../types';

const AZ = 'abcdefghijklmnopqrstuvwxyz';
const pick = (n: number, chars: string) =>
	Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

export const conference: ConferenceProvider = {
	createMeetingUrl: (kind) =>
		kind === 'meet'
			? `meet.google.com/${pick(3, AZ)}-${pick(4, AZ)}-${pick(3, AZ)}`
			: `zoom.us/j/${pick(11, '0123456789')}`
};

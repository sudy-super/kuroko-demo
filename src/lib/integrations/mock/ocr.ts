// TODO(real): Vision 系 API に差し替える。名刺画像を保存するか読み取り後に破棄するかの方針決定が要件
import type { OcrProvider } from '../types';

// 画像の中身は見ない。読み取りにかかる時間だけ再現する
const DELAY_MS = 1000;

export const ocr: OcrProvider = {
	scanBusinessCard() {
		return new Promise((resolve) =>
			setTimeout(
				() =>
					resolve({
						name: '鈴木 一郎',
						kana: 'すずき いちろう',
						company: '株式会社サンライズ',
						title: '採用担当',
						email: 'suzuki@sunrise.co.jp',
						phone: '03-5555-0101',
						lowConfidence: ['phone']
					}),
				DELAY_MS
			)
		);
	}
};

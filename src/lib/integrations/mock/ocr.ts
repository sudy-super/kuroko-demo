// TODO(real): Vision 系 API に差し替える。名刺画像を保存するか読み取り後に破棄するかの方針決定が要件
import type { OcrProvider } from '../types';

export const ocr: OcrProvider = {
	scanBusinessCard() {
		throw new Error('not implemented: 名刺の読み取りは Task 25 で実装する');
	}
};

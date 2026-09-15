// 960px の境目は app.css の @media (max-width: 960px) と同じ値。
// ドロワーとボトムシート、2 種類のヘッダーはクラスを差し替えて切り替えるので、JS 側でも幅を見る。
export const media = $state({ mobile: false });

if (typeof window !== 'undefined') {
	const mq = window.matchMedia('(max-width: 960px)');
	media.mobile = mq.matches;
	mq.addEventListener('change', (e) => (media.mobile = e.matches));
}

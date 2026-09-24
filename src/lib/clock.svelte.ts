/* 画面に出す「今」の時刻。上部バーの時計と週表示の現在時刻の線が読む。分の変わり目に合わせて進め、
   タブを隠している間はタイマーが間引かれるので、戻ってきたときにも合わせ直す */
export const clock = $state({ now: new Date() });

if (typeof window !== 'undefined') {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const tick = () => {
		clearTimeout(timer);
		clock.now = new Date();
		// 次の分の 0 秒の少し後。少し遅らせるのは、タイマーが早く発火して同じ分を描き直すのを避けるため
		timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
	};
	tick();
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) tick();
	});
}

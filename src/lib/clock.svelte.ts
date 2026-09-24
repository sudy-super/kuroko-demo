/* 画面に出す「今」の時刻。上部バーの時計と、週表示の現在時刻の線が読む。
   以前は画面を開いた時点から 60 秒ごとに進めていたので、分の変わり目から最大 59 秒遅れた。
   ここでは次の分の変わり目に合わせて進める。タブを隠している間はブラウザがタイマーを
   間引くので、戻ってきたときにも合わせ直す */
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

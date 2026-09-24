import { MediaQuery } from 'svelte/reactivity';

// 960px の境目は app.css の @media (max-width: 960px) と同じ値。
// ドロワーとボトムシート、2 種類のヘッダーはクラスを差し替えて切り替えるので、JS 側でも幅を見る。
export const mobile = new MediaQuery('(max-width: 960px)');

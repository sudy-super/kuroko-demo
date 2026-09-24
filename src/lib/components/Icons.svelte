<!-- ref/icons-sprite.svg のスプライト。ルートレイアウトで 1 回だけ描画する。
     ic-* は塗りを持たず、.i の stroke: currentColor を受け取る。
     b-* (サービスの記号) は自前の塗りを持つので stroke="none" で打ち消す。 -->
<svg xmlns="http://www.w3.org/2000/svg" style="display: none" aria-hidden="true">
	<defs>
		<symbol id="ic-chat" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-4A2.5 2.5 0 0 1 4 13.5z"/><path d="M8 8h8M8 11.5h5"/></symbol>
		<symbol id="ic-cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></symbol>
		<symbol id="ic-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/></symbol>
		<symbol id="ic-todo" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l3 3 5.5-6"/></symbol>
		<symbol id="ic-bell" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/></symbol>
		<symbol id="ic-people" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c3 0 5.5 2 5.5 5"/></symbol>
		<symbol id="ic-doc" viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 12h6M10 16h6"/></symbol>
		<symbol id="ic-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></symbol>
		<symbol id="ic-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>
		<symbol id="ic-left" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></symbol>
		<symbol id="ic-mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></symbol>
		<symbol id="ic-wave" viewBox="0 0 24 24"><path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h2"/></symbol>
		<symbol id="ic-spark" viewBox="0 0 24 24"><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></symbol>
		<symbol id="ic-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></symbol>
		<symbol id="ic-history" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/></symbol>
		<symbol id="ic-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
		<symbol id="ic-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
		<symbol id="ic-check-c" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 5-5.5"/></symbol>
		<symbol id="ic-x-c" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/></symbol>
		<symbol id="ic-send" viewBox="0 0 24 24"><path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/></symbol>
		<symbol id="ic-edit" viewBox="0 0 24 24"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13 7l3 3"/></symbol>
		<symbol id="ic-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></symbol>
		<symbol id="ic-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></symbol>
		<symbol id="ic-filter" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></symbol>
		<symbol id="ic-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
		<symbol id="ic-flag" viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4 2.5 4H5"/></symbol>
		<symbol id="ic-list" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></symbol>
		<symbol id="ic-note" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></symbol>
		<symbol id="ic-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></symbol>
		<symbol id="ic-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
		<symbol id="ic-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></symbol>
		<symbol id="ic-video" viewBox="0 0 24 24"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/></symbol>
		<symbol id="ic-car" viewBox="0 0 24 24"><path d="M4 16v-3.5L6 7h12l2 5.5V16"/><path d="M4 16h16M4 16v2.5h3V16M17 16v2.5h3V16M4.5 12.5h15"/><circle cx="8" cy="14" r=".8"/><circle cx="16" cy="14" r=".8"/></symbol>
		<symbol id="ic-phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></symbol>
		<symbol id="ic-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></symbol>
		<symbol id="ic-alert" viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></symbol>
		<symbol id="ic-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>
		<symbol id="ic-db" viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></symbol>
		<symbol id="ic-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></symbol>
		<symbol id="ic-bolt" viewBox="0 0 24 24"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></symbol>
		<symbol id="ic-robot" viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01M9 17h6"/></symbol>
		<symbol id="ic-share" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></symbol>
		<symbol id="ic-cart" viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11l2-7H6"/></symbol>
		<symbol id="ic-tag" viewBox="0 0 24 24"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/></symbol>
		<symbol id="ic-cam" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></symbol>
		<symbol id="ic-undo" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></symbol>
		<symbol id="ic-play" viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></symbol>
		<!-- デモの操作のまとまり (開始 / 他のシナリオ / リセット)を表す。実演の画面 -->
		<symbol id="ic-demo" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M12 16v4M8.5 20.5h7"/><path d="M10.5 7.5l4 2.5-4 2.5z"/></symbol>
		<symbol id="ic-transcript" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h4"/></symbol>
		<symbol id="ic-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></symbol>
		<symbol id="ic-dots" viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></symbol>
		<symbol id="ic-pin" viewBox="0 0 24 24"><path d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 0 0-13 0c0 4.9 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/></symbol>
		<symbol id="ic-clip" viewBox="0 0 24 24"><path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.6 1.6 0 0 1-2.3-2.3L15 7.5"/></symbol>
		<symbol id="ic-home" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20z"/><path d="M10 21v-6h4v6"/></symbol>
		<symbol id="ic-download" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></symbol>
		<symbol id="ic-question" viewBox="0 0 24 24"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-4z"/><path d="M10 8.6a2.2 2.2 0 1 1 2.6 2.7v1.3M12.5 15h.01"/></symbol>
		<!-- side-collapse.md — サイドナビの格納の切り替え。Apple sidebar.left に合わせ、
		     角の丸い四角の枠と左寄りの縦線 1 本だけで表す -->
		<symbol id="ic-sidebar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.5 4v16"/></symbol>
		<!-- brand marks -->
		<symbol id="b-gcal" stroke="none" viewBox="0 0 30 30"><rect x="2" y="2" width="26" height="26" rx="4" fill="#fff"/><path d="M2 6a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v2H2z" fill="#4285F4"/><path d="M2 8h6v14H2z" fill="#4285F4"/><path d="M22 8h6v14h-6z" fill="#FBBC04"/><path d="M8 22h14v6H8z" fill="#34A853"/><path d="M22 22h6v2a4 4 0 0 1-4 4h-2z" fill="#EA4335"/><path d="M2 22h6v6H6a4 4 0 0 1-4-4z" fill="#188038"/><rect x="8" y="8" width="14" height="14" fill="#fff"/><text x="15" y="19" text-anchor="middle" font-family="Inter, Arial" font-weight="700" font-size="10" fill="#4285F4">31</text></symbol>
		<symbol id="b-gmail" stroke="none" viewBox="0 0 30 30"><path d="M3 9v14a2 2 0 0 0 2 2h4V13l-6-4z" fill="#4285F4"/><path d="M27 9v14a2 2 0 0 1-2 2h-4V13l6-4z" fill="#34A853"/><path d="M9 13l6 4.5 6-4.5V8l-6 4.5L9 8z" fill="#EA4335"/><path d="M3 9a2 2 0 0 1 3.2-1.6L9 9v4L3 9z" fill="#C5221F"/><path d="M27 9a2 2 0 0 0-3.2-1.6L21 9v4l6-4z" fill="#FBBC04"/></symbol>
		<symbol id="b-slack" stroke="none" viewBox="0 0 24 24"><path d="M6 14.5a2 2 0 1 1-2-2h2zM7 14.5a2 2 0 0 1 4 0v5a2 2 0 0 1-4 0z" fill="#E01E5A"/><path d="M9.5 6a2 2 0 1 1 2-2v2zM9.5 7a2 2 0 0 1 0 4h-5a2 2 0 0 1 0-4z" fill="#36C5F0"/><path d="M18 9.5a2 2 0 1 1 2 2h-2zM17 9.5a2 2 0 0 1-4 0v-5a2 2 0 0 1 4 0z" fill="#2EB67D"/><path d="M14.5 18a2 2 0 1 1-2 2v-2zM14.5 17a2 2 0 0 1 0-4h5a2 2 0 0 1 0 4z" fill="#ECB22E"/></symbol>
		<!-- LINE の公式のブランドアイコン (https://www.line.me/ja/logo の LINE_Brand_icon_RGB.ai) の
		     形をそのまま 24 の枠に縮めたもの。形と色 (#06C755) は変えない (同ページの禁止事項:
		     変形・色の変更・装飾)。最小の大きさは PC で 20px (同ページ) -->
		<symbol id="b-line" stroke="none" viewBox="0 0 24 24"><path d="M18.59 24L5.41 24C2.42 24 0 21.58 0 18.59L0 5.41C0 2.42 2.42 0 5.41 0L18.59 0C21.58 0 24 2.42 24 5.41L24 18.59C24 21.58 21.58 24 18.59 24" fill="#06C755"/><path d="M20 10.87C20 7.29 16.41 4.38 12 4.38C7.59 4.38 4 7.29 4 10.87C4 14.08 6.84 16.77 10.69 17.28C10.95 17.33 11.3 17.45 11.39 17.67C11.47 17.87 11.45 18.19 11.42 18.39C11.42 18.39 11.32 18.96 11.3 19.08C11.27 19.28 11.14 19.87 12 19.51C12.85 19.15 16.61 16.8 18.28 14.86L18.28 14.86C19.44 13.59 20 12.3 20 10.87" fill="#fff"/><path d="M17.34 12.94L15.09 12.94C15 12.94 14.94 12.87 14.94 12.78L14.94 9.29C14.94 9.21 15 9.14 15.09 9.14L17.34 9.14C17.42 9.14 17.49 9.21 17.49 9.29L17.49 9.86C17.49 9.94 17.42 10.01 17.34 10.01L15.81 10.01L15.81 10.6L17.34 10.6C17.42 10.6 17.49 10.67 17.49 10.75L17.49 11.32C17.49 11.41 17.42 11.47 17.34 11.47L15.81 11.47L15.81 12.06L17.34 12.06C17.42 12.06 17.49 12.13 17.49 12.22L17.49 12.78C17.49 12.87 17.42 12.94 17.34 12.94" fill="#06C755"/><path d="M9.02 12.94C9.11 12.94 9.17 12.87 9.17 12.78L9.17 12.22C9.17 12.13 9.11 12.06 9.02 12.06L7.49 12.06L7.49 9.29C7.49 9.21 7.43 9.14 7.34 9.14L6.77 9.14C6.69 9.14 6.62 9.21 6.62 9.29L6.62 12.78C6.62 12.87 6.69 12.94 6.77 12.94ZM9.02 12.94" fill="#06C755"/><path d="M10.37 9.14L9.81 9.14C9.72 9.14 9.65 9.21 9.65 9.29L9.65 12.78C9.65 12.87 9.72 12.94 9.81 12.94L10.37 12.94C10.46 12.94 10.53 12.87 10.53 12.78L10.53 9.29C10.53 9.21 10.46 9.14 10.37 9.14" fill="#06C755"/><path d="M14.24 9.14L13.67 9.14C13.59 9.14 13.52 9.21 13.52 9.29L13.52 11.37L11.92 9.21C11.92 9.2 11.91 9.2 11.91 9.19C11.91 9.19 11.91 9.19 11.91 9.19C11.9 9.19 11.9 9.18 11.9 9.18L11.89 9.18C11.89 9.18 11.89 9.17 11.89 9.17L11.88 9.17C11.88 9.17 11.88 9.17 11.87 9.16C11.87 9.16 11.87 9.16 11.87 9.16C11.87 9.16 11.86 9.16 11.86 9.16C11.86 9.16 11.86 9.15 11.86 9.15C11.85 9.15 11.85 9.15 11.85 9.15C11.85 9.15 11.84 9.15 11.84 9.15C11.84 9.15 11.84 9.15 11.83 9.15C11.83 9.14 11.83 9.14 11.83 9.14C11.82 9.14 11.82 9.14 11.82 9.14C11.82 9.14 11.81 9.14 11.81 9.14C11.81 9.14 11.81 9.14 11.8 9.14C11.8 9.14 11.8 9.14 11.8 9.14C11.79 9.14 11.79 9.14 11.79 9.14L11.23 9.14C11.14 9.14 11.07 9.21 11.07 9.29L11.07 12.78C11.07 12.87 11.14 12.94 11.23 12.94L11.79 12.94C11.88 12.94 11.95 12.87 11.95 12.78L11.95 10.71L13.55 12.87C13.56 12.89 13.57 12.9 13.59 12.91C13.59 12.91 13.59 12.91 13.59 12.91C13.59 12.91 13.59 12.91 13.6 12.92C13.6 12.92 13.6 12.92 13.6 12.92C13.6 12.92 13.61 12.92 13.61 12.92C13.61 12.92 13.61 12.92 13.62 12.93C13.62 12.93 13.62 12.93 13.62 12.93C13.62 12.93 13.63 12.93 13.63 12.93C13.63 12.93 13.63 12.93 13.63 12.93C13.65 12.93 13.66 12.94 13.67 12.94L14.24 12.94C14.32 12.94 14.39 12.87 14.39 12.78L14.39 9.29C14.39 9.21 14.32 9.14 14.24 9.14" fill="#06C755"/></symbol>
	</defs>
</svg>

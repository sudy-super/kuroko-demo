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
		<symbol id="ic-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
		<symbol id="ic-mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></symbol>
		<symbol id="ic-wave" viewBox="0 0 24 24"><path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h2"/></symbol>
		<symbol id="ic-spark" viewBox="0 0 24 24"><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></symbol>
		<symbol id="ic-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></symbol>
		<symbol id="ic-history" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/></symbol>
		<symbol id="ic-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
		<symbol id="ic-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
		<symbol id="ic-check-c" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 5-5.5"/></symbol>
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
		<symbol id="ic-transcript" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h4"/></symbol>
		<symbol id="ic-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></symbol>
		<symbol id="ic-dots" viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></symbol>
		<symbol id="ic-clip" viewBox="0 0 24 24"><path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.6 1.6 0 0 1-2.3-2.3L15 7.5"/></symbol>
		<symbol id="ic-home" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20z"/><path d="M10 21v-6h4v6"/></symbol>
		<symbol id="ic-download" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></symbol>
		<symbol id="ic-question" viewBox="0 0 24 24"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-4z"/><path d="M10 8.6a2.2 2.2 0 1 1 2.6 2.7v1.3M12.5 15h.01"/></symbol>
		<!-- brand marks -->
		<symbol id="b-gcal" stroke="none" viewBox="0 0 30 30"><rect x="2" y="2" width="26" height="26" rx="4" fill="#fff"/><path d="M2 6a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v2H2z" fill="#4285F4"/><path d="M2 8h6v14H2z" fill="#4285F4"/><path d="M22 8h6v14h-6z" fill="#FBBC04"/><path d="M8 22h14v6H8z" fill="#34A853"/><path d="M22 22h6v2a4 4 0 0 1-4 4h-2z" fill="#EA4335"/><path d="M2 22h6v6H6a4 4 0 0 1-4-4z" fill="#188038"/><rect x="8" y="8" width="14" height="14" fill="#fff"/><text x="15" y="19" text-anchor="middle" font-family="Inter, Arial" font-weight="700" font-size="10" fill="#4285F4">31</text></symbol>
		<symbol id="b-gmail" stroke="none" viewBox="0 0 30 30"><path d="M3 9v14a2 2 0 0 0 2 2h4V13l-6-4z" fill="#4285F4"/><path d="M27 9v14a2 2 0 0 1-2 2h-4V13l6-4z" fill="#34A853"/><path d="M9 13l6 4.5 6-4.5V8l-6 4.5L9 8z" fill="#EA4335"/><path d="M3 9a2 2 0 0 1 3.2-1.6L9 9v4L3 9z" fill="#C5221F"/><path d="M27 9a2 2 0 0 0-3.2-1.6L21 9v4l6-4z" fill="#FBBC04"/></symbol>
		<symbol id="b-slack" stroke="none" viewBox="0 0 24 24"><path d="M6 14.5a2 2 0 1 1-2-2h2zM7 14.5a2 2 0 0 1 4 0v5a2 2 0 0 1-4 0z" fill="#E01E5A"/><path d="M9.5 6a2 2 0 1 1 2-2v2zM9.5 7a2 2 0 0 1 0 4h-5a2 2 0 0 1 0-4z" fill="#36C5F0"/><path d="M18 9.5a2 2 0 1 1 2 2h-2zM17 9.5a2 2 0 0 1-4 0v-5a2 2 0 0 1 4 0z" fill="#2EB67D"/><path d="M14.5 18a2 2 0 1 1-2 2v-2zM14.5 17a2 2 0 0 1 0-4h5a2 2 0 0 1 0 4z" fill="#ECB22E"/></symbol>
		<symbol id="b-line" stroke="none" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="#06C755"/><path d="M12 6.5c-3.6 0-6.5 2.3-6.5 5.2 0 2.6 2.3 4.7 5.4 5.1.2 0 .5.2.6.4l.1 1.3c0 .3.3.5.6.3 1.3-.7 3.5-2.3 4.7-3.6 1-1 1.6-2.2 1.6-3.5 0-2.9-2.9-5.2-6.5-5.2z" fill="#fff"/><path d="M9.2 10.3v3.2M11 10.3v3.2M13 10.3l1.8 3.2v-3.2M16 10.3v3.2h1.4" stroke="#06C755" stroke-width="1" stroke-linecap="round" fill="none"/></symbol>
	</defs>
</svg>

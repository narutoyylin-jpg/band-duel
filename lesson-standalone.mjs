// Reuse the teaching model while keeping its entry independent from the game.
export function standaloneLesson(source){
 let page=source.replace(/  <section class="phone-entry panel"[\s\S]*?<\/section>\r?\n/,'');
 page=page.replace('    <div class="title-row">','    <nav class="lesson-product-nav" aria-label="工作站入口"><a href="/lab" aria-current="page">能帶原理</a><a href="/play">Band Duel ↗</a></nav>\n    <div class="title-row">');
 page=page.replaceAll('https://heterojunction-band-lab.opeuertio.chatgpt.site/play','/play');
 page=page.replaceAll('手機若出現登入畫面，請用與電腦相同的 ChatGPT 帳號登入。','教材無需登入；遊戲帳號與對戰功能請至 Band Duel。');
 page=page.replaceAll('If your phone asks you to sign in, use the same ChatGPT account as on your computer.','The lesson needs no sign-in. Visit Band Duel for game accounts and matches.');
 page=page.replaceAll('對戰的比例來自理想模型，不代表實際元件效率。點數只是遊戲限制。手機對戰在 /play。雙人房間在同一瀏覽分頁可重新連線，房間兩小時後到期。下載的教材可自由探索，手機雙人房間需連線。','此工作站專注於能帶排列與載子分布。這些比例來自理想模型，不代表實際元件效率；下載的教材也可自由探索。');
 page=page.replaceAll('Game percentages use this ideal model, not real-device efficiency. Action points are game limits. Play at /play. Online rooms can reconnect in the same tab and expire after two hours. Downloaded lessons work offline; two-phone games require a connection.','This workstation focuses on band alignment and carrier distributions. These ideal-model shares do not represent device efficiency. The downloaded lesson also works offline.');
 page=page.replace('href="/" download="heterojunction-interactive.html"','href="/lab?download=1" download="heterojunction-interactive.html"');
 page=page.replace('initializeLanguage();document.addEventListener','addTranslations([["工作站入口","Workstations"],["能帶原理","Band principles"]]);initializeLanguage();document.addEventListener');
 page=page.replace('</head>',`<style>
 .lesson-product-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 25px;padding-bottom:15px;border-bottom:1px solid var(--line)}
 .lesson-product-nav a{padding:8px 14px;border:1px solid var(--line);border-radius:9px;font-size:14px;text-decoration:none;color:var(--muted)}
 .lesson-product-nav a[aria-current=page]{color:#c6ddff;background:#14243b;border-color:#436a9e;font-weight:650}
 .secondary,.nudge{background:#121925;color:#dce8fa;border:1px solid #3c4b61}.secondary:hover,.nudge:hover{background:#1b2b40}
 .type-caution{background:#111925!important;color:#b9c9dd;border-color:#33465e}.type-label,.current-tag{background:#1b3454!important;color:#c5dfff!important}
 @media(max-width:600px){.masthead{flex-wrap:wrap;gap:14px}.lesson-product-nav{margin-bottom:20px}}
 </style></head>`);
 return page;
}

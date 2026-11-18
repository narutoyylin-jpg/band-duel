# Band Duel

以半導體能帶為主題的策略對戰遊戲。調整導帶、價帶的位置，推測對手的任務，在最後一回合讓電子與電洞形成有利的分布。

[開始遊戲](https://band-duel.bandduel-game.workers.dev/play)

## 遊戲內容

- 支援 1v1、2v2，以及電腦練習。正式對戰採 Shuffle 隨機任務；固定 Type I／Type II 組合可在練習中選擇。
- 經典模式以能帶操作決勝；技能模式會抽出三個技能供玩家擇一使用，僅開放於非牌位對局。
- 5 回合每人 12 點，12 回合每人 30 點。每回合提交一條能帶的動作，最後公布雙方任務與勝負；2v2 另從勝隊選出貢獻最高的 MVP。
- 2v2 中，每隊各有一位導帶與價帶玩家。鎖定前可看見同角色對手的即時調整，隊友的動作保持隱藏，回合結束後依序展示。
- 隨機配對與牌位配對分開；1v1、2v2 共用積分榜。2v2 湊到兩位真人後再等 15 秒，不足四人便由電腦補位；牌位場有電腦補位仍照常計分，單人練習不計分。
- 自訂房號可在關房後重用。對局結束可留在原房間再戰，房主可調整回合數、經典／技能與倒數設定；房主離開時自動移交，2v2 空位由電腦補上。
- 包含 Google 登入、照片頭像、國旗與個人資料、好友與聊天、造型／背景／音樂商店、成就及月結遊戲內獎勵。手機可加入主畫面作為 PWA 使用。

## 本機開發

建議使用 **Node.js 24 或更新版本**；部分檢查使用內建的 `node:sqlite`。安裝依賴後，依照 [獨立部署說明](standalone/README.md) 設定本機 Google 登入環境，再啟動：

```powershell
npm ci
node sync-phone.mjs
npm run build
npx wrangler d1 execute band-duel --local --config dist/server/wrangler.json --file standalone/schema.sql
npm run dev
```

開啟 `http://localhost:5173/play`。上面的 SQL 初始化適用於全新的本機資料庫；既有資料庫請先閱讀升級說明。

修改 `phone-layout.html`、`phone-*.js` 或 `phone-*.css` 後，先執行 `node sync-phone.mjs`，將來源整合到實際提供給瀏覽器的 `phone.html`，再建置或檢查。

## 核心檢查

在專案根目錄執行；以下檢查使用本機模擬資料，不會連到正式玩家資料庫：

```powershell
node phone-check.mjs
node terminal-check.mjs
node google-auth-check.mjs
node team-shuffle-check.mjs
node team-bot-fill-check.mjs
node room-departure-check.mjs
node team-room-departure-check.mjs
node rematch-settings-check.mjs
node pwa-check.mjs
```

其餘 `*-check.mjs` 涵蓋技能、經濟、賽季、聊天與介面等功能；瀏覽器檢查可能另需 Playwright 與可用的瀏覽器環境。

## 原始碼位置

| 位置 | 用途 |
| --- | --- |
| `phone-layout.html`、`phone-*.js`、`phone-*.css` | 遊戲介面、動畫、教學及互動來源 |
| `duel-core.mjs`、`team-core.mjs`、`team-cpu.mjs` | 1v1／2v2 規則與電腦決策 |
| `rooms-service.mjs`、`team-service.mjs`、`room-lifecycle.mjs` | 房間、同步、離開與再戰流程 |
| `ranking.mjs`、`economy.mjs`、`seasons.mjs`、`social.mjs`、`chat.mjs` | 積分、商店、月結與社交功能 |
| `app/`、`google-auth.mjs` | 網頁與 API 路由、Google 登入驗證 |
| `db/`、`drizzle/`、`standalone/` | 資料結構、遷移及獨立部署說明 |
| `public/`、`build/`、`scripts/` | 靜態素材、PWA、建置與部署工具 |

## 部署與授權

網站部署於自己的 Cloudflare Workers，資料存於 D1；Google 負責登入驗證。完整操作見 [獨立部署說明](standalone/README.md)。憑證、本機資料庫、日誌與建置產物不應提交到版本庫。

第三方素材與工具的授權聲明保留於 `public/flags/LICENSE.txt`、`build/sites-vite-plugin.LICENSE` 及 `vendor/shadcn-tailwind-4.13.0.LICENSE.md`；使用相關內容時請一併保留。

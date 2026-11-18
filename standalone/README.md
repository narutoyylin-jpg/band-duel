# Band Duel 獨立部署

使用自己的 Cloudflare Workers 與 D1 部署遊戲，玩家透過 Google 登入。玩家資料、積分、物品與對戰紀錄存放於 D1，不需要 ChatGPT 帳號。

## 準備帳號與登入設定

1. 在 [Cloudflare 控制台](https://dash.cloudflare.com/) 建立名為 `band-duel` 的 D1 資料庫，記下資料庫 ID。
2. 在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 建立專案、設定 OAuth 同意畫面，並建立「網頁應用程式」OAuth 用戶端。
3. Google 的「已授權的 JavaScript 來源」加入 `http://localhost:5173` 與正式網站的來源網址，例如 `https://your-worker.workers.dev`，不含 `/play`。
4. 「已授權的重新導向 URI」加入 `http://localhost:5173/api/auth/google` 與 `https://your-worker.workers.dev/api/auth/google`。發布後請以實際網址取代範例。
5. Google 專案若仍為測試狀態，先將允許登入的帳號加入測試使用者；對外開放前完成相應的發布設定。

登入採 Google Identity Services，伺服器驗證回傳的 ID token。只需要 **OAuth 用戶端 ID**，不需要 Google 用戶端密鑰，也不要把密鑰放入原始碼。

## 本機環境

建議 Node.js 24 或更新版本。在專案根目錄執行 `npm ci`，並建立不提交到 Git 的 `.dev.vars`：

```dotenv
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
BAND_DUEL_SESSION_SECRET=REPLACE_WITH_A_LOCAL_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
```

以上皆為占位文字；請填入自己的用戶端 ID 與僅用於本機的隨機工作階段密鑰。接著初始化全新的本機資料庫：

```powershell
node sync-phone.mjs
npm run build
npx wrangler d1 execute band-duel --local --config dist/server/wrangler.json --file standalone/schema.sql
npm run dev
```

開啟 `http://localhost:5173/play`。`.dev.vars`、`.env*`、`.wrangler/` 中的資料與憑證均應保持在版本控制之外。

## 首次發布

以下範例使用 PowerShell。先登入自己的 Cloudflare 帳號，將占位文字換成自己的設定，再建立部署設定：

```powershell
npx wrangler login
$env:CLOUDFLARE_D1_DATABASE_ID = '<你的 D1 資料庫 ID>'
$env:GOOGLE_CLIENT_ID = '<你的 Google 網頁 OAuth 用戶端 ID>'
node sync-phone.mjs
npm run build
node scripts/prepare-standalone.mjs
```

這會產生 `dist/server/wrangler.standalone.json`，綁定 `DB`，啟用 Google 登入與月結排程。建置產物不應提交到 Git。

**僅在全新、尚未初始化的正式資料庫**執行完整 schema：

```powershell
npx wrangler d1 execute band-duel --remote --config dist/server/wrangler.standalone.json --file standalone/schema.sql
```

為正式網站設定至少 32 字元的隨機工作階段密鑰。下列命令會互動式要求輸入，請使用與本機不同的值：

```powershell
npx wrangler secret put BAND_DUEL_SESSION_SECRET --config dist/server/wrangler.standalone.json
npx wrangler deploy --config dist/server/wrangler.standalone.json
```

工作階段密鑰只存入 Cloudflare Secret，不放在原始碼、設定檔或聊天訊息中。發布後確認 Google OAuth 的來源與重新導向 URI 已包含 Cloudflare 顯示的實際網站網址，再測試登入與建立房間。

往後保留上述環境變數，建置後可用 `npm run deploy:standalone` 更新程式。修改遊戲介面來源後仍需先執行 `node sync-phone.mjs`。

## 既有資料庫升級

先備份並確認目前資料結構，再套用缺少的增量升級。`schema.sql` 是全新安裝用的完整資料結構，不能用來取代既有玩家資料；不要清空資料庫，也不要修改已套用的遷移紀錄。

此目錄提供 `profile-extras.sql`、`avatar-backgrounds.sql`、`achievements.sql`、`ranked-queue.sql` 及 `upgrade-*.sql`，對應歷次功能。它們不是每次部署都要重跑的命令清單；請閱讀各檔內容，依現有版本選擇尚未套用的項目。`drizzle/` 另保留資料結構的遷移歷程。

選定需要的升級檔後，使用下列形式執行，再發布相容的新程式：

```powershell
npx wrangler d1 execute band-duel --remote --config dist/server/wrangler.standalone.json --file standalone/<需要的升級檔>.sql
```

## 手機安裝與基本驗證

主頁的安裝入口會依裝置與瀏覽器提供安裝視窗或操作步驟；iPhone Safari 使用「分享 → 加入主畫面」。安裝後以獨立視窗開啟 `/play`，對戰與登入仍需要網路。

部署前可執行根目錄 README 列出的核心檢查。發布後再確認 Google 登入、1v1／2v2 建房、加入與離開、原房再戰，以及手機安裝入口。月結獎勵為遊戲內金幣與賽季代幣。

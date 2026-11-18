# Semiconductor Heterojunctions

A bilingual, animated introduction to semiconductor heterojunctions, band offsets, and Type I / Type II applications.

[開啟最新介紹網站](https://semiconductor-heterojunctions.bandduel-game.workers.dev/)

這是目前上線版本的獨立教材原始碼。十一幕講解涵蓋導帶、價帶、費米能階、電子與電洞的分布、Type I／Type II，以及 LED、雷射、光纖通訊、熱影像、氣體感測與地球觀測的應用。頁面提供中英文、連續能帶動畫與可操作的位差實驗。

## 建置與預覽

使用 Node.js 24 或更新版本，在此資料夾執行：

```powershell
node build.mjs
npx --yes http-server dist -p 8080 -c-1
```

開啟 `http://localhost:8080`。建置產生的 `dist/index.html` 已包含所有樣式、動畫程式與裝置圖示，亦可直接用瀏覽器開啟；教材本身不需要外部套件或資料庫。

## 發布至自己的 Cloudflare

```powershell
node build.mjs
npx wrangler login
npx wrangler deploy --config wrangler.json
```

使用自己的 Cloudflare 帳號授權。設定檔不包含帳號識別碼或登入憑證；發布後以工具回傳的網址為準。`dist/`、`.wrangler/` 及本機環境檔不提交到 Git。

## 原始碼

- `story.html`：畫面結構。
- `story.css`：桌面與手機版面、動畫樣式。
- `story-data.js`：中英文講解、章節設定與科學參考來源。
- `story.js`：章節切換、連續能帶動畫與實驗操作。
- `application-art.js`：應用裝置的 SVG 圖示。
- `build.mjs`：產生自含的靜態網頁。

語言與實驗偏好只保存在使用者的瀏覽器。章節選單提供前往 Band Duel 的連結，教材與遊戲分開部署。

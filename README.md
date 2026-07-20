# 附近設施 Finder (Nearby Facilities Finder)

搵香港附近嘅政府設施，包括公共設施、充電站、公厕等。

## 功能

- 📍 GPS 定位：一撳就攞到你嘅位置
- 🔍 手動輸入：可以手動輸入緯度同經度
- 🏛️ 附近設施：顯示 1 公里內嘅政府設施
- 📏 距離計算：自動計算同每個設施嘅距離
- 🗺️ 地圖連結：可以直接喺 Google Maps 度睇

## 技術架構

```
[ 用戶手機/瀏覽器 ]
        │  (GPS 或手動輸入 lat/lng)
        ▼
[ GitHub Pages ]  ← static index.html  (HOST 1)
        │  fetch (CORS-safe)
        ▼
[ Cloudflare Worker ]  ← proxy  (HOST 2)
        │  server-to-server (冇 CORS 問題)
        ├──► geodetic.gov.hk  /transform   (WGS84 → HK80)
        └──► geodata.gov.hk   /searchNearby (附近設施)
```

## 部署步驟

### 1. 註冊 Cloudflare
1. 去 https://dash.cloudflare.com/sign-up 註冊
2. 選擇免費 plan
3. 整 API token：My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"

### 2. Deploy Worker
```bash
cd worker
export CLOUDFLARE_API_TOKEN="你的token"
wrangler login
wrangler deploy
# 記低 output URL，例如 https://nearby-finder-proxy.xxx.workers.dev
```

### 3. 更新 Frontend Config
1. 打開 `web/index.html`
2. 將 `PROXY_BASE` 改成你嘅 Worker URL
3. Commit 同 push

### 4. Deploy to GitHub Pages
```bash
cd ..
gh repo create nearby-finder --public --source=. --push
gh api -X POST repos/:owner/nearby-finder/pages -f "source[branch]=main" -f "source[path]=/"
```

### 5. 更新 Worker CORS
1. 打開 `worker/worker.js`
2. 將 `ALLOWED_ORIGINS` 改成你嘅 GitHub Pages URL
3. 重新 deploy：`wrangler deploy`

## 本地測試

```bash
cd web
npx http-server -p 8080
# 用 SSH tunnel 測試：ssh -L 8080:localhost:8080 user@vm
# 測試完要 kill process！
```

## API Endpoints

### 座標轉換
```
GET /transform?inSys=wgsgeog&outSys=hkgrid&lat=22.2818&long=114.1588
```

### 搜尋附近設施
```
GET /nearby?lat=22.28&long=114.15&r=1000
```

## 注意事項

- ⚠️ GPS 需要 HTTPS 先可以用（GitHub Pages 自動提供）
- ⚠️ 唔好將 API token 入 git
- ⚠️ 本地測試完要 kill server，VM 唔可以 hosting

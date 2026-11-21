# dsh-ego-google-search（ego-browser Google 搜尋）

[English](README.md)

讓 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness)
的 `web_search` 改用你本機的 [ego-browser（ego lite）](https://github.com/citrolabs/ego-lite)
開 Google 搜尋。每次搜尋：

1. 開一個全新的 ego-browser 任務空間（Task Space），
2. 載入 `https://www.google.com/search?q=…`，
3. 擷取自然搜尋結果（標題、網址、摘要、發布日期），
4. **關閉任務空間與分頁**，返回結果。

安裝後會註冊 `ego-google` 搜尋服務並設為預設（`web.searchProvider`），取代官方
DeepSeek 搜尋。官方服務仍保留，隨時可在 **Settings → Web search** 切回。

免 API key、免建置、零依賴——搜尋全程在你自己的瀏覽器裡本機執行。

## 安裝

需要：DeepSeek Harness（有 Plugin Manager／**Plugins** 頁面）、本機已安裝
ego-browser（ego lite）、已安裝 Git 且能連上 github.com。

**方法 A — 直接從 GitHub 安裝（推薦）：** 在 DSH 開
**Plugins → Add plugin**，貼上：

```
github:liedwardtw/search-api
```

或直接叫你的 agent：「安裝插件 bundle `github:liedwardtw/search-api`」。
完整網址 `https://github.com/liedwardtw/search-api` 也可以。

安裝時不會執行任何腳本：本 bundle 是純 JavaScript、零依賴、無安裝／建置腳本，
不需要任何建置授權。想鎖定安裝內容，可加上 commit SHA：
`github:liedwardtw/search-api#<commit-sha>`。

**方法 B — clone 後以本機目錄安裝：**

```sh
git clone https://github.com/liedwardtw/search-api.git
```

然後 **Plugins → Add plugin → 本機目錄**，選 clone 下來的資料夾（絕對路徑）。
本機目錄安裝採連結方式，之後 `git pull` 即可更新（重啟 DSH 載入新程式碼）。

**方法 C — npm：**

```
dsh-ego-google-search
```

套件發佈到 npm 後即可用（見英文 README 的「Publishing to npm」）。

安裝完成立即生效（`application: applied`），下一次 `web_search` 就走 Google。
到 **Settings → Web search** 確認顯示 **Google (ego-browser)**。

## 需求與限制

- ego-browser 執行檔尋找順序：設定的 `egoPath` → `$EGO_BROWSER_PATH` →
  `~/.local/share/ego/active_version_dir/ego-browser.exe` → `PATH`。
- Google 若彈出驗證碼／異常流量頁，搜尋會回報 `GOOGLE_BLOCKED`：
  請開 ego-browser 手動通過驗證後重試。
- 只返回自然搜尋連結，沒有官方服務的 AI 摘要回答。
- 每次查詢開一個瀏覽器任務，比 API 搜尋慢；摘要擷取依賴 Google 目前的
  SERP 結構（`.VwiC3b`／`[data-sncf]`），改版時可能退化為只剩標題＋網址。

## 設定（預設值即可用）

要調整時，編輯 profile 的 `cordis.patch.yml`
（`~/.dsh/profiles/<profile>/cordis.patch.yml`）中 `web-search-ego-google`
行後重啟 DSH：

```yaml
- id: web-search-ego-google
  name: 'dsh-ego-google-search'
  config:
    hl: zh-TW         # Google 介面語言
    concurrency: 2    # 同時進行的瀏覽器搜尋數
```

| 鍵 | 預設 | 說明 |
| --- | --- | --- |
| `egoPath` | 自動偵測 | ego-browser 執行檔絕對路徑 |
| `concurrency` | `2` | 瀏覽器搜尋並行上限（多查詢工具呼叫會排隊） |
| `timeoutMs` | `45000` | 單次搜尋預算，低於工具層 60 秒上限 |
| `hl` | `zh-TW` | Google 介面語言 |
| `googleDomain` | `www.google.com` | 要查詢的 Google 網域 |

## 切回官方搜尋

- **暫時：** Settings → Web search → 選 DeepSeek 官方服務。
- **永久：** 在 **Plugins** 移除此 bundle（`web` 行覆蓋隨之消失），或在
  profile 的 `cordis.patch.yml` 覆蓋 `web` 行：`searchProvider: deepseek-search-api`。

## 測試

已安裝 ego-browser 時：

```sh
node test/test-provider.mjs
```

以 mock context 註冊 provider 並跑一次真實 Google 搜尋。

## 授權

[MIT](LICENSE)
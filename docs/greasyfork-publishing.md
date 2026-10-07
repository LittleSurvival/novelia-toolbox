# GitHub Actions → Greasy Fork 自動發布設定

專案提供 CI 與 tag 發布 workflow。CI 檢查格式、測試與建置；Release 在推送版本 tag 後發布成品。Greasy Fork 仍需依下列步驟完成首次同步與 webhook 設定。

## 1. 先準備 GitHub

倉庫為 [LittleSurvival/novelia-toolbox](https://github.com/LittleSurvival/novelia-toolbox)。Workflow 已放在 `.github/workflows/`；`dist` 不需要放在 main，首次推送版本 tag 後會建立獨立的 `release-dist` 成品分支。

目前基準為 `0.7.0`。第一次發布修正版建議使用 **0.7.1**：修改 `package.json` 的 version，執行 `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`、`npm run format`，再提交 version 與 lockfile。保持腳本 name、namespace 及 Greasy Fork ID **527754**。

這些操作完成後再推版本 tag：

```powershell
git push origin main
git tag v0.7.1
git push origin v0.7.1
```

到 GitHub Actions 等待 Release workflow 成功，確認 `release-dist` 分支根目錄有 `.user.js` 與 `.meta.js`，並確認下節 Raw 網址可以開啟程式碼。此時才設定 Greasy Fork，避免第一次同步讀到 404。

## 2. 已提供的 Actions

- [CI workflow](../.github/workflows/ci.yml)：推送 main、開 PR 或手動執行時，使用 Node.js 22 執行 npm ci、格式檢查、測試與建置。
- [Release workflow](../.github/workflows/release.yml)：推送 vX.Y.Z tag 時，檢查與 package.json 版號一致且提交已合併至 main，再測試、建置並發布。

Release 使用 GitHub 自帶的 GITHUB_TOKEN，不需要額外 Token 或 Greasy Fork Secret。僅 Release 具有 contents write 權限；CI 為唯讀。

成品包含 novelia-toolbox.user.js、novelia-toolbox.meta.js 與 SHA256SUMS。先完成 GitHub Release 附件，再推送 release-dist 供 Greasy Fork 同步。流程拒絕降低已發布版號、修改已發布的同版本內容；可重跑中斷的 workflow，已公開附件會核對而不覆寫。

目前尚未推送正式版本 tag，Release 的實際發布結果須於首次發布時確認。

## 3. 你截圖的 Greasy Fork 畫面

進入原本 **NTR ToolBox／527754** 的設定頁：

| 區段／欄位 | 填寫內容 |
| --- | --- |
| 推薦的腳本網址 | 留空；這是推薦別人的腳本 |
| **同步原始碼 → 網址** | 下方完整 Raw 網址 |
| 此腳本將會被同步 | 選「**自動－定時檢查更新**」，作為 webhook 以外的定時備援 |
| 其他資訊 → 網址 | 留空；保留現有介紹 |
| HTML／Markdown | 不同步其他資訊時不影響；可維持 Markdown |

同步原始碼網址：

```text
https://raw.githubusercontent.com/LittleSurvival/novelia-toolbox/release-dist/novelia-toolbox.user.js
```

填入後按「**更新設定並同步腳本**」。確認 Greasy Fork 顯示新版本，程式碼頁是可讀的新 bundle，原本腳本 ID 沒有改變。Raw URL 必須先存在；若 404，不要改填 TypeScript 原始檔或 meta-only 檔案。

## 4. 設定立即同步的 webhook

在 Greasy Fork 的同步說明點「設定 webhook」，取得該帳號產生的 Payload URL 與 Secret；沒有 Secret 時按 Generate。這兩個值屬於你的帳號，本文件不猜測或代填。

到 GitHub **novelia-toolbox → Settings → Webhooks → Add webhook**：

| GitHub 欄位 | 填寫內容 |
| --- | --- |
| Payload URL | 原樣貼上 Greasy Fork 顯示的 Payload URL |
| Content type | `application/json` |
| Secret | 原樣貼上 Greasy Fork 產生的 Secret |
| SSL verification | 保持啟用 |
| Which events | **Just the push event** |
| Active | 勾選 |

GitHub 會送 ping。之後 `release-dist` 的已存在成品檔修改時，push webhook 會通知 Greasy Fork 更新；main 的日常提交不改變同步來源。首次建立分支與新增成品檔時仍按前節做一次手動同步。

## 5. 之後每一版

1. 修改程式與 version，例如 `0.7.1` → `0.7.2`，同步 lockfile、格式化並提交到 main。
2. 推送 main，再推同版號的 tag `v0.7.2`。
3. 確認 Actions 成功、GitHub 附件與 `release-dist` metadata 都是 `0.7.2`。
4. 確認 GitHub webhook 最近一次 delivery 成功、Greasy Fork 顯示新版本。
5. 使用者的 Tampermonkey 按自己的更新設定取得新版本；可以從管理頁手動檢查更新。

只發布比線上新版本更高的 tag，不重寫公開 tag。版本號不增加時，自動更新不會把同版本內容視為新版本。如果 Actions 中途失敗，可重跑對應 run；若 webhook 失敗，先看 delivery 回應，再於 Greasy Fork 手動同步。不需要另貼 Secret 到 repo、Actions 日誌或聊天。

官方參考：[Greasy Fork webhook 設定](https://github.com/greasyfork-org/greasyfork/blob/master/app/views/users/webhook_info.html.erb)、[GitHub CLI Release](https://cli.github.com/manual/gh_release_create)、[GitHub 重跑 workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)。

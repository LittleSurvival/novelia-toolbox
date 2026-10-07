# Changelog

## 0.7.1

- 將單一 userscript 改為 TypeScript 分檔，明確分開功能、服務、介面、型別、UI 與輔助函數。
- 修正目前 Novelia 的登入資料、GPT／Sakura 工作區、小說搜尋、收藏分頁、排隊與重試相容性。
- 修正設定輸入即時生效、面板位置恢復、快捷鍵與任務去重。
- 使用 Vite + vite-plugin-monkey 打包可讀的單檔 userscript，保留原本的 Greasy Fork ID 與更新渠道。
- 新增 CI 與 tag 發布流程，發布成品存於 `dist` 分支。

驗證：23 個自動化測試通過，型別檢查與建置通過；已登入網站的隔離驗證涵蓋七個模組，未執行真實模型翻譯。

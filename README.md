# NTR ToolBox Userscript

**Version:** v1.0.0

**Author:** TheNano (百合仙人)

---

## Overview

NTR ToolBox is a Tampermonkey userscript designed to enhance the Novel Translate Bot website by providing a collection of modules that help manage translation tools and optimize performance. The script adapts its user interface for both desktop and mobile devices.

---

## Installation

You can easily install the script from its Greasy Fork page:

[https://greasyfork.org/scripts/527754-ntr-toolbox](https://greasyfork.org/scripts/527754-ntr-toolbox)

Once installed, the script will automatically run on the supported websites (n.novelia.cc, books.fishhawk.top and books1.fishhawk.top).

---

## User Interface

- **內嵌工具列：** 小說／文庫列表、詳情與收藏頁提供 Sakura／GPT 排隊；工作區提供新增、刪除、啟動翻譯器與自動重試。沒有適用功能的頁面不顯示工具列。
- **設定與選項：** 點擊「設定」以 220ms 動畫展開／收起。翻譯器、翻譯模式與任務分段採用分段按鈕，選中底塊以 240ms 滑動；設定自動儲存，Sakura／GPT 各自保留設定。模式／分段也支援方向鍵、Home 和 End。
- **網站整合：** 跟隨深淺主題，適應窄螢幕，並在 SPA 局部重繪後重新掛載。原生版面的掛載規則集中在 `SiteAdapter.toolboxMountPoint()`，工具列透過 Shadow DOM 隔離樣式。

---

## Modules

### 添加Sakura翻譯器 (Add Sakura Translator)

- **Purpose:** Adds multiple Sakura translator instances.
- **Key Settings:** Quantity, delay, translator name prefix, translator link, and key binding.
- **Behavior:** Automatically fills and submits the translation form for each instance.

### 添加GPT翻譯器 (Add GPT Translator)

- **Purpose:** Adds GPT translator instances.
- **Key Settings:** Quantity, delay, translator name prefix, model name, API link, API key, and key binding.
- **Behavior:** Automates the process of adding and configuring GPT translators.

### 刪除翻譯器 (Delete Translator)

- **Purpose:** Removes translator instances that do not match specified exclusion criteria.
- **Key Settings:** Exclusion keywords (translators containing these keywords are preserved) and key binding.
- **Behavior:** Scans for translator items on the page and clicks the delete button for those that do not meet the criteria.

### 啟動翻譯器 (Launch Translator)

- **Purpose:** Starts the translator tools.
- **Key Settings:** Delay interval between simulated clicks and key binding.
- **Behavior:** Iterates over translator buttons (labeled “启动” or “啟動”) and simulates clicks with a configurable delay.

### 排隊Sakura (Queue Sakura)

- **Purpose:** Queues tasks for Sakura translators from web novels, Wenku novels, lists and favorites.
- **Key Settings:** Translation mode (常規, 過期, 重翻), book count, task splitting, task limits and key binding. Available settings depend on the page.
- **Behavior:** Adds tasks to the Sakura workspace using the selected settings and skips tasks already queued.

### 排隊GPT (Queue GPT)

- **Purpose:** Queues tasks for GPT translators on the same supported pages as Sakura.
- **Key Settings:** The same queue options as Sakura, with settings saved separately for each translator type.
- **Behavior:** Adds tasks to the GPT workspace and skips tasks already queued.

### 自動重試 (Auto Retry)

- **Purpose:** Automatically retries unfinished translation tasks.
- **Key Settings:** Maximum retry count.
- **Behavior:** Periodically checks for tasks marked as “未完成” and clicks the retry button until the maximum attempts are reached.

## How to Use

1. **Choose a function:** Select Sakura or GPT in the embedded queue toolbar, or select a module in the translator workspace toolbar.
2. **Configure settings:** Click 「設定」 to expand the settings. Changes are saved automatically; click again to collapse them.
3. **Run the action:** Click 「加入佇列」 on novel pages, or the selected module’s action button in the workspace. Auto Retry can be enabled and stopped from the same toolbar.
4. **Novel details:** The web novel toolbar appears below the native workspace controls/logs and above comments.

---

## 開發

需要 Node.js 22.12 以上；使用 TypeScript、Vite + vite-plugin-monkey，將 `src/` 打包成單一 userscript。

```bash
npm ci                 # 安裝依賴
npm run dev            # 開發模式；安裝開發腳本後，用瀏覽器 F12 除錯
npm run typecheck      # TypeScript 型別檢查
npm test               # 執行測試（tests/）
npm run build          # 輸出 dist/novelia-toolbox.user.js 與 .meta.js
npm run preview        # 預覽建置成品的安裝入口
npm run format         # 格式化程式碼
npm run format:check   # 檢查程式碼格式
```

入口是 `src/main.ts`；`modules/` 放功能、`services/` 放資料與網站操作、`ui/` 放介面、`interfaces/` 和 `types/` 放型別、`util/` 放輔助函數。

推送 `main` 或 PR 會執行 CI；推送與 `package.json` 相同版號的 `vX.Y.Z` tag（例如 `v0.7.1`）會建立 GitHub Release 並更新 `dist`。Greasy Fork 首次同步與 webhook 設定請看 [發布說明](docs/greasyfork-publishing.md)。

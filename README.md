# NTR ToolBox Userscript

**Version:** v0.3.1-20250223  
**Author:** TheNano (百合仙人)

---

## Overview

NTR ToolBox is a Tampermonkey userscript designed to enhance the Novel Translate Bot website by providing a collection of modules that help manage translation tools and optimize performance. The script adapts its user interface for both desktop and mobile devices.

---

## Installation

You can easily install the script from its Greasy Fork page:

[https://greasyfork.org/scripts/527754-ntr-toolbox](https://greasyfork.org/scripts/527754-ntr-toolbox)

Once installed, the script will automatically run on the supported websites (books.fishhawk.top and books1.fishhawk.top).

---

## User Interface

- **Draggable Panel:**  
  The toolbox panel is movable, allowing you to position it anywhere on the screen.

- **Adaptive Interactions:**  
  - **Desktop:**  
    • **Left-click** on a module header to execute the module.  
    • **Right-click** on a module header to open or close its settings.
  - **Mobile:**  
    • **Single tap** to run a module.  
    • **Double tap** to toggle its settings.

- **Info Bar:**  
  At the bottom of the panel, the info bar displays the interaction instructions on the left (e.g., “左鍵執行/切換 | 右鍵設定” on desktop or “單擊執行 | 雙擊設定” on mobile) and credits the author on the right.

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
- **Purpose:** Queues tasks for Sakura translators (mainly on the Wenku page).
- **Key Settings:** Mode selection (常規, 過期, 重翻), delay intervals, number of parallel tasks, and key binding.
- **Behavior:** Opens new tabs for each task, configures the correct mode, and queues the translation tasks automatically.

### 排隊GPT (Queue GPT)
- **Purpose:** Queues tasks for GPT translators in the Wenku section.
- **Key Settings:** Mode selection (常規, 過期, 重翻), delay intervals, number of parallel tasks, and key binding.
- **Behavior:** Similar to the Sakura queue, it automates task queuing by managing new tabs and triggering appropriate actions.

### 自動重試 (Auto Retry)
- **Purpose:** Automatically retries unfinished translation tasks.
- **Key Settings:** Maximum retry count.
- **Behavior:** Periodically checks for tasks marked as “未完成” and clicks the retry button until the maximum attempts are reached.

### 緩存優化 (Cache Optimization)
- **Purpose:** Optimizes the browser’s caching by synchronizing sessionStorage with localStorage.
- **Key Settings:** Synchronization interval.
- **Behavior:** Uses a proxy to mirror changes between sessionStorage and localStorage, ensuring consistency across the page.

---

## How to Use

1. **Configure Modules:**  
   Open a module’s settings (via right-click on desktop or double tap on mobile) to adjust parameters like delays, names, and links.

2. **Execute Modules:**  
   - **Desktop:** Click a module header with the left mouse button to run it.  
   - **Mobile:** Tap once on a module header to execute the module.

3. **Persistent Settings:**  
   Your configuration settings are saved locally and will persist between sessions.

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

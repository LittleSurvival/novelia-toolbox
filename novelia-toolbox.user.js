// ==UserScript==
// @name         NTR ToolBox
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @author       TheNano
// @description  ToolBox for Novel Translate bot website
// @license      MIT
// @icon         https://github.com/LittleSurvival/NTR-ToolBox/blob/main/icon.jpg?raw=true
// @downloadURL  https://update.greasyfork.org/scripts/527754/NTR%20ToolBox.user.js
// @updateURL    https://update.greasyfork.org/scripts/527754/NTR%20ToolBox.meta.js
// @match        https://books.fishhawk.top/*
// @match        https://books1.fishhawk.top/*
// @match        https://n.novelia.cc/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

/*
MIT License

Copyright (c) 2026 TheNano

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/


(function() {
	"use strict";
	var s = new Set();
	var _css = async (t) => {
		if (s.has(t)) return;
		s.add(t);
		((css) => {
			const style = document.createElement("style");
			style.textContent = css;
			document.head.append(style);
		})(t);
	};
	var ModuleRegistry = class {
		modules;
		constructor(modules) {
			this.modules = modules;
			if (new Set(modules.map((module) => module.id)).size !== modules.length) throw new Error("功能 ID 不可重複");
		}
		get(id) {
			const module = this.modules.find((item) => item.id === id);
			if (!module) throw new Error(`找不到功能：${id}`);
			return module;
		}
		dispose() {
			this.modules.forEach((module) => module.dispose());
		}
	};
	function isRecord(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}
	function parseRecord(raw) {
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw);
			return isRecord(parsed) ? parsed : null;
		} catch {
			return null;
		}
	}
	function finiteCount(value) {
		const count = Number(value);
		if (!Number.isSafeInteger(count) || count < 0) throw new Error("章節數量格式不正確");
		return count;
	}
	var SettingsService = class {
		storage;
		configKey = "NTR_ToolBox_Config";
		keepKey = "NTR_KeepState";
		positionKey = "ntr-panel-position";
		constructor(storage) {
			this.storage = storage;
		}
		load(modules) {
			const raw = this.storage.getItem(this.configKey);
			const stored = parseRecord(raw);
			if (!stored || !Array.isArray(stored.modules)) return;
			if (raw && !this.storage.getItem(`${this.configKey}_Backup`)) this.storage.setItem(`${this.configKey}_Backup`, raw);
			for (const module of modules) {
				const saved = stored.modules.find((item) => isRecord(item) && item.name === module.name);
				if (!isRecord(saved) || !Array.isArray(saved.settings)) continue;
				for (const definition of module.settings) {
					const previous = saved.settings.find((item) => isRecord(item) && item.name === definition.name);
					if (!isRecord(previous) || typeof previous.value !== typeof definition.value) continue;
					const value = previous.value;
					if (typeof value === "number" && (!Number.isSafeInteger(value) || value < (definition.min ?? 0))) continue;
					if (definition.type === "select" && (typeof value !== "string" || !definition.options?.includes(value))) continue;
					if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") definition.value = value;
				}
			}
		}
		save(modules) {
			const data = {
				version: 20,
				modules: modules.map((module) => ({
					name: module.name,
					settings: module.settings.map((setting) => ({
						name: setting.name,
						type: setting.type,
						value: setting.value,
						...setting.options ? { options: [...setting.options] } : {}
					}))
				}))
			};
			this.storage.setItem(this.configKey, JSON.stringify(data));
		}
		enabledNames() {
			const stored = parseRecord(this.storage.getItem(this.keepKey));
			return new Set(Object.entries(stored ?? {}).filter(([, value]) => value === true).map(([name]) => name));
		}
		saveEnabled(names) {
			this.storage.setItem(this.keepKey, JSON.stringify(Object.fromEntries([...names].map((name) => [name, true]))));
		}
		getPosition() {
			const stored = parseRecord(this.storage.getItem(this.positionKey));
			return stored && typeof stored.left === "string" && typeof stored.top === "string" ? {
				left: stored.left,
				top: stored.top
			} : null;
		}
		savePosition(position) {
			this.storage.setItem(this.positionKey, JSON.stringify(position));
		}
	};
	function delay(ms, signal) {
		signal.throwIfAborted();
		return new Promise((resolve, reject) => {
			const onAbort = () => {
				clearTimeout(timer);
				reject(signal.reason);
			};
			const timer = setTimeout(() => {
				signal.removeEventListener("abort", onAbort);
				resolve();
			}, ms);
			signal.addEventListener("abort", onAbort, { once: true });
		});
	}
	function errorMessage(error) {
		return (error instanceof Error ? error.message : "操作失敗").replace(/Bearer\s+[^\s]+/gi, "Bearer [hidden]").replace(/sk-[\w-]+/g, "[hidden]");
	}
	var NotificationView = class {
		container = document.createElement("div");
		timers = new Set();
		constructor() {
			this.container.className = "ntr-notification-container";
		}
		show(result) {
			if (!result.message) return;
			if (!this.container.isConnected) document.body.append(this.container);
			const box = document.createElement("div");
			box.className = `ntr-notification-message ${result.status}`;
			box.setAttribute("role", result.status === "failed" ? "alert" : "status");
			box.textContent = `${{
				success: "✅",
				partial: "⚠️",
				failed: "❌",
				cancelled: "⏹️"
			}[result.status]} ${result.message}`;
			this.container.append(box);
			const timer = setTimeout(() => {
				box.remove();
				this.timers.delete(timer);
			}, result.status === "failed" ? 8e3 : 5e3);
			this.timers.add(timer);
		}
		error(error) {
			this.show({
				status: "failed",
				message: errorMessage(error)
			});
		}
		dispose() {
			this.timers.forEach((timer) => clearTimeout(timer));
			this.timers.clear();
			this.container.remove();
		}
	};
	function allowedHost(hostname) {
		return [
			"books.fishhawk.top",
			"books1.fishhawk.top",
			"n.novelia.cc"
		].includes(hostname);
	}
	function pageKind(pathname) {
		const path = pathname.replace(/\/+$/, "") || "/";
		if (path === "/wenku") return "wenkus";
		if (path.startsWith("/wenku/")) return "wenku";
		if (path === "/novel") return "novels";
		if (path.startsWith("/novel/")) return "novel";
		if (/^\/favorite\/web(?:\/|$)/.test(path)) return "favorite-web";
		if (/^\/favorite\/wenku(?:\/|$)/.test(path)) return "favorite-wenku";
		if (/^\/workspace\/(sakura|gpt)$/.test(path)) return "workspace";
		return "other";
	}
	function workspaceKind(pathname) {
		const match = /^\/workspace\/(sakura|gpt)\/?$/.exec(pathname);
		return match?.[1] === "sakura" ? "sakura" : match?.[1] === "gpt" ? "gpt" : null;
	}
	function queueSupported(pathname) {
		return [
			"wenkus",
			"wenku",
			"novels",
			"novel",
			"favorite-web",
			"favorite-wenku"
		].includes(pageKind(pathname));
	}
	function favoriteId(url) {
		const path = url.pathname.replace(/\/+$/, "");
		return /^\/favorite\/(web|wenku)$/.test(path) ? "default" : decodeURIComponent(path.split("/").pop() ?? "default");
	}
	var ModuleRunner = class {
		registry;
		settings;
		notifications;
		running = new Map();
		enabled = new Set();
		listeners = new Set();
		disposed = false;
		constructor(registry, settings, notifications) {
			this.registry = registry;
			this.settings = settings;
			this.notifications = notifications;
		}
		restoreEnabled() {
			const saved = this.settings.enabledNames();
			this.registry.modules.filter((module) => module.kind === "continuous" && saved.has(module.name)).forEach((module) => this.enabled.add(module.id));
		}
		isEnabled(module) {
			return this.enabled.has(module.id);
		}
		isRunning(module) {
			return this.running.has(module.id);
		}
		subscribe(listener) {
			this.listeners.add(listener);
			return () => this.listeners.delete(listener);
		}
		activate(module) {
			if (!this.available(module)) return;
			if (module.kind === "command") {
				this.run(module, false);
				return;
			}
			if (this.enabled.has(module.id)) this.stop(module);
			else {
				this.enabled.add(module.id);
				this.saveEnabled();
				this.emit(module);
				this.run(module, true);
			}
		}
		tick() {
			for (const module of this.registry.modules) if (module.kind === "continuous" && this.enabled.has(module.id) && this.available(module)) this.run(module, true);
		}
		async run(module, automatic) {
			const quiet = {
				status: "cancelled",
				message: ""
			};
			if (!this.available(module)) return quiet;
			if (this.running.has(module.id)) {
				if (!automatic) this.notifications.show({
					status: "partial",
					message: `${module.name} 正在執行`
				});
				return quiet;
			}
			const controller = new AbortController();
			this.running.set(module.id, controller);
			this.emit(module);
			try {
				const result = await module.execute({
					signal: controller.signal,
					automatic
				});
				if (!controller.signal.aborted && !this.disposed) this.notifications.show(result);
				return result;
			} catch (error) {
				if (controller.signal.aborted || this.disposed) return quiet;
				const result = {
					status: "failed",
					message: `${module.name}：${errorMessage(error)}`
				};
				this.notifications.show(result);
				if (module.kind === "continuous") this.stop(module);
				return result;
			} finally {
				if (this.running.get(module.id) === controller) this.running.delete(module.id);
				this.emit(module);
			}
		}
		cancelAll() {
			this.running.forEach((controller) => controller.abort());
			this.registry.dispose();
		}
		dispose() {
			this.disposed = true;
			this.cancelAll();
			this.listeners.clear();
		}
		stop(module) {
			this.enabled.delete(module.id);
			this.running.get(module.id)?.abort();
			module.dispose();
			this.saveEnabled();
			this.emit(module);
		}
		available(module) {
			return !this.disposed && allowedHost(location.hostname) && module.supports(location.pathname);
		}
		saveEnabled() {
			this.settings.saveEnabled(this.registry.modules.filter((module) => this.enabled.has(module.id)).map((module) => module.name));
		}
		emit(module) {
			this.listeners.forEach((listener) => listener(module));
		}
	};
	function webTask(url, start, end, mode, useBrowserCrawler = false) {
		return `web${url}?level=${mode}&forceMetadata=false&useBrowserCrawler=${useBrowserCrawler}&startIndex=${start}&endIndex=${end}`;
	}
	function wenkuTask(series, volume, mode, useBrowserCrawler = false) {
		return `wenku/${series}/${encodeURIComponent(volume)}?level=${mode}&forceMetadata=false&useBrowserCrawler=${useBrowserCrawler}&startIndex=0&endIndex=65536`;
	}
	function taskIdentity(task) {
		const separator = task.indexOf("?");
		const descriptor = separator < 0 ? task : task.slice(0, separator);
		const query = new URLSearchParams(separator < 0 ? "" : task.slice(separator + 1));
		if (!/^(web|wenku|local|personal|personal2)\//.test(descriptor)) return task;
		for (const [name, value] of [
			["forceMetadata", "false"],
			["useBrowserCrawler", "false"],
			["startIndex", "0"],
			["endIndex", "65535"]
		]) if (name && value && !query.has(name)) query.set(name, value);
		query.sort();
		return `${descriptor}?${query}`;
	}
	function insertJob(jobs, job) {
		const identity = taskIdentity(job.task);
		const index = jobs.findIndex((existing) => taskIdentity(existing.task) === identity);
		if (index < 0) {
			jobs.push(job);
			return true;
		}
		if (jobs[index]?.finishAt !== void 0) {
			jobs[index] = job;
			return true;
		}
		return false;
	}
	function finishedJob(job) {
		return isRecord(job.progress) && typeof job.progress.finished === "number" && typeof job.progress.total === "number" && job.progress.finished >= job.progress.total;
	}
	var WorkspaceService = class {
		storage;
		constructor(storage) {
			this.storage = storage;
		}
		read(kind) {
			const raw = this.storage.getItem(this.key(kind));
			const defaults = {
				workers: kind === "sakura" ? [
					{
						id: "共享",
						endpoint: "https://sakura-share.one"
					},
					{
						id: "本机",
						endpoint: "http://127.0.0.1:8080"
					},
					{
						id: "AutoDL",
						endpoint: "http://127.0.0.1:6006"
					}
				] : [],
				jobs: [],
				uncompletedJobs: []
			};
			if (!raw) return defaults;
			const stored = JSON.parse(raw);
			if (!isRecord(stored)) throw new Error("工作區資料格式不相容，已停止修改");
			const data = {
				...defaults,
				...stored
			};
			if (!isRecord(data) || !Array.isArray(data.workers) || !Array.isArray(data.jobs) || !Array.isArray(data.uncompletedJobs) || !data.workers.every((worker) => isRecord(worker) && typeof worker.id === "string") || !data.jobs.every((job) => isRecord(job) && typeof job.task === "string") || !data.uncompletedJobs.every((job) => isRecord(job) && typeof job.task === "string")) throw new Error("工作區資料格式不相容，已停止修改");
			return data;
		}
		async upsertWorkers(kind, workers, signal) {
			return this.mutate(kind, signal, (data) => {
				for (const worker of workers) {
					const index = data.workers.findIndex((existing) => existing.id === worker.id);
					if (index < 0) data.workers.push(worker);
					else data.workers[index] = {
						...data.workers[index],
						...worker
					};
				}
				return workers.length;
			});
		}
		async removeWorkers(kind, exclusions, signal) {
			return this.mutate(kind, signal, (data) => {
				const before = data.workers.length;
				data.workers = data.workers.filter((worker) => exclusions.some((keyword) => worker.id.includes(keyword)));
				return before - data.workers.length;
			});
		}
		async addJobs(kind, jobs, signal) {
			return this.mutate(kind, signal, (data) => {
				const added = [];
				for (const job of jobs) {
					const entry = {
						...job,
						createAt: Date.now()
					};
					if (insertJob(data.jobs, entry)) added.push(entry);
				}
				return added;
			});
		}
		unfinishedCount(kind) {
			return this.read(kind).uncompletedJobs.filter((job) => !finishedJob(job)).length;
		}
		async retryUnfinishedJobs(kind, moveToTop, signal) {
			return this.mutate(kind, signal, (data) => {
				const records = data.uncompletedJobs.filter((job) => !finishedJob(job));
				let retried = 0;
				for (const record of records) if (insertJob(data.jobs, {
					task: record.task,
					description: record.description,
					createAt: Date.now()
				})) retried++;
				if (moveToTop) {
					const tasks = new Set(records.map((job) => taskIdentity(job.task)));
					data.jobs = [...data.jobs.filter((job) => tasks.has(taskIdentity(job.task))), ...data.jobs.filter((job) => !tasks.has(taskIdentity(job.task)))];
				}
				data.uncompletedJobs = data.uncompletedJobs.filter(finishedJob);
				return {
					retried,
					skipped: records.length - retried
				};
			});
		}
		async refresh(kind, signal) {
			signal.throwIfAborted();
			const key = this.key(kind);
			const raw = this.storage.getItem(key);
			if (raw !== null) window.dispatchEvent(new StorageEvent("storage", {
				key,
				newValue: raw,
				url: location.href,
				storageArea: this.storage
			}));
		}
		key(kind) {
			return `workspace-${kind}`;
		}
		async mutate(kind, signal, change) {
			signal.throwIfAborted();
			if (!navigator.locks) throw new Error("瀏覽器不支援 Web Locks，已停止工作區修改以避免分頁互相覆蓋");
			const key = this.key(kind);
			return navigator.locks.request(`NTRToolBox:${key}`, { signal }, () => {
				signal.throwIfAborted();
				const oldValue = this.storage.getItem(key);
				const data = this.read(kind);
				const result = change(data);
				const newValue = JSON.stringify(data);
				if (oldValue === newValue) return result;
				this.storage.setItem(key, newValue);
				window.dispatchEvent(new StorageEvent("storage", {
					key,
					oldValue,
					newValue,
					url: location.href,
					storageArea: this.storage
				}));
				return result;
			});
		}
	};
	function typingEvent(event) {
		return event.composedPath().some((target) => target instanceof Element && (target.matches("input, textarea, select, [role=\"textbox\"]") || target instanceof HTMLElement && target.isContentEditable || Boolean(target.closest("[contenteditable]:not([contenteditable=\"false\"])"))));
	}
	var KeyboardBindings = class {
		registry;
		runner;
		onKey = (event) => {
			if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || typingEvent(event)) return;
			const key = event.key.toLowerCase();
			for (const module of this.registry.modules) {
				const bind = module.settings.find((setting) => setting.name === "bind")?.value;
				if (typeof bind === "string" && bind !== "none" && bind.toLowerCase() === key && module.supports(location.pathname)) {
					event.preventDefault();
					this.runner.activate(module);
				}
			}
		};
		constructor(registry, runner) {
			this.registry = registry;
			this.runner = runner;
		}
		start() {
			document.addEventListener("keydown", this.onKey);
		}
		dispose() {
			document.removeEventListener("keydown", this.onKey);
		}
	};
	var ToolboxApp = class {
		registry;
		runner;
		settings;
		workspace;
		panel;
		keyboard;
		notifications;
		keepTimer = null;
		routeTimer = null;
		routeController = new AbortController();
		lastUrl = location.href;
		constructor(registry, runner, settings, workspace, panel, keyboard, notifications) {
			this.registry = registry;
			this.runner = runner;
			this.settings = settings;
			this.workspace = workspace;
			this.panel = panel;
			this.keyboard = keyboard;
			this.notifications = notifications;
		}
		start() {
			this.settings.load(this.registry.modules);
			this.runner.restoreEnabled();
			this.panel.mount();
			this.keyboard.start();
			this.syncWorkspace();
			this.keepTimer = setInterval(() => this.runner.tick(), 1e3);
			this.routeTimer = setInterval(() => {
				if (location.href === this.lastUrl) return;
				this.lastUrl = location.href;
				this.routeController.abort();
				this.routeController = new AbortController();
				this.runner.cancelAll();
				this.panel.updateVisibility();
				this.syncWorkspace();
			}, 250);
		}
		dispose() {
			if (this.keepTimer !== null) clearInterval(this.keepTimer);
			if (this.routeTimer !== null) clearInterval(this.routeTimer);
			this.routeController.abort();
			this.runner.dispose();
			this.keyboard.dispose();
			this.panel.dispose();
			this.notifications.dispose();
		}
		syncWorkspace() {
			const kind = workspaceKind(location.pathname);
			if (kind) this.workspace.refresh(kind, this.routeController.signal).catch((error) => this.notifications.error(error));
		}
	};
	var AuthService = class {
		storage;
		constructor(storage) {
			this.storage = storage;
		}
		getToken() {
			const auth = parseRecord(this.storage.getItem("auth-v2"));
			return typeof auth?.token === "string" && auth.token.trim().length > 0 ? auth.token : null;
		}
	};
	var HttpError = class extends Error {
		status;
		constructor(status) {
			super(status === 401 || status === 403 ? `登入失效或無權限（HTTP ${status}）` : `請求失敗（HTTP ${status}）`);
			this.status = status;
			this.name = "HttpError";
		}
	};
	var ApiService = class {
		auth;
		constructor(auth) {
			this.auth = auth;
		}
		async getJson(url, signal, authenticated = true) {
			const target = new URL(url, location.origin);
			if (target.origin !== location.origin) throw new Error("站點 API 請求必須與目前頁面同源");
			for (let attempt = 0; attempt < 3; attempt++) {
				signal.throwIfAborted();
				try {
					const token = authenticated ? this.auth.getToken() : null;
					const response = await fetch(target, {
						signal: AbortSignal.any([signal, AbortSignal.timeout(15e3)]),
						headers: token ? { Authorization: `Bearer ${token}` } : {}
					});
					if (!response.ok) throw new HttpError(response.status);
					return await response.json();
				} catch (error) {
					signal.throwIfAborted();
					if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
					if (attempt === 2) throw error;
					await delay(1e3 * 2 ** attempt, signal);
				}
			}
			throw new Error("API 重試已達上限");
		}
	};
	function listQuery(search, page, limit) {
		const route = new URLSearchParams(search);
		const selected = route.getAll("selected");
		const mask = selectedNumber(selected[0], 255);
		const providers = [
			"kakuyomu",
			"syosetu",
			"novelup",
			"hameln",
			"pixiv",
			"alphapolis"
		].filter((_, index) => (mask & 1 << index) !== 0);
		return new URLSearchParams({
			page: String(page),
			pageSize: String(limit),
			query: route.get("query") ?? "",
			provider: providers.join(","),
			type: String(selectedNumber(selected[1], 0)),
			level: String(selectedNumber(selected[2], 0)),
			translate: String(selectedNumber(selected[3], 0)),
			sort: String(selectedNumber(selected[4], 0))
		});
	}
	function listPage(search) {
		return Math.max(0, selectedNumber(new URLSearchParams(search).get("page") ?? void 0, 1) - 1);
	}
	function favoriteSort(search, createTimeFirst, offset = 4) {
		return selectedNumber(new URLSearchParams(search).getAll("selected")[offset], 0) === 0 ? createTimeFirst ? "create" : "update" : createTimeFirst ? "update" : "create";
	}
	function selectedNumber(value, fallback) {
		const parsed = value === void 0 || value === "" ? NaN : Number(value);
		return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
	}
	var SiteAdapter = class {
		toolboxMountPoint() {
			const page = pageKind(location.pathname);
			if (page === "other") return null;
			if (page === "novel" || page === "wenku") {
				const content = document.querySelector(".layout-content, main");
				if (!content?.querySelector("h1, h2, h3")) return null;
				const parent = page === "novel" ? content.querySelector(".metadata-stat")?.parentElement : content;
				if (!parent) return null;
				const children = [...parent.children].filter((element) => !element.hasAttribute("data-ntr-root"));
				if (page === "novel") {
					const comments = [...parent.querySelectorAll("h2, h3")].find((heading) => ["评论", "評論"].includes(heading.textContent?.trim() ?? ""));
					const commentSection = comments && children.find((element) => element.contains(comments));
					if (commentSection) return {
						parent,
						before: commentSection
					};
					const workspace = children.find((element) => [...element.querySelectorAll("button")].some((button) => ["导入工作区", "導入工作區"].includes(button.textContent?.trim() ?? "")));
					return workspace ? {
						parent,
						before: children[children.indexOf(workspace) + 1] ?? null
					} : null;
				}
				return {
					parent,
					before: children[0] ?? null
				};
			}
			const heading = document.querySelector(".layout-content h1, main h1");
			const parent = heading?.parentElement;
			if (!parent) return null;
			const children = [...parent.children].filter((element) => !element.hasAttribute("data-ntr-root"));
			if (page === "workspace") return {
				parent,
				before: children.find((element) => element.matches("h2") || element.querySelector("h2")) ?? children[children.indexOf(heading) + 1] ?? null
			};
			return {
				parent,
				before: children.find((element) => element.matches(".n-pagination")) ?? children.find((element) => element.matches("ul, [role=\"list\"]")) ?? null
			};
		}
		wenkuIds(limit) {
			const ids = [...document.querySelectorAll("a[href^=\"/wenku/\"]")].map((link) => new URL(link.href).pathname.split("/")[2]).filter((id) => Boolean(id));
			return [...new Set(ids)].slice(0, limit);
		}
		webSearchApi(limit) {
			return `/api/novel?${listQuery(location.search, listPage(location.search), limit)}`;
		}
		favoriteWebQuery(search, page, limit) {
			const params = listQuery(search, page, limit);
			params.set("sort", favoriteSort(search, this.favoriteCreateTimeFirst()));
			return params;
		}
		favoriteWenkuQuery(search, page, limit) {
			return new URLSearchParams({
				page: String(page),
				pageSize: String(limit),
				sort: favoriteSort(search, this.favoriteCreateTimeFirst(), 0)
			});
		}
		launchButtons(exclusions, automatic) {
			return this.buttons("启动", "啟動").filter((button) => {
				const item = button.closest(".n-list-item");
				const title = item?.querySelector(".n-thing-header__title")?.textContent ?? "";
				if (exclusions.some((keyword) => title.includes(keyword))) return false;
				return !automatic || !item?.textContent?.includes("TypeError: Failed to fetch");
			});
		}
		runningCount() {
			return this.buttons("停止").length;
		}
		favoriteCreateTimeFirst() {
			return parseRecord(localStorage.getItem("setting"))?.favoriteCreateTimeFirst === true;
		}
		buttons(...labels) {
			return [...document.querySelectorAll("button")].filter((button) => !button.disabled && !button.closest("[data-ntr-root]") && Boolean(button.closest(".n-list-item .n-thing")) && labels.some((label) => button.textContent?.trim() === label));
		}
	};
	var TranslatorService = class {
		site;
		active = null;
		constructor(site) {
			this.site = site;
		}
		launch(options, signal) {
			if (this.active) return this.active;
			const operation = this.launchSequentially(options, signal);
			this.active = operation;
			operation.finally(() => {
				if (this.active === operation) this.active = null;
			}).catch(() => {});
			return operation;
		}
		async launchSequentially(options, signal) {
			const buttons = this.site.launchButtons(options.exclusions, options.automatic);
			let clicked = 0;
			let lastRunning = this.site.runningCount();
			let emptyAttempts = 0;
			for (const button of buttons) {
				signal.throwIfAborted();
				if (clicked >= options.maximum) break;
				if (!button.isConnected || button.disabled || !/^(启动|啟動)$/.test(button.textContent?.trim() ?? "")) continue;
				button.click();
				clicked++;
				await delay(options.interval, signal);
				if (options.avoidEmpty) {
					const running = this.site.runningCount();
					emptyAttempts = running > lastRunning ? 0 : emptyAttempts + 1;
					lastRunning = running;
					if (emptyAttempts >= 4) break;
				}
			}
			return clicked;
		}
	};
	function apiPage(value) {
		if (!isRecord(value) || !Array.isArray(value.items)) throw new Error("小說列表回應格式不相容");
		const pageNumber = value.pageNumber;
		if (pageNumber !== void 0 && (typeof pageNumber !== "number" || !Number.isSafeInteger(pageNumber) || pageNumber < 0)) throw new Error("小說列表回應頁數不正確");
		return {
			items: value.items,
			pageNumber
		};
	}
	function novelDetailSource(value, kind, url) {
		if (!isRecord(value) || !Array.isArray(value.toc)) throw new Error("小說回應缺少章節目錄");
		return {
			url,
			description: String(value.titleZh ?? value.titleJp ?? url),
			total: value.toc.filter((item) => isRecord(item) && typeof item.chapterId === "string" && item.chapterId.length > 0).length,
			translated: finiteCount(value[kind] ?? 0)
		};
	}
	function novelSources(items, kind) {
		return items.map((item) => {
			if (!isRecord(item) || typeof item.providerId !== "string" || typeof item.novelId !== "string") throw new Error("小說回應缺少 providerId 或 novelId");
			return {
				url: `/${item.providerId}/${item.novelId}`,
				description: String(item.titleZh ?? item.titleJp ?? item.novelId),
				total: finiteCount(item.total),
				translated: finiteCount(item[kind] ?? 0)
			};
		});
	}
	function volumeIds(value) {
		if (!isRecord(value) || !Array.isArray(value.volumeJp)) throw new Error("文庫回應缺少 volumeJp");
		return [...new Set(value.volumeJp.map((volume) => {
			if (!isRecord(volume) || typeof volume.volumeId !== "string") throw new Error("文庫回應缺少 volumeId");
			return volume.volumeId;
		}))];
	}
	function favoredWenkuIds(items) {
		return [...new Set(items.map((item) => {
			if (!isRecord(item) || typeof item.id !== "string") throw new Error("收藏文庫回應缺少 id");
			return item.id;
		}))];
	}
	function allocateTasks(novels, options) {
		const eligible = novels.filter((n) => n.total > 0 && (options.mode !== "normal" || n.translated < n.total));
		if (!eligible.length) return [];
		if (options.split === "static") return eligible.flatMap((n) => splitNovel(n, options.parts, options));
		if (eligible.length > options.jobLimit) throw new Error(`共有 ${eligible.length} 本待排小說，超過任務上限 ${options.jobLimit}；請提高上限`);
		const chapters = eligible.reduce((sum, novel) => sum + novel.total, 0);
		const budget = Math.min(options.jobLimit, Math.max(eligible.length, Math.floor(chapters / options.chapterMinimum)));
		const slots = eligible.map(() => 1);
		for (let used = eligible.length; used < budget; used++) {
			let candidate = -1;
			let largest = 0;
			eligible.forEach((novel, index) => {
				const count = slots[index] ?? 1;
				if (count >= novel.total) return;
				const size = novel.total / count;
				if (size > largest) {
					candidate = index;
					largest = size;
				}
			});
			if (candidate < 0) break;
			slots[candidate] = (slots[candidate] ?? 1) + 1;
		}
		return eligible.flatMap((novel, index) => splitNovel(novel, slots[index] ?? 1, options));
	}
	function splitNovel(novel, requested, options) {
		const parts = Math.min(requested, novel.total);
		const result = [];
		for (let index = 0; index < parts; index++) {
			const start = Math.floor(index * novel.total / parts);
			const end = Math.floor((index + 1) * novel.total / parts);
			result.push({
				task: webTask(novel.url, start, end, options.mode, options.useBrowserCrawler),
				description: novel.description
			});
		}
		return result;
	}
	function jobBookCount(jobs) {
		return new Set(jobs.map((job) => job.task.startsWith("wenku/") ? job.task.split("/")[1] : job.task.split("?")[0])).size;
	}
	var QueueService = class {
		api;
		workspace;
		site;
		constructor(api, workspace, site) {
			this.api = api;
			this.workspace = workspace;
			this.site = site;
		}
		async queue(kind, options, signal) {
			signal.throwIfAborted();
			let jobs;
			const failures = [];
			switch (pageKind(location.pathname)) {
				case "wenku": {
					const id = location.pathname.split("/")[2];
					if (!id) throw new Error("找不到文庫小說 ID");
					jobs = await this.wenkuJobs([id], options, signal, failures);
					break;
				}
				case "wenkus":
					jobs = await this.wenkuJobs(this.site.wenkuIds(options.wenkuLimit), options, signal, failures);
					break;
				case "novel": {
					const url = location.pathname.slice(6);
					jobs = allocateTasks([novelDetailSource(await this.api.getJson(`/api/novel${url}`, signal, options.authenticated), kind, url)], options);
					break;
				}
				case "novels":
					jobs = allocateTasks(novelSources(apiPage(await this.api.getJson(this.site.webSearchApi(options.webLimit), signal, options.authenticated)).items, kind), options);
					break;
				case "favorite-web":
					jobs = allocateTasks(await this.favoriteNovels(kind, options, signal), options);
					break;
				case "favorite-wenku": {
					const ids = await this.favoriteWenkuIds(signal);
					jobs = await this.wenkuJobs(ids, options, signal, failures);
					break;
				}
				default: throw new Error("目前頁面不支援排隊");
			}
			signal.throwIfAborted();
			const added = jobs.length ? await this.workspace.addJobs(kind, jobs, signal) : [];
			const skipped = new Set(jobs.map((job) => job.task)).size - added.length;
			const books = jobBookCount(added);
			return {
				status: failures.length ? added.length || skipped ? "partial" : "failed" : "success",
				message: `新增 ${added.length} 個任務／${books} 本小說，跳過 ${skipped} 個已排任務` + (failures.length ? `；${failures.length} 本文庫失敗：${failures.slice(0, 3).join("；")}` : ""),
				added: added.length,
				skipped,
				books
			};
		}
		async wenkuJobs(ids, options, signal, failures) {
			const jobs = [];
			for (const id of new Set(ids)) {
				signal.throwIfAborted();
				try {
					const data = await this.api.getJson(`/api/wenku/${encodeURIComponent(id)}`, signal, options.authenticated);
					for (const volume of volumeIds(data)) jobs.push({
						task: wenkuTask(id, volume, options.mode, options.useBrowserCrawler),
						description: volume
					});
				} catch (error) {
					signal.throwIfAborted();
					if (error instanceof HttpError && (error.status === 401 || error.status === 403)) throw error;
					failures.push(`${id}：${errorMessage(error)}`);
				}
			}
			return jobs;
		}
		async favoriteNovels(kind, options, signal) {
			const id = encodeURIComponent(favoriteId(new URL(location.href)));
			const search = location.search;
			const novels = new Map();
			for (let page = 0;; page++) {
				const data = apiPage(await this.api.getJson(`/api/user/favored-web/${id}?${this.site.favoriteWebQuery(search, page, 90)}`, signal));
				const batch = novelSources(data.items, kind);
				const before = novels.size;
				for (const novel of batch) novels.set(novel.url, novel);
				if (options.split === "smart" && [...novels.values()].filter((n) => n.total > 0 && (options.mode !== "normal" || n.translated < n.total)).length > options.jobLimit) throw new Error(`收藏中的待排小說已超過任務上限 ${options.jobLimit}；請提高上限`);
				if (data.pageNumber !== void 0 ? page + 1 >= data.pageNumber : data.items.length < 90) return [...novels.values()];
				if (novels.size === before) throw new Error("收藏 API 重複回傳同一頁，已停止擷取");
			}
		}
		async favoriteWenkuIds(signal) {
			const id = encodeURIComponent(favoriteId(new URL(location.href)));
			const search = location.search;
			const ids = new Set();
			for (let page = 0;; page++) {
				const data = apiPage(await this.api.getJson(`/api/user/favored-wenku/${id}?${this.site.favoriteWenkuQuery(search, page, 72)}`, signal));
				const before = ids.size;
				for (const novelId of favoredWenkuIds(data.items)) ids.add(novelId);
				if (data.pageNumber !== void 0 ? page + 1 >= data.pageNumber : data.items.length < 72) return [...ids];
				if (ids.size === before) throw new Error("收藏 API 重複回傳同一頁，已停止擷取");
			}
		}
	};
	function numberSetting(name, value, min = 0) {
		return {
			name,
			type: "number",
			value,
			min
		};
	}
	function stringSetting(name, value) {
		return {
			name,
			type: "string",
			value
		};
	}
	function booleanSetting(name, value) {
		return {
			name,
			type: "boolean",
			value
		};
	}
	function selectSetting(name, options, value) {
		return {
			name,
			type: "select",
			value,
			options
		};
	}
	function settingValue(settings, name) {
		const setting = settings.find((item) => item.name === name);
		if (!setting) throw new Error(`找不到設定：${name}`);
		return setting.value;
	}
	function numberValue(settings, name) {
		const definition = settings.find((item) => item.name === name);
		const value = settingValue(settings, name);
		if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (definition?.min ?? 0)) throw new Error(`${name} 必須是大於等於 ${definition?.min ?? 0} 的整數`);
		return value;
	}
	function stringValue(settings, name) {
		return String(settingValue(settings, name));
	}
	function booleanValue(settings, name) {
		return settingValue(settings, name) === true;
	}
	function translateMode(value) {
		if (value === "常規") return "normal";
		if (value === "過期") return "expire";
		if (value === "重翻") return "all";
		throw new Error(`不支援的翻譯模式：${value}`);
	}
	function exclusions(value) {
		return value.split(/[,，]/).map((word) => word.trim()).filter(Boolean);
	}
	var AddSakuraTranslatorModule = class {
		workspace;
		id = "add-sakura";
		name = "添加Sakura翻譯器";
		kind = "command";
		settings = [
			numberSetting("數量", 5, 1),
			stringSetting("名稱", "NTR translator "),
			stringSetting("鏈接", "https://sakura-share.one"),
			stringSetting("bind", "none")
		];
		constructor(workspace) {
			this.workspace = workspace;
		}
		supports(pathname) {
			return workspaceKind(pathname) === "sakura";
		}
		async execute({ signal }) {
			const count = numberValue(this.settings, "數量");
			const prefix = stringValue(this.settings, "名稱");
			const endpoint = stringValue(this.settings, "鏈接");
			const workers = Array.from({ length: count }, (_, index) => ({
				id: `${prefix}${index + 1}`,
				endpoint,
				prevSegLength: 500,
				segLength: 500
			}));
			return {
				status: "success",
				message: `已新增或更新 ${await this.workspace.upsertWorkers("sakura", workers, signal)} 個 Sakura 翻譯器`
			};
		}
		dispose() {}
	};
	var AddGPTTranslatorModule = class {
		workspace;
		id = "add-gpt";
		name = "添加GPT翻譯器";
		kind = "command";
		settings = [
			numberSetting("數量", 5, 1),
			stringSetting("名稱", "NTR translator "),
			stringSetting("模型", "deepseek-chat"),
			stringSetting("鏈接", "https://api.deepseek.com"),
			stringSetting("Key", "sk-wait-for-input"),
			stringSetting("bind", "none")
		];
		constructor(workspace) {
			this.workspace = workspace;
		}
		supports(pathname) {
			return workspaceKind(pathname) === "gpt";
		}
		async execute({ signal }) {
			const count = numberValue(this.settings, "數量");
			const prefix = stringValue(this.settings, "名稱");
			const model = stringValue(this.settings, "模型");
			const endpoint = stringValue(this.settings, "鏈接");
			const key = stringValue(this.settings, "Key");
			const workers = Array.from({ length: count }, (_, index) => ({
				id: `${prefix}${index + 1}`,
				model,
				endpoint,
				key
			}));
			return {
				status: "success",
				message: `已新增或更新 ${await this.workspace.upsertWorkers("gpt", workers, signal)} 個 GPT 翻譯器`
			};
		}
		dispose() {}
	};
	var DeleteTranslatorModule = class {
		workspace;
		id = "delete-translators";
		name = "刪除翻譯器";
		kind = "command";
		settings = [stringSetting("排除", "共享,本机,AutoDL"), stringSetting("bind", "none")];
		constructor(workspace) {
			this.workspace = workspace;
		}
		supports(pathname) {
			return workspaceKind(pathname) !== null;
		}
		async execute({ signal }) {
			const kind = workspaceKind(location.pathname);
			if (!kind) throw new Error("請先開啟翻譯器工作區");
			return {
				status: "success",
				message: `已刪除 ${await this.workspace.removeWorkers(kind, exclusions(stringValue(this.settings, "排除")), signal)} 個翻譯器`
			};
		}
		dispose() {}
	};
	function readLaunchOptions(settings, automatic) {
		return {
			interval: numberValue(settings, "延遲間隔"),
			maximum: numberValue(settings, "最多啟動"),
			avoidEmpty: booleanValue(settings, "避免無效啟動"),
			exclusions: exclusions(stringValue(settings, "排除")),
			automatic
		};
	}
	var LaunchTranslatorModule = class {
		translators;
		id = "launch-translators";
		name = "啟動翻譯器";
		kind = "command";
		settings = [
			numberSetting("延遲間隔", 50),
			numberSetting("最多啟動", 999),
			booleanSetting("避免無效啟動", true),
			stringSetting("排除", "本机,AutoDL"),
			stringSetting("bind", "none")
		];
		constructor(translators) {
			this.translators = translators;
		}
		supports(pathname) {
			return workspaceKind(pathname) !== null;
		}
		async execute({ signal, automatic }) {
			return {
				status: "success",
				message: `已送出 ${await this.translators.launch(readLaunchOptions(this.settings, automatic), signal)} 次啟動操作`
			};
		}
		dispose() {}
	};
	function queueSettings() {
		const isWeb = (pathname) => [
			"novel",
			"novels",
			"favorite-web"
		].includes(pageKind(pathname));
		const splitIs = (settings, value) => settings.find((setting) => setting.name === "分段")?.value === value;
		return [
			{
				...numberSetting("單次擷取web數量(可破限)", 20, 1),
				label: "擷取數量（本）",
				description: "可超過網站單頁顯示數量",
				visible: (_, pathname) => pageKind(pathname) === "novels"
			},
			{
				...numberSetting("擷取單頁wenku數量(deving)", 20, 1),
				visible: (_, pathname) => pageKind(pathname) === "wenkus"
			},
			{
				...selectSetting("模式", [
					"常規",
					"過期",
					"重翻"
				], "常規"),
				label: "翻譯模式"
			},
			{
				...selectSetting("分段", ["智能", "固定"], "智能"),
				label: "任務分段",
				visible: (_, pathname) => isWeb(pathname)
			},
			{
				...numberSetting("智能均分任務上限", 1e3, 1),
				label: "任務上限",
				visible: (settings, pathname) => isWeb(pathname) && splitIs(settings, "智能")
			},
			{
				...numberSetting("智能均分章節下限", 5, 1),
				label: "每個任務至少（章）",
				visible: (settings, pathname) => isWeb(pathname) && splitIs(settings, "智能")
			},
			{
				...numberSetting("固定均分任務", 6, 1),
				label: "均分任務數",
				visible: (settings, pathname) => isWeb(pathname) && splitIs(settings, "固定")
			},
			{
				...booleanSetting("R18(需登入)", true),
				label: "使用登入權限（含 R18）"
			},
			{
				...booleanSetting("使用瀏覽器爬蟲", false),
				visible: (_, pathname) => [
					"wenku",
					"wenkus",
					"favorite-wenku"
				].includes(pageKind(pathname))
			},
			{
				...stringSetting("bind", "none"),
				label: "快捷鍵"
			}
		];
	}
	function readQueueOptions(settings) {
		return {
			webLimit: numberValue(settings, "單次擷取web數量(可破限)"),
			wenkuLimit: numberValue(settings, "擷取單頁wenku數量(deving)"),
			mode: translateMode(stringValue(settings, "模式")),
			split: stringValue(settings, "分段") === "智能" ? "smart" : "static",
			jobLimit: numberValue(settings, "智能均分任務上限"),
			chapterMinimum: numberValue(settings, "智能均分章節下限"),
			parts: numberValue(settings, "固定均分任務"),
			authenticated: booleanValue(settings, "R18(需登入)"),
			useBrowserCrawler: booleanValue(settings, "使用瀏覽器爬蟲")
		};
	}
	var QueueSakuraModule = class {
		queue;
		id = "queue-sakura";
		name = "排隊Sakura v2";
		kind = "command";
		settings = queueSettings();
		constructor(queue) {
			this.queue = queue;
		}
		supports(pathname) {
			return queueSupported(pathname);
		}
		execute({ signal }) {
			return this.queue.queue("sakura", readQueueOptions(this.settings), signal);
		}
		dispose() {}
	};
	var QueueGPTModule = class {
		queue;
		id = "queue-gpt";
		name = "排隊GPT v2";
		kind = "command";
		settings = queueSettings();
		constructor(queue) {
			this.queue = queue;
		}
		supports(pathname) {
			return queueSupported(pathname);
		}
		execute({ signal }) {
			return this.queue.queue("gpt", readQueueOptions(this.settings), signal);
		}
		dispose() {}
	};
	var AutoRetryModule = class {
		site;
		translators;
		launchSettings;
		workspace;
		id = "auto-retry";
		name = "自動重試";
		kind = "continuous";
		settings = [
			numberSetting("最大重試次數", 99),
			booleanSetting("置頂重試任務", false),
			booleanSetting("重啟翻譯器", true)
		];
		attempts = 0;
		nextRun = 0;
		listening = false;
		onManualClick = (event) => {
			const element = event.target instanceof Element ? event.target : null;
			if (event.isTrusted && element?.closest("button") && !element.closest("[data-ntr-root]")) {
				this.attempts = 0;
				this.nextRun = 0;
			}
		};
		constructor(site, translators, launchSettings, workspace) {
			this.site = site;
			this.translators = translators;
			this.launchSettings = launchSettings;
			this.workspace = workspace;
		}
		supports(pathname) {
			return workspaceKind(pathname) !== null;
		}
		async execute({ signal }) {
			if (!this.listening) {
				document.addEventListener("click", this.onManualClick);
				this.listening = true;
			}
			const quiet = {
				status: "success",
				message: ""
			};
			if (Date.now() < this.nextRun || this.site.runningCount() > 0) return quiet;
			if (this.attempts >= numberValue(this.settings, "最大重試次數")) return quiet;
			const kind = workspaceKind(location.pathname);
			if (!kind) return quiet;
			if (!this.workspace.unfinishedCount(kind)) return quiet;
			const retry = await this.workspace.retryUnfinishedJobs(kind, booleanValue(this.settings, "置頂重試任務"), signal);
			this.attempts++;
			this.nextRun = Date.now() + Math.min(6e4, 1e3 * 2 ** Math.min(this.attempts - 1, 6));
			if (booleanValue(this.settings, "重啟翻譯器")) await this.translators.launch(readLaunchOptions(this.launchSettings, true), signal);
			return {
				status: "success",
				message: `已重排 ${retry.retried} 個任務，跳過 ${retry.skipped} 個已排任務（第 ${this.attempts} 輪）`
			};
		}
		dispose() {
			document.removeEventListener("click", this.onManualClick);
			this.listening = false;
			this.attempts = 0;
			this.nextRun = 0;
		}
	};
	var SettingsForm = class {
		onSave;
		notifications;
		selectStyle;
		lifetime = new AbortController();
		pendingSetting = null;
		pendingButton = null;
		fields = [];
		captureKey = (event) => {
			if (!this.pendingSetting || event.isComposing || [
				"Control",
				"Alt",
				"Shift",
				"Meta"
			].includes(event.key)) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			this.pendingSetting.value = event.key === "Escape" ? "none" : event.key.toLowerCase();
			this.cancelCapture();
			this.save();
		};
		constructor(onSave, notifications, selectStyle = "native") {
			this.onSave = onSave;
			this.notifications = notifications;
			this.selectStyle = selectStyle;
			document.addEventListener("keydown", this.captureKey, {
				capture: true,
				signal: this.lifetime.signal
			});
		}
		render(settings) {
			const form = document.createElement("div");
			form.className = "ntr-settings-container";
			form.hidden = true;
			for (const setting of settings) {
				const row = document.createElement(setting.type === "select" && this.selectStyle === "segments" ? "div" : "label");
				row.className = "ntr-setting-row";
				row.dataset.setting = setting.name;
				row.dataset.type = setting.type;
				const caption = document.createElement("span");
				caption.textContent = setting.label ?? (setting.name === "bind" ? "快捷鍵" : setting.name === "擷取單頁wenku數量(deving)" ? "擷取單頁文庫數量" : setting.name);
				row.append(caption, this.input(setting));
				if (setting.description) {
					const description = document.createElement("small");
					description.textContent = setting.description;
					row.append(description);
				}
				form.append(row);
				this.fields.push({
					setting,
					settings,
					row
				});
			}
			this.refreshVisibility();
			return form;
		}
		refreshVisibility() {
			for (const { setting, settings, row } of this.fields) {
				row.hidden = setting.visible?.(settings, location.pathname) === false;
				if (row.hidden && this.pendingSetting === setting) this.cancelCapture();
			}
		}
		dispose() {
			this.cancelCapture();
			this.lifetime.abort();
			this.fields.length = 0;
		}
		input(setting) {
			if (setting.name === "bind") {
				const button = document.createElement("button");
				button.type = "button";
				button.textContent = this.bindLabel(setting);
				button.addEventListener("click", () => {
					this.cancelCapture();
					this.pendingSetting = setting;
					this.pendingButton = button;
					button.textContent = "請按按鍵（Esc 清除）";
				}, { signal: this.lifetime.signal });
				return button;
			}
			if (setting.type === "select") {
				if (this.selectStyle === "segments") return this.enumButtons(setting);
				const select = document.createElement("select");
				for (const value of setting.options ?? []) {
					const option = document.createElement("option");
					option.value = value;
					option.textContent = value;
					select.append(option);
				}
				select.value = String(setting.value);
				select.addEventListener("change", () => {
					setting.value = select.value;
					this.save();
				}, { signal: this.lifetime.signal });
				return select;
			}
			const input = document.createElement("input");
			input.type = setting.type === "boolean" ? "checkbox" : setting.type === "number" ? "number" : setting.name === "Key" ? "password" : "text";
			if (setting.type === "boolean") input.checked = setting.value === true;
			else input.value = String(setting.value);
			if (setting.type === "number") {
				input.min = String(setting.min ?? 0);
				input.step = "1";
				input.required = true;
			}
			const commitInput = (reportInvalid) => {
				if (setting.type === "number") {
					const value = input.valueAsNumber;
					if (!Number.isSafeInteger(value) || value < (setting.min ?? 0)) {
						if (reportInvalid) {
							this.notifications.error(new Error(`${setting.name} 必須是大於等於 ${setting.min ?? 0} 的整數`));
							input.value = String(setting.value);
						}
						return;
					}
					setting.value = value;
				} else setting.value = setting.type === "boolean" ? input.checked : input.value;
				this.save();
			};
			input.addEventListener("input", () => commitInput(false), { signal: this.lifetime.signal });
			input.addEventListener("change", () => commitInput(true), { signal: this.lifetime.signal });
			return input;
		}
		enumButtons(setting) {
			const group = document.createElement("div");
			group.className = "ntr-enum";
			group.setAttribute("role", "radiogroup");
			group.setAttribute("aria-label", setting.label ?? setting.name);
			const options = setting.options ?? [];
			group.style.setProperty("--enum-count", String(options.length));
			const buttons = [];
			const update = () => {
				const selected = options.indexOf(String(setting.value));
				group.style.setProperty("--enum-index", String(Math.max(0, selected)));
				buttons.forEach((button, index) => {
					button.setAttribute("aria-checked", String(index === selected));
					button.tabIndex = index === selected ? 0 : -1;
				});
			};
			const select = (index) => {
				setting.value = options[index];
				update();
				this.save();
			};
			options.forEach((value, index) => {
				const button = document.createElement("button");
				button.type = "button";
				button.textContent = value;
				button.setAttribute("role", "radio");
				button.addEventListener("click", () => select(index), { signal: this.lifetime.signal });
				button.addEventListener("keydown", (event) => {
					let next;
					switch (event.key) {
						case "ArrowRight":
						case "ArrowDown":
							next = (index + 1) % options.length;
							break;
						case "ArrowLeft":
						case "ArrowUp":
							next = (index + options.length - 1) % options.length;
							break;
						case "Home":
							next = 0;
							break;
						case "End":
							next = options.length - 1;
							break;
						default: return;
					}
					event.preventDefault();
					select(next);
					buttons[next].focus();
				}, { signal: this.lifetime.signal });
				buttons.push(button);
				group.append(button);
			});
			update();
			return group;
		}
		bindLabel(setting) {
			return setting.value === "none" ? "(None)" : `[${String(setting.value).toUpperCase()}]`;
		}
		cancelCapture() {
			if (this.pendingButton && this.pendingSetting) this.pendingButton.textContent = this.bindLabel(this.pendingSetting);
			this.pendingButton = null;
			this.pendingSetting = null;
		}
		save() {
			this.refreshVisibility();
			try {
				this.onSave();
			} catch (error) {
				this.notifications.error(error);
			}
		}
	};
	var web_novel_default = ":host{--queue-bg:var(--n-color,#fff);--queue-text:var(--n-text-color,#333639);--queue-muted:#72777d;--queue-line:#e5e7e9;--queue-green:#188759;--queue-on-green:#fff;--queue-tint:#f1f8f4;--queue-field:#fff;--queue-error:#a32828;--queue-error-bg:#fff6f4;--queue-warning:#815900;--queue-warning-bg:#fffaee;color:var(--queue-text);margin:16px 0 4px;font:13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Microsoft JhengHei,sans-serif;display:block;container-type:inline-size}:host([data-theme=dark]){--queue-bg:var(--n-color,#101014);--queue-text:var(--n-text-color,#dedee4);--queue-muted:#a1a1aa;--queue-line:#303038;--queue-green:#63e2b7;--queue-on-green:#10281f;--queue-tint:#172720;--queue-field:#242428;--queue-error:#ffada6;--queue-error-bg:#301e1e;--queue-warning:#efd288;--queue-warning-bg:#2d281a}*{box-sizing:border-box}[hidden]{display:none!important}.toolbar{border:1px solid var(--queue-line);background:var(--queue-bg);border-radius:4px}.bar{align-items:center;gap:10px;min-height:46px;padding:7px 10px;display:flex}.title{white-space:nowrap;align-items:center;gap:7px;font-weight:500;display:flex}.badge{color:var(--queue-green);border:1px solid color-mix(in srgb, var(--queue-green) 30%, transparent);border-radius:3px;padding:0 4px;font-size:10px;font-weight:500}button,input,select{font:inherit;color:inherit}button{cursor:pointer;border:1px solid var(--queue-line);white-space:nowrap;background:0 0;border-radius:3px;min-height:32px;padding:5px 10px}button:hover{border-color:var(--queue-green)}button:disabled{opacity:.6;cursor:progress}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--queue-green);outline-offset:2px}.engines{border:1px solid var(--queue-line);background:var(--queue-field);border-radius:3px;flex-shrink:0;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;padding:2px;display:grid;position:relative}.engines:before{content:\"\";background:var(--queue-tint);width:calc(50% - 3px);box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--queue-green) 30%, transparent);pointer-events:none;border-radius:2px;transition:transform .24s cubic-bezier(.2,0,0,1);position:absolute;inset:2px auto 2px 2px}:host([data-engine=gpt]) .engines:before{transform:translate(calc(100% + 2px))}.engines button{min-height:26px;color:var(--queue-muted);border:0;padding:3px 9px;font-size:12px;transition:color .18s;position:relative}.engines button:hover{color:var(--queue-text)}.engines button[aria-pressed=true]{color:var(--queue-green)}.summary{color:var(--queue-muted);white-space:nowrap;margin-right:auto;font-size:11px}.settings-toggle{justify-content:center;align-items:center;gap:4px;margin-left:auto;display:inline-flex}.chevron{transform-origin:50%;flex:0 0 1em;width:1em;height:1em;transition:transform .22s;display:block}.settings-toggle[aria-expanded=true]{color:var(--queue-green)}.settings-toggle[aria-expanded=true] .chevron{transform:rotate(180deg)}.primary{background:var(--queue-green);border-color:var(--queue-green);color:var(--queue-on-green)}.disclosure{grid-template-rows:0fr;transition:grid-template-rows .22s cubic-bezier(.2,0,0,1);display:grid}.disclosure.expanded{grid-template-rows:1fr}.disclosure-inner{min-height:0;overflow:hidden}.settings-content{border-top:1px solid var(--queue-line);padding:13px 14px 10px}.ntr-settings-container{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 16px;display:grid}.ntr-setting-row{flex-direction:column;gap:5px;min-width:0;font-size:12px;display:flex}.ntr-setting-row small{color:var(--queue-muted);font-size:11px}.ntr-setting-row input:not([type=checkbox]),.ntr-setting-row select,.ntr-setting-row>button{border:1px solid var(--queue-line);background:var(--queue-field);border-radius:3px;width:100%;min-width:0;min-height:32px;padding:5px 8px}.ntr-enum{grid-template-columns:repeat(var(--enum-count), minmax(0, 1fr));border:1px solid var(--queue-line);background:var(--queue-field);border-radius:3px;padding:2px;display:grid;position:relative}.ntr-enum:before{content:\"\";width:calc((100% - 4px) / var(--enum-count));background:var(--queue-tint);box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--queue-green) 30%, transparent);transform:translateX(calc(var(--enum-index) * 100%));pointer-events:none;border-radius:2px;transition:transform .24s cubic-bezier(.2,0,0,1);position:absolute;inset:2px auto 2px 2px}.ntr-enum button{min-width:0;min-height:26px;color:var(--queue-muted);border:0;padding:3px 4px;transition:color .18s;position:relative}.ntr-enum button:hover{color:var(--queue-text)}.ntr-enum button[aria-checked=true],.ntr-enum button[aria-pressed=true]{color:var(--queue-green)}.module-tabs{flex:1;max-width:440px}.module-tabs button[data-enabled=true]:after{content:\" ●\";color:var(--queue-green);font-size:9px}.primary.danger{color:var(--queue-error);border-color:var(--queue-error);background:var(--queue-error-bg)}.ntr-setting-row[data-type=boolean]{flex-direction:row-reverse;justify-content:flex-end;align-self:end;align-items:center;min-height:32px}.ntr-setting-row input[type=checkbox]{accent-color:var(--queue-green);width:16px;height:16px;margin:0 3px 0 0}.settings-note{color:var(--queue-muted);margin-top:12px;font-size:11px}.feedback{border-top:1px solid var(--queue-line);color:var(--queue-green);background:var(--queue-tint);overflow-wrap:anywhere;padding:9px 13px;font-size:12px}.feedback[data-status=failed]{color:var(--queue-error);background:var(--queue-error-bg)}.feedback[data-status=partial]{color:var(--queue-warning);background:var(--queue-warning-bg)}@container (width<=660px){:host([data-workspace=true]) .bar{flex-wrap:wrap}.module-tabs{flex-basis:100%;order:1;max-width:none}.summary{display:none}.bar{gap:8px}}@container (width<=480px){.title>span:first-child{display:none}.bar{gap:6px;padding:7px 8px}.ntr-settings-container{grid-template-columns:repeat(2,minmax(0,1fr))}}@container (width<=300px){.title{display:none}.bar{flex-wrap:wrap}.engines button{padding-inline:6px}button{padding-inline:7px}.ntr-settings-container{grid-template-columns:minmax(0,1fr)}}@media (pointer:coarse){.bar{flex-wrap:wrap}button,.engines button,.ntr-enum button{min-height:40px}.ntr-setting-row input:not([type=checkbox]),.ntr-setting-row select{min-height:40px;font-size:16px}}@media (prefers-reduced-motion:reduce){.engines:before,.engines button,.ntr-enum:before,.ntr-enum button,.disclosure,.chevron{transition:none}}";
	var EmbeddedToolboxView = class {
		registry;
		runner;
		settings;
		notifications;
		site;
		host = document.createElement("div");
		shadow = this.host.attachShadow({ mode: "open" });
		lifetime = new AbortController();
		forms = new Map();
		formElements = new Map();
		engines = new Map();
		choices = document.createElement("div");
		note = document.createElement("div");
		modules = [];
		toggle = document.createElement("button");
		execute = document.createElement("button");
		disclosure = document.createElement("div");
		summary = document.createElement("span");
		feedback = document.createElement("div");
		layoutObserver = new MutationObserver((records) => {
			if (!this.host.isConnected || records.some((record) => record.target === this.parent && [...record.addedNodes, ...record.removedNodes].some((node) => node !== this.host))) this.schedulePlacement();
		});
		themeObserver = new MutationObserver(() => this.syncTheme());
		selected = "queue-sakura";
		expanded = false;
		parent = null;
		before = null;
		frame = null;
		unsubscribe = null;
		generation = 0;
		constructor(registry, runner, settings, notifications, site) {
			this.registry = registry;
			this.runner = runner;
			this.settings = settings;
			this.notifications = notifications;
			this.site = site;
		}
		mount() {
			this.modules = this.registry.modules.filter((module) => module.supports(location.pathname));
			if (!this.modules.length) return;
			this.selected = this.modules[0].id;
			this.host.id = "ntr-web-novel";
			this.host.dataset.ntrRoot = "";
			this.host.dataset.workspace = String(pageKind(location.pathname) === "workspace");
			const style = document.createElement("style");
			style.textContent = web_novel_default;
			const toolbar = document.createElement("section");
			toolbar.className = "toolbar";
			toolbar.setAttribute("aria-label", this.isQueue() ? "批量排隊" : "工作區工具");
			const bar = document.createElement("div");
			bar.className = "bar";
			const title = document.createElement("div");
			title.className = "title";
			const titleText = document.createElement("span");
			titleText.textContent = this.isQueue() ? "批量排隊" : "工作區工具";
			const badge = document.createElement("span");
			badge.className = "badge";
			badge.textContent = "NTR";
			title.append(titleText, badge);
			const engines = this.choices;
			engines.className = this.isQueue() ? "engines" : "ntr-enum module-tabs";
			engines.style.setProperty("--enum-count", String(this.modules.length));
			engines.setAttribute("role", "group");
			engines.setAttribute("aria-label", this.isQueue() ? "目標翻譯器" : "工具功能");
			for (const { id: kind } of this.modules) {
				const button = document.createElement("button");
				button.type = "button";
				button.textContent = this.engineName(kind);
				button.addEventListener("click", () => this.select(kind), { signal: this.lifetime.signal });
				this.engines.set(kind, button);
				engines.append(button);
			}
			this.summary.className = "summary";
			this.toggle.type = "button";
			this.toggle.className = "settings-toggle";
			this.toggle.innerHTML = "<span>設定</span><svg class=\"chevron\" viewBox=\"0 0 16 16\" aria-hidden=\"true\" focusable=\"false\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 6 8 10 12 6\"/></svg>";
			this.toggle.setAttribute("aria-controls", "queue-settings");
			this.toggle.addEventListener("click", () => this.setExpanded(!this.expanded), { signal: this.lifetime.signal });
			this.execute.type = "button";
			this.execute.className = "primary";
			this.execute.textContent = "加入佇列";
			this.execute.addEventListener("click", () => void this.runSelected(), { signal: this.lifetime.signal });
			bar.append(title, engines, this.summary, this.toggle, this.execute);
			this.disclosure.id = "queue-settings";
			this.disclosure.className = "disclosure";
			this.disclosure.setAttribute("role", "region");
			this.disclosure.setAttribute("aria-label", this.isQueue() ? "排隊設定" : "工具設定");
			const inner = document.createElement("div");
			inner.className = "disclosure-inner";
			const content = document.createElement("div");
			content.className = "settings-content";
			for (const { id: kind, settings } of this.modules) {
				const form = new SettingsForm(() => {
					this.settings.save(this.registry.modules);
					this.updateState();
				}, this.notifications, "segments");
				const element = form.render(settings);
				element.setAttribute("aria-label", `${this.engineName(kind)} 設定`);
				this.forms.set(kind, form);
				this.formElements.set(kind, element);
				content.append(element);
			}
			const note = this.note;
			note.className = "settings-note";
			content.append(note);
			inner.append(content);
			this.disclosure.append(inner);
			this.feedback.className = "feedback";
			this.feedback.hidden = true;
			this.feedback.setAttribute("role", "status");
			this.feedback.setAttribute("aria-live", "polite");
			toolbar.append(bar, this.disclosure, this.feedback);
			this.shadow.append(style, toolbar);
			this.unsubscribe = this.runner.subscribe(() => this.updateState());
			this.select(this.selected);
			this.setExpanded(false);
			this.place();
			this.layoutObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
		}
		updateVisibility() {
			this.generation++;
			this.feedback.hidden = true;
			this.forms.forEach((form) => form.refreshVisibility());
			this.place();
			this.updateState();
		}
		dispose() {
			this.generation++;
			this.lifetime.abort();
			this.unsubscribe?.();
			this.layoutObserver.disconnect();
			this.themeObserver.disconnect();
			if (this.frame !== null) cancelAnimationFrame(this.frame);
			this.forms.forEach((form) => form.dispose());
			this.host.remove();
		}
		select(kind) {
			this.generation++;
			this.forms.forEach((form) => form.cancelCapture());
			this.selected = kind;
			this.host.dataset.engine = kind === "queue-gpt" ? "gpt" : "sakura";
			this.choices.style.setProperty("--enum-index", String(this.modules.findIndex((module) => module.id === kind)));
			this.feedback.hidden = true;
			this.formElements.forEach((element, engine) => {
				element.hidden = engine !== kind;
			});
			this.updateState();
		}
		setExpanded(expanded) {
			if (!expanded) {
				this.forms.forEach((form) => form.cancelCapture());
				if (this.disclosure.contains(this.shadow.activeElement)) this.toggle.focus();
			}
			this.expanded = expanded;
			this.disclosure.classList.toggle("expanded", expanded);
			this.disclosure.setAttribute("aria-hidden", String(!expanded));
			this.toggle.setAttribute("aria-expanded", String(expanded));
			this.updateState();
		}
		updateState() {
			const module = this.registry.get(this.selected);
			const busy = this.isQueue() ? this.modules.some((item) => this.runner.isRunning(item)) : module.kind === "command" && this.runner.isRunning(module);
			this.engines.forEach((button, kind) => {
				button.setAttribute("aria-pressed", String(kind === this.selected));
				button.disabled = this.isQueue() && busy;
				button.dataset.enabled = String(this.runner.isEnabled(this.registry.get(kind)));
			});
			this.execute.disabled = busy;
			const active = module.kind === "continuous" && this.runner.isEnabled(module);
			this.execute.textContent = busy ? "執行中…" : this.isQueue() ? "加入佇列" : module.kind === "continuous" ? active ? "停止自動重試" : "啟用自動重試" : module.name;
			this.execute.setAttribute("aria-label", this.isQueue() ? `加入 ${this.engineName(this.selected)} 佇列` : this.execute.textContent);
			this.execute.setAttribute("aria-busy", String(busy));
			this.disclosure.inert = !this.expanded || busy;
			if (module.kind === "continuous") this.execute.setAttribute("aria-pressed", String(active));
			else this.execute.removeAttribute("aria-pressed");
			this.execute.classList.toggle("danger", module.id === "delete-translators");
			this.summary.textContent = this.isQueue() ? this.queueSummary(module) : this.modules.some((item) => item.kind === "continuous" && this.runner.isEnabled(item)) ? "自動重試已啟用" : "";
			this.note.textContent = this.isQueue() ? "套用目前頁面範圍 · 設定自動儲存 · 僅加入佇列" : module.id === "delete-translators" ? "刪除目前工作區的翻譯器，保留名稱符合「排除」的項目。" : "套用目前工作區 · 設定自動儲存";
			this.execute.title = this.isQueue() ? `${this.engineName(this.selected)} · ${this.summary.textContent} · 僅加入佇列` : this.execute.textContent;
		}
		async runSelected() {
			const module = this.registry.get(this.selected);
			if (module.kind === "continuous" && this.runner.isEnabled(module)) {
				this.runner.activate(module);
				return;
			}
			const invalid = [...this.formElements.get(this.selected)?.querySelectorAll("input") ?? []].find((input) => !input.closest("[hidden]") && !input.validity.valid);
			if (invalid) {
				this.setExpanded(true);
				invalid.reportValidity();
				return;
			}
			if (module.kind === "continuous") {
				this.runner.activate(module);
				return;
			}
			const generation = this.generation;
			this.feedback.dataset.status = "pending";
			this.feedback.textContent = this.isQueue() ? `正在加入 ${this.engineName(this.selected)} 佇列…` : `正在${module.name}…`;
			this.feedback.hidden = false;
			const result = await this.runner.run(module, false);
			if (this.lifetime.signal.aborted || generation !== this.generation) return;
			this.feedback.hidden = result.status === "cancelled" || !result.message;
			this.feedback.textContent = result.message;
			this.feedback.dataset.status = result.status;
		}
		schedulePlacement() {
			if (this.frame !== null || this.lifetime.signal.aborted) return;
			this.frame = requestAnimationFrame(() => {
				this.frame = null;
				if (!this.lifetime.signal.aborted) this.place();
			});
		}
		place() {
			if (!this.modules.some((module) => module.supports(location.pathname))) return;
			const point = this.site.toolboxMountPoint();
			if (!point) return;
			const changed = point.parent !== this.parent || point.before !== this.before;
			if (changed || !this.host.isConnected || this.host.nextElementSibling !== point.before) point.parent.insertBefore(this.host, point.before);
			if (changed) {
				this.parent = point.parent;
				this.before = point.before;
				this.themeObserver.disconnect();
				for (let element = this.parent; element; element = element.parentElement) this.themeObserver.observe(element, {
					attributes: true,
					attributeFilter: ["class", "style"]
				});
				if (this.before) this.themeObserver.observe(this.before, {
					attributes: true,
					attributeFilter: ["class", "style"]
				});
			}
			this.syncTheme();
		}
		syncTheme() {
			if (!this.parent?.isConnected) return;
			const channels = (getComputedStyle(this.parent).getPropertyValue("--n-color").trim() || getComputedStyle(document.body).backgroundColor).match(/[\d.]+/g)?.map(Number);
			const dark = channels && channels.length >= 3 && channels[3] !== 0 ? channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 < 128 : matchMedia("(prefers-color-scheme: dark)").matches;
			this.host.style.colorScheme = dark ? "dark" : "light";
			this.host.dataset.theme = dark ? "dark" : "light";
		}
		isQueue() {
			return this.selected.startsWith("queue-");
		}
		queueSummary(module) {
			const page = pageKind(location.pathname);
			const scope = page === "novels" ? `前 ${numberValue(module.settings, "單次擷取web數量(可破限)")} 本` : page === "wenkus" ? `前 ${numberValue(module.settings, "擷取單頁wenku數量(deving)")} 本` : page.startsWith("favorite-") ? "目前收藏夾" : "目前小說";
			const split = [
				"novels",
				"novel",
				"favorite-web"
			].includes(page) ? ` · ${stringValue(module.settings, "分段")}` : "";
			return `${scope} · ${stringValue(module.settings, "模式")}${split}`;
		}
		engineName(kind) {
			if (kind === "queue-sakura") return "Sakura";
			if (kind === "queue-gpt") return "GPT";
			return kind.startsWith("add-") ? "新增翻譯器" : this.registry.get(kind).name;
		}
	};
	var PageView = class {
		registry;
		runner;
		settings;
		notifications;
		site;
		view = null;
		page = "";
		constructor(registry, runner, settings, notifications, site) {
			this.registry = registry;
			this.runner = runner;
			this.settings = settings;
			this.notifications = notifications;
			this.site = site;
		}
		mount() {
			this.updateVisibility();
		}
		updateVisibility() {
			const page = `${pageKind(location.pathname)}:${workspaceKind(location.pathname) ?? ""}`;
			if (this.view && page === this.page) {
				this.view.updateVisibility();
				return;
			}
			this.view?.dispose();
			this.page = page;
			this.view = queueSupported(location.pathname) || workspaceKind(location.pathname) ? new EmbeddedToolboxView(this.registry, this.runner, this.settings, this.notifications, this.site) : null;
			this.view?.mount();
		}
		dispose() {
			this.view?.dispose();
			this.view = null;
		}
	};
	_css("#ntr-panel{z-index:9999;box-sizing:border-box;color:#ddd;background:#1e1e1e;border:1px solid #444;border-radius:8px;width:340px;max-width:calc(100vw - 24px);padding:8px;font:14px/1.5 Arial,sans-serif;position:fixed;top:70px;left:20px;box-shadow:0 3px 14px #0005}#ntr-panel [hidden]{display:none!important}#ntr-panel button,#ntr-panel input,#ntr-panel select{font:inherit;box-sizing:border-box}#ntr-panel button,#ntr-panel input:not([type=checkbox]),#ntr-panel select{color:#eee;background:#2a2a2a;border:1px solid #555;border-radius:4px;padding:4px 6px}#ntr-panel button{cursor:pointer}#ntr-panel button:disabled{opacity:.65;cursor:progress}#ntr-panel button:focus-visible,#ntr-panel input:focus-visible,#ntr-panel select:focus-visible{outline:2px solid #63e2b7}#ntr-panel.minimized{width:230px}#ntr-panel .ntr-titlebar{cursor:move;-webkit-user-select:none;user-select:none;touch-action:none;background:#292929;border-radius:4px;justify-content:space-between;align-items:center;gap:8px;padding:8px;font-weight:700;display:flex}#ntr-panel .ntr-panel-body{max-height:calc(100dvh - 150px);margin-top:8px;overflow-y:auto}#ntr-panel .ntr-module-container{border:1px solid #444;border-radius:4px;margin-bottom:8px}#ntr-panel .ntr-module-header{background:#2e2e2e;gap:4px;padding:4px;display:flex}#ntr-panel .ntr-module-action{text-align:left;flex:1}#ntr-panel .ntr-module-action.active{color:#111;background:#63e2b7}#ntr-panel .ntr-settings-container{padding:8px}#ntr-panel .ntr-setting-row{grid-template-columns:minmax(0,1fr) 120px;align-items:center;gap:8px;margin:6px 0;display:grid}#ntr-panel .ntr-setting-row>span{overflow-wrap:anywhere}#ntr-panel .ntr-setting-row>small{color:#aaa;grid-column:1/-1}#ntr-panel .ntr-setting-row input:not([type=checkbox]),#ntr-panel .ntr-setting-row select{width:100%;min-width:0}#ntr-panel .ntr-info{color:#aaa;padding-top:4px;font-size:11px}.ntr-notification-container{z-index:10000;pointer-events:none;width:min(500px,100vw - 24px);position:fixed;top:16px;left:50%;transform:translate(-50%)}.ntr-notification-message{color:#eee;overflow-wrap:anywhere;background:#292929;border:1px solid #666;border-radius:6px;margin-bottom:8px;padding:10px 14px;font:14px/1.5 Arial,sans-serif;box-shadow:0 3px 14px #0005}.ntr-notification-message.failed{border-color:#d66}.ntr-notification-message.partial{border-color:#ca5}@media (pointer:coarse){#ntr-panel button{min-height:36px}#ntr-panel .ntr-setting-row{grid-template-columns:minmax(0,1fr) 110px}}");
	var runtime = window;
	if (allowedHost(location.hostname) && !runtime._NTRToolBoxInstance) {
		const settings = new SettingsService(localStorage);
		const workspace = new WorkspaceService(localStorage);
		const site = new SiteAdapter();
		const api = new ApiService(new AuthService(localStorage));
		const translators = new TranslatorService(site);
		const queue = new QueueService(api, workspace, site);
		const launch = new LaunchTranslatorModule(translators);
		const registry = new ModuleRegistry([
			new AddSakuraTranslatorModule(workspace),
			new AddGPTTranslatorModule(workspace),
			new DeleteTranslatorModule(workspace),
			launch,
			new QueueSakuraModule(queue),
			new QueueGPTModule(queue),
			new AutoRetryModule(site, translators, launch.settings, workspace)
		]);
		const notifications = new NotificationView();
		const runner = new ModuleRunner(registry, settings, notifications);
		const app = new ToolboxApp(registry, runner, settings, workspace, new PageView(registry, runner, settings, notifications, site), new KeyboardBindings(registry, runner), notifications);
		try {
			app.start();
			runtime._NTRToolBoxInstance = true;
			runtime._NoveliaToolBoxApp = app;
		} catch (error) {
			app.dispose();
			notifications.error(error);
		}
	}
})();

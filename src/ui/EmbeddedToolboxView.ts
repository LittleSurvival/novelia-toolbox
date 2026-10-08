import type { ToolboxView } from '../interfaces/ToolboxView';
import type { ModuleId } from '../types/ModuleId';
import type { ToolboxModule } from '../interfaces/ToolboxModule';
import { ModuleRegistry } from '../core/ModuleRegistry';
import { ModuleRunner } from '../core/ModuleRunner';
import { SettingsService } from '../services/SettingsService';
import { SiteAdapter } from '../services/SiteAdapter';
import { numberValue, stringValue } from '../util/settings';
import { pageKind } from '../util/routes';
import { NotificationView } from './NotificationView';
import { SettingsForm } from './SettingsForm';
import styles from '../styles/web-novel.css?inline';

export class EmbeddedToolboxView implements ToolboxView {
    private readonly host = document.createElement('div');
    private readonly shadow = this.host.attachShadow({ mode: 'open' });
    private readonly lifetime = new AbortController();
    private readonly forms = new Map<ModuleId, SettingsForm>();
    private readonly formElements = new Map<ModuleId, HTMLDivElement>();
    private readonly engines = new Map<ModuleId, HTMLButtonElement>();
    private readonly choices = document.createElement('div');
    private readonly note = document.createElement('div');
    private modules: ToolboxModule[] = [];
    private readonly toggle = document.createElement('button');
    private readonly execute = document.createElement('button');
    private readonly disclosure = document.createElement('div');
    private readonly summary = document.createElement('span');
    private readonly feedback = document.createElement('div');
    private readonly layoutObserver = new MutationObserver((records) => {
        if (
            !this.host.isConnected ||
            records.some(
                (record) =>
                    record.target === this.parent &&
                    [...record.addedNodes, ...record.removedNodes].some(
                        (node) => node !== this.host,
                    ),
            )
        ) {
            this.schedulePlacement();
        }
    });
    private readonly themeObserver = new MutationObserver(() => this.syncTheme());
    private selected: ModuleId = 'queue-sakura';
    private expanded = false;
    private parent: HTMLElement | null = null;
    private before: Element | null = null;
    private frame: number | null = null;
    private unsubscribe: (() => void) | null = null;
    private generation = 0;

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly runner: ModuleRunner,
        private readonly settings: SettingsService,
        private readonly notifications: NotificationView,
        private readonly site: SiteAdapter,
    ) {}

    mount(): void {
        this.modules = this.registry.modules.filter((module) =>
            module.supports(location.pathname),
        );
        if (!this.modules.length) return;
        this.selected = this.modules[0]!.id;
        this.host.id = 'ntr-web-novel';
        this.host.dataset.ntrRoot = '';
        this.host.dataset.workspace = String(pageKind(location.pathname) === 'workspace');
        const style = document.createElement('style');
        style.textContent = styles;
        const toolbar = document.createElement('section');
        toolbar.className = 'toolbar';
        toolbar.setAttribute('aria-label', this.isQueue() ? '批量排隊' : '工作區工具');
        const bar = document.createElement('div');
        bar.className = 'bar';
        const title = document.createElement('div');
        title.className = 'title';
        const titleText = document.createElement('span');
        titleText.textContent = this.isQueue() ? '批量排隊' : '工作區工具';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'NTR';
        title.append(titleText, badge);
        const engines = this.choices;
        engines.className = this.isQueue() ? 'engines' : 'ntr-enum module-tabs';
        engines.style.setProperty('--enum-count', String(this.modules.length));
        engines.setAttribute('role', 'group');
        engines.setAttribute('aria-label', this.isQueue() ? '目標翻譯器' : '工具功能');
        for (const { id: kind } of this.modules) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = this.engineName(kind);
            button.addEventListener('click', () => this.select(kind), {
                signal: this.lifetime.signal,
            });
            this.engines.set(kind, button);
            engines.append(button);
        }
        this.summary.className = 'summary';
        this.toggle.type = 'button';
        this.toggle.className = 'settings-toggle';
        this.toggle.innerHTML =
            '<span>設定</span><svg class="chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6 8 10 12 6"/></svg>';
        this.toggle.setAttribute('aria-controls', 'queue-settings');
        this.toggle.addEventListener('click', () => this.setExpanded(!this.expanded), {
            signal: this.lifetime.signal,
        });
        this.execute.type = 'button';
        this.execute.className = 'primary';
        this.execute.textContent = '加入佇列';
        this.execute.addEventListener('click', () => void this.runSelected(), {
            signal: this.lifetime.signal,
        });
        bar.append(title, engines, this.summary, this.toggle, this.execute);

        this.disclosure.id = 'queue-settings';
        this.disclosure.className = 'disclosure';
        this.disclosure.setAttribute('role', 'region');
        this.disclosure.setAttribute(
            'aria-label',
            this.isQueue() ? '排隊設定' : '工具設定',
        );
        const inner = document.createElement('div');
        inner.className = 'disclosure-inner';
        const content = document.createElement('div');
        content.className = 'settings-content';
        for (const { id: kind, settings } of this.modules) {
            const form = new SettingsForm(
                () => {
                    this.settings.save(this.registry.modules);
                    this.updateState();
                },
                this.notifications,
                'segments',
            );
            const element = form.render(settings);
            element.setAttribute('aria-label', `${this.engineName(kind)} 設定`);
            this.forms.set(kind, form);
            this.formElements.set(kind, element);
            content.append(element);
        }
        const note = this.note;
        note.className = 'settings-note';
        content.append(note);
        inner.append(content);
        this.disclosure.append(inner);
        this.feedback.className = 'feedback';
        this.feedback.hidden = true;
        this.feedback.setAttribute('role', 'status');
        this.feedback.setAttribute('aria-live', 'polite');
        toolbar.append(bar, this.disclosure, this.feedback);
        this.shadow.append(style, toolbar);
        this.unsubscribe = this.runner.subscribe(() => this.updateState());
        this.select(this.selected);
        this.setExpanded(false);
        this.place();
        // Observe only child changes. Shadow content never feeds back into this observer.
        this.layoutObserver.observe(document.body, { childList: true, subtree: true });
    }

    updateVisibility(): void {
        this.generation++;
        this.feedback.hidden = true;
        this.forms.forEach((form) => form.refreshVisibility());
        this.place();
        this.updateState();
    }

    dispose(): void {
        this.generation++;
        this.lifetime.abort();
        this.unsubscribe?.();
        this.layoutObserver.disconnect();
        this.themeObserver.disconnect();
        if (this.frame !== null) {
            cancelAnimationFrame(this.frame);
        }
        this.forms.forEach((form) => form.dispose());
        this.host.remove();
    }

    private select(kind: ModuleId): void {
        this.generation++;
        this.forms.forEach((form) => form.cancelCapture());
        this.selected = kind;
        this.host.dataset.engine = kind === 'queue-gpt' ? 'gpt' : 'sakura';
        this.choices.style.setProperty(
            '--enum-index',
            String(this.modules.findIndex((module) => module.id === kind)),
        );
        this.feedback.hidden = true;
        this.formElements.forEach((element, engine) => {
            element.hidden = engine !== kind;
        });
        this.updateState();
    }

    private setExpanded(expanded: boolean): void {
        if (!expanded) {
            this.forms.forEach((form) => form.cancelCapture());
            if (this.disclosure.contains(this.shadow.activeElement)) {
                this.toggle.focus();
            }
        }
        this.expanded = expanded;
        this.disclosure.classList.toggle('expanded', expanded);
        this.disclosure.setAttribute('aria-hidden', String(!expanded));
        this.toggle.setAttribute('aria-expanded', String(expanded));
        this.updateState();
    }

    private updateState(): void {
        const module = this.registry.get(this.selected);
        const busy = this.isQueue()
            ? this.modules.some((item) => this.runner.isRunning(item))
            : module.kind === 'command' && this.runner.isRunning(module);
        this.engines.forEach((button, kind) => {
            button.setAttribute('aria-pressed', String(kind === this.selected));
            button.disabled = this.isQueue() && busy;
            button.dataset.enabled = String(
                this.runner.isEnabled(this.registry.get(kind)),
            );
        });
        this.execute.disabled = busy;
        const active = module.kind === 'continuous' && this.runner.isEnabled(module);
        this.execute.textContent = busy
            ? '執行中…'
            : this.isQueue()
              ? '加入佇列'
              : module.kind === 'continuous'
                ? active
                    ? '停止自動重試'
                    : '啟用自動重試'
                : module.name;
        this.execute.setAttribute(
            'aria-label',
            this.isQueue()
                ? `加入 ${this.engineName(this.selected)} 佇列`
                : this.execute.textContent,
        );
        this.execute.setAttribute('aria-busy', String(busy));
        this.disclosure.inert = !this.expanded || busy;
        if (module.kind === 'continuous')
            this.execute.setAttribute('aria-pressed', String(active));
        else this.execute.removeAttribute('aria-pressed');
        this.execute.classList.toggle('danger', module.id === 'delete-translators');
        this.summary.textContent = this.isQueue()
            ? this.queueSummary(module)
            : this.modules.some(
                    (item) => item.kind === 'continuous' && this.runner.isEnabled(item),
                )
              ? '自動重試已啟用'
              : '';
        this.note.textContent = this.isQueue()
            ? '套用目前頁面範圍 · 設定自動儲存 · 僅加入佇列'
            : module.id === 'delete-translators'
              ? '刪除目前工作區的翻譯器，保留名稱符合「排除」的項目。'
              : '套用目前工作區 · 設定自動儲存';
        this.execute.title = this.isQueue()
            ? `${this.engineName(this.selected)} · ${this.summary.textContent} · 僅加入佇列`
            : this.execute.textContent;
    }

    private async runSelected(): Promise<void> {
        const module = this.registry.get(this.selected);
        if (module.kind === 'continuous' && this.runner.isEnabled(module)) {
            this.runner.activate(module);
            return;
        }
        const form = this.formElements.get(this.selected);
        const invalid = [...(form?.querySelectorAll('input') ?? [])].find(
            (input) => !input.closest('[hidden]') && !input.validity.valid,
        );
        if (invalid) {
            this.setExpanded(true);
            invalid.reportValidity();
            return;
        }
        if (module.kind === 'continuous') {
            this.runner.activate(module);
            return;
        }
        const generation = this.generation;
        this.feedback.dataset.status = 'pending';
        this.feedback.textContent = this.isQueue()
            ? `正在加入 ${this.engineName(this.selected)} 佇列…`
            : `正在${module.name}…`;
        this.feedback.hidden = false;
        const result = await this.runner.run(module, false);
        if (this.lifetime.signal.aborted || generation !== this.generation) {
            return;
        }
        this.feedback.hidden = result.status === 'cancelled' || !result.message;
        this.feedback.textContent = result.message;
        this.feedback.dataset.status = result.status;
    }

    private schedulePlacement(): void {
        if (this.frame !== null || this.lifetime.signal.aborted) {
            return;
        }
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            if (!this.lifetime.signal.aborted) {
                this.place();
            }
        });
    }

    private place(): void {
        if (!this.modules.some((module) => module.supports(location.pathname))) {
            return;
        }
        const point = this.site.toolboxMountPoint();
        if (!point) {
            return;
        }
        const changed = point.parent !== this.parent || point.before !== this.before;
        if (
            changed ||
            !this.host.isConnected ||
            this.host.nextElementSibling !== point.before
        ) {
            point.parent.insertBefore(this.host, point.before);
        }
        if (changed) {
            this.parent = point.parent;
            this.before = point.before;
            this.themeObserver.disconnect();
            // Watch the small ancestor chain, not all the site's class/style changes.
            for (
                let element: Element | null = this.parent;
                element;
                element = element.parentElement
            ) {
                this.themeObserver.observe(element, {
                    attributes: true,
                    attributeFilter: ['class', 'style'],
                });
            }
            if (this.before) {
                this.themeObserver.observe(this.before, {
                    attributes: true,
                    attributeFilter: ['class', 'style'],
                });
            }
        }
        this.syncTheme();
    }

    private syncTheme(): void {
        if (!this.parent?.isConnected) {
            return;
        }
        const background =
            getComputedStyle(this.parent).getPropertyValue('--n-color').trim() ||
            getComputedStyle(document.body).backgroundColor;
        const channels = background.match(/[\d.]+/g)?.map(Number);
        const dark =
            channels && channels.length >= 3 && channels[3] !== 0
                ? channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722 <
                  128
                : matchMedia('(prefers-color-scheme: dark)').matches;
        this.host.style.colorScheme = dark ? 'dark' : 'light';
        this.host.dataset.theme = dark ? 'dark' : 'light';
    }

    private isQueue(): boolean {
        return this.selected.startsWith('queue-');
    }

    private queueSummary(module: ToolboxModule): string {
        const page = pageKind(location.pathname);
        const scope =
            page === 'novels'
                ? `前 ${numberValue(module.settings, '單次擷取web數量(可破限)')} 本`
                : page === 'wenkus'
                  ? `前 ${numberValue(module.settings, '擷取單頁wenku數量(deving)')} 本`
                  : page.startsWith('favorite-')
                    ? '目前收藏夾'
                    : '目前小說';
        const split = ['novels', 'novel', 'favorite-web'].includes(page)
            ? ` · ${stringValue(module.settings, '分段')}`
            : '';
        return `${scope} · ${stringValue(module.settings, '模式')}${split}`;
    }

    private engineName(kind: ModuleId): string {
        if (kind === 'queue-sakura') return 'Sakura';
        if (kind === 'queue-gpt') return 'GPT';
        return kind.startsWith('add-') ? '新增翻譯器' : this.registry.get(kind).name;
    }
}

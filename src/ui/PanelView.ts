import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { ModuleId } from '../types/ModuleId';
import { ModuleRegistry } from '../core/ModuleRegistry';
import { ModuleRunner } from '../core/ModuleRunner';
import { SettingsService } from '../services/SettingsService';
import { SettingsForm } from './SettingsForm';
import { NotificationView } from './NotificationView';
import { DragHandler } from './DragHandler';

export class PanelView {
    private readonly panel = document.createElement('div');
    private readonly lifetime = new AbortController();
    private readonly rows = new Map<ModuleId, HTMLDivElement>();
    private readonly buttons = new Map<ModuleId, HTMLButtonElement>();
    private form: SettingsForm | null = null;
    private drag: DragHandler | null = null;
    private unsubscribe: (() => void) | null = null;
    private minimized = false;

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly runner: ModuleRunner,
        private readonly settings: SettingsService,
        private readonly notifications: NotificationView,
        private readonly version: string,
    ) {}

    mount(): void {
        this.panel.id = 'ntr-panel';
        this.panel.dataset.ntrRoot = '';
        this.panel.setAttribute('aria-label', 'NTR ToolBox');
        const position = this.settings.getPosition();
        if (position) {
            this.panel.style.left = position.left;
            this.panel.style.top = position.top;
        }
        const title = document.createElement('div');
        title.className = 'ntr-titlebar';
        const text = document.createElement('span');
        text.textContent = `NTR ToolBox v${this.version}`;
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.textContent = '−';
        toggle.setAttribute('aria-label', '縮小工具箱');
        title.append(text, toggle);
        const body = document.createElement('div');
        body.className = 'ntr-panel-body';
        this.form = new SettingsForm(
            () => this.settings.save(this.registry.modules),
            this.notifications,
        );
        this.registry.modules.forEach((module) => this.addModule(body, module));
        const info = document.createElement('div');
        info.className = 'ntr-info';
        const mobile =
            /Mobi|Android/i.test(navigator.userAgent) ||
            matchMedia('(pointer: coarse)').matches;
        info.textContent = `${mobile ? '點擊執行／⚙設定' : '左鍵執行／右鍵設定'} · TheNano`;
        this.panel.append(title, body, info);
        document.body.append(this.panel);
        this.drag = new DragHandler(this.panel, title, this.settings);
        const minimize = () => {
            if (this.drag?.clickAfterDrag()) {
                return;
            }
            this.minimized = !this.minimized;
            body.hidden = this.minimized;
            info.hidden = this.minimized;
            toggle.textContent = this.minimized ? '+' : '−';
            toggle.setAttribute(
                'aria-label',
                this.minimized ? '展開工具箱' : '縮小工具箱',
            );
            this.panel.classList.toggle('minimized', this.minimized);
            this.drag?.clamp();
        };
        title.addEventListener(
            'click',
            (event) => {
                if (
                    mobile ||
                    (event.target instanceof Element && event.target.closest('button'))
                ) {
                    minimize();
                }
            },
            { signal: this.lifetime.signal },
        );
        title.addEventListener(
            'contextmenu',
            (event) => {
                event.preventDefault();
                minimize();
            },
            { signal: this.lifetime.signal },
        );
        this.unsubscribe = this.runner.subscribe((module) => this.updateState(module));
        this.updateVisibility();
    }

    updateVisibility(): void {
        this.form?.refreshVisibility();
        for (const module of this.registry.modules) {
            const row = this.rows.get(module.id);
            if (row) {
                row.hidden = !module.supports(location.pathname);
            }
            this.updateState(module);
        }
        this.drag?.clamp();
    }

    dispose(): void {
        this.unsubscribe?.();
        this.lifetime.abort();
        this.form?.dispose();
        this.drag?.dispose();
        this.rows.clear();
        this.buttons.clear();
        this.panel.remove();
    }

    private addModule(body: HTMLElement, module: ToolboxModule): void {
        const row = document.createElement('div');
        row.className = 'ntr-module-container';
        const header = document.createElement('div');
        header.className = 'ntr-module-header';
        const execute = document.createElement('button');
        execute.type = 'button';
        execute.textContent = module.name;
        execute.className = 'ntr-module-action';
        execute.addEventListener('click', () => this.runner.activate(module), {
            signal: this.lifetime.signal,
        });
        const configuration = document.createElement('button');
        configuration.type = 'button';
        configuration.textContent = '⚙';
        configuration.setAttribute('aria-label', `${module.name} 設定`);
        configuration.setAttribute('aria-expanded', 'false');
        const form = this.form?.render(module.settings);
        const showSettings = () => {
            if (form) {
                form.hidden = !form.hidden;
                configuration.setAttribute('aria-expanded', String(!form.hidden));
            }
            this.drag?.clamp();
        };
        configuration.addEventListener('click', showSettings, {
            signal: this.lifetime.signal,
        });
        header.addEventListener(
            'contextmenu',
            (event) => {
                event.preventDefault();
                showSettings();
            },
            { signal: this.lifetime.signal },
        );
        header.append(execute, configuration);
        row.append(header);
        if (form) {
            row.append(form);
        }
        body.append(row);
        this.rows.set(module.id, row);
        this.buttons.set(module.id, execute);
    }

    private updateState(module: ToolboxModule): void {
        const button = this.buttons.get(module.id);
        if (!button) {
            return;
        }
        const active = this.runner.isEnabled(module);
        const busy = this.runner.isRunning(module);
        button.classList.toggle('active', active);
        button.disabled = module.kind === 'command' && busy;
        button.setAttribute('aria-busy', String(busy));
        if (module.kind === 'continuous') {
            button.setAttribute('aria-pressed', String(active));
        }
        button.textContent = `${module.name}${busy ? ' …' : module.kind === 'continuous' ? (active ? ' ⇋' : ' ⏸') : ' ▶'}`;
    }
}

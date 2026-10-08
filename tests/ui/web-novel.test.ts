import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModuleRegistry } from '../../src/core/ModuleRegistry';
import { ModuleRunner } from '../../src/core/ModuleRunner';
import { QueueGPTModule } from '../../src/modules/QueueGPTModule';
import { QueueSakuraModule } from '../../src/modules/QueueSakuraModule';
import { AddSakuraTranslatorModule } from '../../src/modules/AddSakuraTranslatorModule';
import { AddGPTTranslatorModule } from '../../src/modules/AddGPTTranslatorModule';
import { DeleteTranslatorModule } from '../../src/modules/DeleteTranslatorModule';
import { LaunchTranslatorModule } from '../../src/modules/LaunchTranslatorModule';
import { AutoRetryModule } from '../../src/modules/AutoRetryModule';
import { TranslatorService } from '../../src/services/TranslatorService';
import { ApiService } from '../../src/services/ApiService';
import { AuthService } from '../../src/services/AuthService';
import { QueueService } from '../../src/services/QueueService';
import { SettingsService } from '../../src/services/SettingsService';
import { SiteAdapter } from '../../src/services/SiteAdapter';
import { WorkspaceService } from '../../src/services/WorkspaceService';
import { NotificationView } from '../../src/ui/NotificationView';
import { PageView } from '../../src/ui/PageView';
import { EmbeddedToolboxView } from '../../src/ui/EmbeddedToolboxView';
import type { ToolboxView } from '../../src/interfaces/ToolboxView';
import type { RunResult } from '../../src/interfaces/RunResult';

const cleanups: (() => void)[] = [];
const page = () => {
    document.body.innerHTML =
        '<main style="--n-color: rgb(16, 16, 20)"><h1>网络小说</h1><div class="filters">篩選</div><div class="n-pagination">1</div><ul></ul><div class="n-pagination">2</div></main>';
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        setTimeout(() => callback(0), 0),
    );
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    history.replaceState(null, '', '/novel');
    page();
});

afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
});

function fixture(routed = false) {
    const site = new SiteAdapter();
    const settings = new SettingsService(localStorage);
    const queue = new QueueService(
        new ApiService(new AuthService(localStorage)),
        new WorkspaceService(localStorage),
        site,
    );
    const queued = vi
        .spyOn(queue, 'queue')
        .mockResolvedValue({ status: 'success', message: '新增 2 個任務／1 本小說' });
    const workspace = new WorkspaceService(localStorage);
    const translators = new TranslatorService(site);
    const launch = new LaunchTranslatorModule(translators);
    const registry = new ModuleRegistry([
        new QueueSakuraModule(queue),
        new QueueGPTModule(queue),
        new AddSakuraTranslatorModule(workspace),
        new AddGPTTranslatorModule(workspace),
        new DeleteTranslatorModule(workspace),
        launch,
        new AutoRetryModule(site, translators, launch.settings, workspace),
    ]);
    const notifications = new NotificationView();
    const runner = new ModuleRunner(registry, settings, notifications);
    const view: ToolboxView = routed
        ? new PageView(registry, runner, settings, notifications, site)
        : new EmbeddedToolboxView(registry, runner, settings, notifications, site);
    view.mount();
    cleanups.push(() => {
        view.dispose();
        runner.dispose();
        notifications.dispose();
    });
    const root = () => document.querySelector('#ntr-web-novel')!.shadowRoot!;
    const activeForm = () =>
        root().querySelector<HTMLDivElement>('.ntr-settings-container:not([hidden])')!;
    const input = (name: string) =>
        activeForm().querySelector<HTMLInputElement | HTMLSelectElement>(
            `[data-setting="${name}"] input, [data-setting="${name}"] select`,
        )!;
    const change = (name: string, value: string) => {
        const group = activeForm().querySelector(
            `[data-setting="${name}"] [role="radiogroup"]`,
        );
        if (group) {
            [...group.querySelectorAll<HTMLButtonElement>('button')]
                .find((button) => button.textContent === value)!
                .click();
            return;
        }
        const field = input(name);
        field.value = value;
        field.dispatchEvent(
            new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
        );
    };
    return { view, root, activeForm, input, change, queued, registry };
}

it('mounts above the first pagination with settings collapsed and restores the native theme', () => {
    const { root } = fixture();
    const host = document.querySelector<HTMLElement>('#ntr-web-novel')!;
    expect(host.nextElementSibling).toBe(document.querySelector('.n-pagination'));
    expect(host.style.colorScheme).toBe('dark');
    expect(host.dataset.theme).toBe('dark');
    expect(root().querySelector('.settings-toggle')?.getAttribute('aria-expanded')).toBe(
        'false',
    );
    expect(root().querySelector<HTMLElement>('.disclosure')?.inert).toBe(true);
    const toggle = root().querySelector<HTMLButtonElement>('.settings-toggle')!;
    toggle.click();
    toggle.click();
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(root().querySelector<HTMLElement>('.disclosure')?.inert).toBe(false);
});

it('updates the explicit shadow palette when the site theme changes', async () => {
    fixture();
    const host = document.querySelector<HTMLElement>('#ntr-web-novel')!;
    document
        .querySelector<HTMLElement>('main')!
        .style.setProperty('--n-color', 'rgb(255, 255, 255)');
    await vi.runAllTimersAsync();
    expect(host.dataset.theme).toBe('light');
    expect(host.style.colorScheme).toBe('light');
});

it('shows only relevant web/split settings and keeps independent translator values', () => {
    const { root, activeForm, change, input } = fixture();
    const hidden = (name: string) =>
        activeForm().querySelector<HTMLElement>(`[data-setting="${name}"]`)!.hidden;
    expect(hidden('擷取單頁wenku數量(deving)')).toBe(true);
    expect(hidden('使用瀏覽器爬蟲')).toBe(true);
    expect(hidden('固定均分任務')).toBe(true);
    change('分段', '固定');
    change('固定均分任務', '8');
    change('單次擷取web數量(可破限)', '45');
    expect(hidden('固定均分任務')).toBe(false);
    expect(hidden('智能均分任務上限')).toBe(true);
    const buttons = root().querySelectorAll<HTMLButtonElement>('.engines button');
    buttons[1]!.click();
    expect(
        activeForm().querySelector('[data-setting="分段"] [aria-checked="true"]')
            ?.textContent,
    ).toBe('智能');
    expect(input('單次擷取web數量(可破限)').value).toBe('20');
    buttons[0]!.click();
    expect(input('固定均分任務').value).toBe('8');
    expect(input('單次擷取web數量(可破限)').value).toBe('45');
    expect(localStorage.getItem('NTR_ToolBox_Config')).toContain('45');
});

it('passes edited settings to the selected queue and displays the real result', async () => {
    const { root, change, queued } = fixture();
    root().querySelectorAll<HTMLButtonElement>('.engines button')[1]!.click();
    change('單次擷取web數量(可破限)', '32');
    change('分段', '固定');
    change('固定均分任務', '4');
    root().querySelector<HTMLButtonElement>('.primary')!.click();
    expect(queued).toHaveBeenCalledWith(
        'gpt',
        expect.objectContaining({ webLimit: 32, split: 'static', parts: 4 }),
        expect.any(AbortSignal),
    );
    await vi.runAllTimersAsync();
    expect(root().querySelector('.feedback')?.textContent).toBe(
        '新增 2 個任務／1 本小說',
    );
});

it('blocks duplicate submissions and suppresses stale feedback after a route change', async () => {
    const { root, view, queued } = fixture();
    let finish!: (value: RunResult) => void;
    queued.mockImplementation(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    const action = root().querySelector<HTMLButtonElement>('.primary')!;
    action.click();
    action.click();
    expect(queued).toHaveBeenCalledTimes(1);
    expect(action.disabled).toBe(true);
    history.replaceState(null, '', '/novel?query=next');
    view.updateVisibility();
    finish({ status: 'success', message: 'old result' });
    await vi.runAllTimersAsync();
    expect(root().querySelector<HTMLElement>('.feedback')!.hidden).toBe(true);
});

it('remounts the same controls after a page rerender without duplicates or lost edits', async () => {
    const { root, input, change, view } = fixture();
    const originalRoot = root();
    change('單次擷取web數量(可破限)', '60');
    page();
    await vi.runAllTimersAsync();
    expect(document.querySelectorAll('#ntr-web-novel')).toHaveLength(1);
    expect(root()).toBe(originalRoot);
    expect(input('單次擷取web數量(可破限)').value).toBe('60');
    view.dispose();
    page();
    await vi.runAllTimersAsync();
    expect(document.querySelector('#ntr-web-novel')).toBeNull();
});

it('waits for async page content and repositions when pagination is added', async () => {
    document.body.replaceChildren();
    const { root } = fixture();
    expect(document.querySelector('#ntr-web-novel')).toBeNull();
    document.body.innerHTML = '<main><h1>网络小说</h1><div>篩選</div></main>';
    await vi.runAllTimersAsync();
    expect(root()).toBeTruthy();
    const pagination = document.createElement('div');
    pagination.className = 'n-pagination';
    document.querySelector('main')!.append(pagination);
    await vi.runAllTimersAsync();
    expect(document.querySelector('#ntr-web-novel')!.nextElementSibling).toBe(pagination);
});

it('uses the embedded toolbar across routes and removes it on unsupported pages', () => {
    const { view, root } = fixture(true);
    history.replaceState(null, '', '/wenku');
    view.updateVisibility();
    expect(document.querySelector('#ntr-web-novel')).not.toBeNull();
    expect(document.querySelector('#ntr-panel')).toBeNull();
    expect(root().querySelector('.summary')?.textContent).toBe('前 20 本 · 常規');
    history.replaceState(null, '', '/setting');
    view.updateVisibility();
    expect(document.querySelector('#ntr-web-novel')).toBeNull();
    history.replaceState(null, '', '/novel');
    view.updateVisibility();
    expect(document.querySelector('#ntr-panel')).toBeNull();
    expect(root().querySelector('.settings-toggle')!.getAttribute('aria-expanded')).toBe(
        'false',
    );
});

it('supports keyboard enum selection and uses the chosen mode when queuing', async () => {
    const { root, activeForm, queued } = fixture();
    root().querySelector<HTMLButtonElement>('.settings-toggle')!.click();
    const group = activeForm().querySelector('[aria-label="翻譯模式"]')!;
    const first = group.querySelector<HTMLButtonElement>('[role="radio"]')!;
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(group.querySelector('[aria-checked="true"]')?.textContent).toBe('重翻');
    expect(group.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(root().activeElement?.textContent).toBe('重翻');
    root().querySelector<HTMLButtonElement>('.primary')!.click();
    expect(queued).toHaveBeenCalledWith(
        'sakura',
        expect.objectContaining({ mode: 'all' }),
        expect.any(AbortSignal),
    );
    await vi.runAllTimersAsync();
});

it.each(['/novel/a/b', '/wenku/id', '/favorite/web/all', '/favorite/wenku/default'])(
    'mounts queue controls on %s',
    (path) => {
        history.replaceState(null, '', path);
        if (path.includes('/id') || path.includes('/a/b'))
            document.querySelector('h1')!.outerHTML = '<h2>小說標題</h2>';
        if (path.includes('/a/b')) {
            const metadata = document.createElement('div');
            metadata.className = 'metadata-stat';
            document.querySelector('main')!.append(metadata);
            const comments = document.createElement('h2');
            comments.textContent = '評論';
            document.querySelector('main')!.append(comments);
        }
        const { root } = fixture();
        expect(root().querySelectorAll('.engines button')).toHaveLength(2);
        expect(root().querySelectorAll('select')).toHaveLength(0);
    },
);

it('places web detail controls after workspace/logs and before comments, inside the content column', async () => {
    history.replaceState(null, '', '/novel/kakuyomu/example');
    document.body.innerHTML =
        '<main class="layout-content"><div class="n-flex"><div id="novel-content"><div><h3>小說標題</h3></div><div class="metadata-stat">總計 250</div><p>簡介</p><div id="workspace"><button>导入工作区</button></div><div id="logs">工作區日誌</div><div id="comments"><h2>评论</h2><button>发表评论</button></div></div><div id="toc"><div style="position:fixed;top:50px;width:320px"><h2>目錄</h2></div></div></div></main>';
    const { root, view } = fixture();
    const host = document.querySelector('#ntr-web-novel')!;
    expect(host.parentElement?.id).toBe('novel-content');
    expect(host.previousElementSibling?.id).toBe('logs');
    expect(host.nextElementSibling?.id).toBe('comments');
    expect(document.querySelector('#toc')!.contains(host)).toBe(false);
    root().querySelector<HTMLButtonElement>('.settings-toggle')!.click();
    const metadata = document.querySelector('.metadata-stat')!;
    metadata.after(document.createElement('p'));
    await vi.runAllTimersAsync();
    expect(document.querySelectorAll('#ntr-web-novel')).toHaveLength(1);
    expect(host.parentElement?.id).toBe('novel-content');
    expect(host.nextElementSibling?.id).toBe('comments');
    view.updateVisibility();
    expect(root().querySelector('.settings-toggle')?.getAttribute('aria-expanded')).toBe(
        'true',
    );
});

it('uses the workspace anchor until the comments section arrives', async () => {
    history.replaceState(null, '', '/novel/kakuyomu/example');
    document.body.innerHTML =
        '<main><h3>小說標題</h3><div class="metadata-stat"></div><div id="workspace"><button>導入工作區</button></div></main>';
    const { root } = fixture();
    const host = document.querySelector('#ntr-web-novel')!;
    expect(host.previousElementSibling?.id).toBe('workspace');
    root().querySelector<HTMLButtonElement>('.settings-toggle')!.click();
    const comments = document.createElement('section');
    comments.innerHTML = '<h2>評論</h2>';
    document.querySelector('main')!.append(comments);
    await vi.runAllTimersAsync();
    expect(host.nextElementSibling).toBe(comments);
    expect(root().querySelector('.settings-toggle')?.getAttribute('aria-expanded')).toBe(
        'true',
    );
    expect(document.querySelectorAll('#ntr-web-novel')).toHaveLength(1);
});

it('switches workspace tools, preserves settings, and can stop an active continuous tool', async () => {
    history.replaceState(null, '', '/workspace/sakura');
    const { root, registry, view, change, input } = fixture(true);
    const auto = registry.get('auto-retry');
    vi.spyOn(auto, 'execute').mockResolvedValue({ status: 'success', message: '' });
    expect(root().querySelectorAll('.module-tabs button')).toHaveLength(4);
    change('數量', '3');
    const select = (name: string) =>
        [...root().querySelectorAll<HTMLButtonElement>('.module-tabs button')]
            .find((button) => button.textContent === name)!
            .click();
    select('自動重試');
    root().querySelector<HTMLButtonElement>('.primary')!.click();
    await vi.runAllTimersAsync();
    expect(root().querySelector('.primary')?.textContent).toBe('停止自動重試');
    select('新增翻譯器');
    expect(input('數量').value).toBe('3');
    expect(root().querySelector('.summary')?.textContent).toBe('自動重試已啟用');
    select('自動重試');
    root().querySelector<HTMLButtonElement>('.primary')!.click();
    expect(root().querySelector('.primary')?.textContent).toBe('啟用自動重試');
    history.replaceState(null, '', '/workspace/gpt');
    view.updateVisibility();
    expect(root().querySelector('input[type="password"]')).not.toBeNull();
    expect(root().querySelector('.primary')?.textContent).toBe('添加GPT翻譯器');
});

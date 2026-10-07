import { it, expect, vi } from 'vitest';
import { SiteAdapter } from '../../src/services/SiteAdapter';
import { TranslatorService } from '../../src/services/TranslatorService';
import { WorkspaceService } from '../../src/services/WorkspaceService';
import { AutoRetryModule } from '../../src/modules/AutoRetryModule';
import { LaunchTranslatorModule } from '../../src/modules/LaunchTranslatorModule';
import { ModuleRegistry } from '../../src/core/ModuleRegistry';
import { ModuleRunner } from '../../src/core/ModuleRunner';
import { SettingsService } from '../../src/services/SettingsService';
import { NotificationView } from '../../src/ui/NotificationView';
import { KeyboardBindings } from '../../src/ui/KeyboardBindings';
import { DeleteTranslatorModule } from '../../src/modules/DeleteTranslatorModule';

it('does not relaunch when the auto-retry setting is false', async () => {
    history.replaceState(null, '', '/workspace/gpt');
    const site = new SiteAdapter();
    const translators = new TranslatorService(site);
    const launch = new LaunchTranslatorModule(translators);
    const operation = vi.spyOn(translators, 'launch').mockResolvedValue(0);
    const workspace = new WorkspaceService(localStorage);
    localStorage.setItem(
        'workspace-gpt',
        JSON.stringify({
            workers: [],
            jobs: [],
            uncompletedJobs: [{ task: 'web/p/n?level=normal', description: 'fixture' }],
        }),
    );
    const retry = new AutoRetryModule(site, translators, launch.settings, workspace);
    retry.settings.find((setting) => setting.name === '重啟翻譯器')!.value = false;
    await retry.execute({ signal: new AbortController().signal, automatic: true });
    expect(operation).not.toHaveBeenCalled();
    expect(workspace.read('gpt').jobs).toHaveLength(1);
    retry.dispose();
});

it('ignores unrelated page buttons and keeps protected workers out of launch candidates', async () => {
    document.body.innerHTML = `<button>unrelated</button><button>启动</button>
        <div class="n-list-item"><div class="n-thing"><div class="n-thing-header__title">本机</div><button>启动</button></div></div>
        <div class="n-list-item"><div class="n-thing"><div class="n-thing-header__title">QA</div><button>启动</button></div></div>`;
    const candidates = new SiteAdapter().launchButtons(['本机'], false);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.closest('.n-thing')?.textContent).toContain('QA');
});

it('does not invoke destructive shortcuts from input, contenteditable or IME events', () => {
    history.replaceState(null, '', '/workspace/gpt');
    const module = new DeleteTranslatorModule(new WorkspaceService(localStorage));
    module.settings.find((setting) => setting.name === 'bind')!.value = 'x';
    const registry = new ModuleRegistry([module]);
    const runner = new ModuleRunner(
        registry,
        new SettingsService(localStorage),
        new NotificationView(),
    );
    const activate = vi.spyOn(runner, 'activate').mockImplementation(() => {});
    const keyboard = new KeyboardBindings(registry, runner);
    keyboard.start();
    const input = document.createElement('input');
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    document.body.append(input, editor);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', isComposing: true }));
    expect(activate).not.toHaveBeenCalled();
    keyboard.dispose();
    runner.dispose();
});

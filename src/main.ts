import { version } from '../package.json';
import { ToolboxApp } from './core/ToolboxApp';
import { ModuleRegistry } from './core/ModuleRegistry';
import { ModuleRunner } from './core/ModuleRunner';
import { AuthService } from './services/AuthService';
import { ApiService } from './services/ApiService';
import { SettingsService } from './services/SettingsService';
import { WorkspaceService } from './services/WorkspaceService';
import { SiteAdapter } from './services/SiteAdapter';
import { TranslatorService } from './services/TranslatorService';
import { QueueService } from './services/QueueService';
import { AddSakuraTranslatorModule } from './modules/AddSakuraTranslatorModule';
import { AddGPTTranslatorModule } from './modules/AddGPTTranslatorModule';
import { DeleteTranslatorModule } from './modules/DeleteTranslatorModule';
import { LaunchTranslatorModule } from './modules/LaunchTranslatorModule';
import { QueueSakuraModule } from './modules/QueueSakuraModule';
import { QueueGPTModule } from './modules/QueueGPTModule';
import { AutoRetryModule } from './modules/AutoRetryModule';
import { NotificationView } from './ui/NotificationView';
import { PanelView } from './ui/PanelView';
import { KeyboardBindings } from './ui/KeyboardBindings';
import { allowedHost } from './util/routes';
import type { RuntimeWindow } from './types/RuntimeWindow';
import './styles/toolbox.css';

const runtime = window as RuntimeWindow;
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
        new AutoRetryModule(site, translators, launch.settings, workspace),
    ]);
    const notifications = new NotificationView();
    const runner = new ModuleRunner(registry, settings, notifications);
    const panel = new PanelView(registry, runner, settings, notifications, version);
    const keyboard = new KeyboardBindings(registry, runner);
    const app = new ToolboxApp(
        registry,
        runner,
        settings,
        workspace,
        panel,
        keyboard,
        notifications,
    );
    try {
        app.start();
        runtime._NTRToolBoxInstance = true;
        runtime._NoveliaToolBoxApp = app;
    } catch (error) {
        app.dispose();
        notifications.error(error);
    }
    import.meta.hot?.dispose(() => {
        app.dispose();
        if (runtime._NoveliaToolBoxApp === app) {
            delete runtime._NoveliaToolBoxApp;
            delete runtime._NTRToolBoxInstance;
        }
    });
}
import.meta.hot?.accept();

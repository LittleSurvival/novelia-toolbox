import { ModuleRegistry } from './ModuleRegistry';
import { ModuleRunner } from './ModuleRunner';
import { SettingsService } from '../services/SettingsService';
import { WorkspaceService } from '../services/WorkspaceService';
import { PanelView } from '../ui/PanelView';
import { KeyboardBindings } from '../ui/KeyboardBindings';
import { NotificationView } from '../ui/NotificationView';
import { workspaceKind } from '../util/routes';

export class ToolboxApp {
    private keepTimer: ReturnType<typeof setInterval> | null = null;
    private routeTimer: ReturnType<typeof setInterval> | null = null;
    private routeController = new AbortController();
    private lastUrl = location.href;

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly runner: ModuleRunner,
        private readonly settings: SettingsService,
        private readonly workspace: WorkspaceService,
        private readonly panel: PanelView,
        private readonly keyboard: KeyboardBindings,
        private readonly notifications: NotificationView,
    ) {}

    start(): void {
        this.settings.load(this.registry.modules);
        this.runner.restoreEnabled();
        this.panel.mount();
        this.keyboard.start();
        this.syncWorkspace();
        this.keepTimer = setInterval(() => this.runner.tick(), 1000);
        // A small URL-only poll also catches SPA navigation originating in the page's own history context.
        this.routeTimer = setInterval(() => {
            if (location.href === this.lastUrl) {
                return;
            }
            this.lastUrl = location.href;
            this.routeController.abort();
            this.routeController = new AbortController();
            this.runner.cancelAll();
            this.panel.updateVisibility();
            this.syncWorkspace();
        }, 250);
    }

    dispose(): void {
        if (this.keepTimer !== null) {
            clearInterval(this.keepTimer);
        }
        if (this.routeTimer !== null) {
            clearInterval(this.routeTimer);
        }
        this.routeController.abort();
        this.runner.dispose();
        this.keyboard.dispose();
        this.panel.dispose();
        this.notifications.dispose();
    }

    private syncWorkspace(): void {
        const kind = workspaceKind(location.pathname);
        if (kind) {
            void this.workspace
                .refresh(kind, this.routeController.signal)
                .catch((error) => this.notifications.error(error));
        }
    }
}

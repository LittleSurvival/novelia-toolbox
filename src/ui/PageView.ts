import type { ToolboxView } from '../interfaces/ToolboxView';
import { ModuleRegistry } from '../core/ModuleRegistry';
import { ModuleRunner } from '../core/ModuleRunner';
import { SettingsService } from '../services/SettingsService';
import { SiteAdapter } from '../services/SiteAdapter';
import { pageKind, queueSupported, workspaceKind } from '../util/routes';
import { NotificationView } from './NotificationView';
import { EmbeddedToolboxView } from './EmbeddedToolboxView';

export class PageView implements ToolboxView {
    private view: ToolboxView | null = null;
    private page = '';

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly runner: ModuleRunner,
        private readonly settings: SettingsService,
        private readonly notifications: NotificationView,
        private readonly site: SiteAdapter,
    ) {}

    mount(): void {
        this.updateVisibility();
    }

    updateVisibility(): void {
        const page = `${pageKind(location.pathname)}:${workspaceKind(location.pathname) ?? ''}`;
        if (this.view && page === this.page) {
            this.view.updateVisibility();
            return;
        }
        this.view?.dispose();
        this.page = page;
        this.view =
            queueSupported(location.pathname) || workspaceKind(location.pathname)
                ? new EmbeddedToolboxView(
                      this.registry,
                      this.runner,
                      this.settings,
                      this.notifications,
                      this.site,
                  )
                : null;
        this.view?.mount();
    }

    dispose(): void {
        this.view?.dispose();
        this.view = null;
    }
}

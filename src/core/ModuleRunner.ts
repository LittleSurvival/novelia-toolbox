import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { RunResult } from '../interfaces/RunResult';
import type { ModuleId } from '../types/ModuleId';
import { ModuleRegistry } from './ModuleRegistry';
import { SettingsService } from '../services/SettingsService';
import { NotificationView } from '../ui/NotificationView';
import { allowedHost } from '../util/routes';
import { errorMessage } from '../util/async';

export class ModuleRunner {
    private readonly running = new Map<ModuleId, AbortController>();
    private readonly enabled = new Set<ModuleId>();
    private readonly listeners = new Set<(module: ToolboxModule) => void>();
    private disposed = false;

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly settings: SettingsService,
        private readonly notifications: NotificationView,
    ) {}

    restoreEnabled(): void {
        const saved = this.settings.enabledNames();
        this.registry.modules
            .filter((module) => module.kind === 'continuous' && saved.has(module.name))
            .forEach((module) => this.enabled.add(module.id));
    }

    isEnabled(module: ToolboxModule): boolean {
        return this.enabled.has(module.id);
    }

    isRunning(module: ToolboxModule): boolean {
        return this.running.has(module.id);
    }

    subscribe(listener: (module: ToolboxModule) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    activate(module: ToolboxModule): void {
        if (!this.available(module)) {
            return;
        }
        if (module.kind === 'command') {
            void this.run(module, false);
            return;
        }
        if (this.enabled.has(module.id)) {
            this.stop(module);
        } else {
            this.enabled.add(module.id);
            this.saveEnabled();
            this.emit(module);
            void this.run(module, true);
        }
    }

    tick(): void {
        for (const module of this.registry.modules) {
            if (
                module.kind === 'continuous' &&
                this.enabled.has(module.id) &&
                this.available(module)
            ) {
                void this.run(module, true);
            }
        }
    }

    async run(module: ToolboxModule, automatic: boolean): Promise<RunResult> {
        const quiet: RunResult = { status: 'cancelled', message: '' };
        if (!this.available(module)) {
            return quiet;
        }
        if (this.running.has(module.id)) {
            if (!automatic) {
                this.notifications.show({
                    status: 'partial',
                    message: `${module.name} 正在執行`,
                });
            }
            return quiet;
        }
        const controller = new AbortController();
        this.running.set(module.id, controller);
        this.emit(module);
        try {
            const result = await module.execute({
                signal: controller.signal,
                automatic,
            });
            if (!controller.signal.aborted && !this.disposed) {
                this.notifications.show(result);
            }
            return result;
        } catch (error) {
            if (controller.signal.aborted || this.disposed) {
                return quiet;
            }
            const result: RunResult = {
                status: 'failed',
                message: `${module.name}：${errorMessage(error)}`,
            };
            this.notifications.show(result);
            if (module.kind === 'continuous') {
                this.stop(module);
            }
            return result;
        } finally {
            if (this.running.get(module.id) === controller) {
                this.running.delete(module.id);
            }
            this.emit(module);
        }
    }

    cancelAll(): void {
        this.running.forEach((controller) => controller.abort());
        this.registry.dispose();
    }

    dispose(): void {
        this.disposed = true;
        this.cancelAll();
        this.listeners.clear();
    }

    private stop(module: ToolboxModule): void {
        this.enabled.delete(module.id);
        this.running.get(module.id)?.abort();
        module.dispose();
        this.saveEnabled();
        this.emit(module);
    }

    private available(module: ToolboxModule): boolean {
        return (
            !this.disposed &&
            allowedHost(location.hostname) &&
            module.supports(location.pathname)
        );
    }

    private saveEnabled(): void {
        this.settings.saveEnabled(
            this.registry.modules
                .filter((module) => this.enabled.has(module.id))
                .map((module) => module.name),
        );
    }

    private emit(module: ToolboxModule): void {
        this.listeners.forEach((listener) => listener(module));
    }
}

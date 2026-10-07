import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { PanelPosition } from '../interfaces/PanelPosition';
import type { StoredConfiguration } from '../interfaces/StoredConfiguration';
import { isRecord, parseRecord } from '../util/record';

export class SettingsService {
    private readonly configKey = 'NTR_ToolBox_Config';
    private readonly keepKey = 'NTR_KeepState';
    private readonly positionKey = 'ntr-panel-position';

    constructor(private readonly storage: Storage) {}

    load(modules: readonly ToolboxModule[]): void {
        const raw = this.storage.getItem(this.configKey);
        const stored = parseRecord(raw);
        if (!stored || !Array.isArray(stored.modules)) {
            return;
        }
        if (raw && !this.storage.getItem(`${this.configKey}_Backup`)) {
            this.storage.setItem(`${this.configKey}_Backup`, raw);
        }
        for (const module of modules) {
            const saved: unknown = stored.modules.find(
                (item: unknown) => isRecord(item) && item.name === module.name,
            );
            if (!isRecord(saved) || !Array.isArray(saved.settings)) {
                continue;
            }
            for (const definition of module.settings) {
                const previous: unknown = saved.settings.find(
                    (item: unknown) => isRecord(item) && item.name === definition.name,
                );
                if (
                    !isRecord(previous) ||
                    typeof previous.value !== typeof definition.value
                ) {
                    continue;
                }
                const value = previous.value;
                if (
                    typeof value === 'number' &&
                    (!Number.isSafeInteger(value) || value < (definition.min ?? 0))
                ) {
                    continue;
                }
                if (
                    definition.type === 'select' &&
                    (typeof value !== 'string' || !definition.options?.includes(value))
                ) {
                    continue;
                }
                if (
                    typeof value === 'string' ||
                    typeof value === 'number' ||
                    typeof value === 'boolean'
                ) {
                    definition.value = value;
                }
            }
        }
    }

    save(modules: readonly ToolboxModule[]): void {
        // Keep the legacy DTO shape and version so settings remain readable by v0.7.
        const data: StoredConfiguration = {
            version: 20,
            modules: modules.map((module) => ({
                name: module.name,
                settings: module.settings.map((setting) => ({
                    name: setting.name,
                    type: setting.type,
                    value: setting.value,
                    ...(setting.options ? { options: [...setting.options] } : {}),
                })),
            })),
        };
        this.storage.setItem(this.configKey, JSON.stringify(data));
    }

    enabledNames(): Set<string> {
        const stored = parseRecord(this.storage.getItem(this.keepKey));
        return new Set(
            Object.entries(stored ?? {})
                .filter(([, value]) => value === true)
                .map(([name]) => name),
        );
    }

    saveEnabled(names: Iterable<string>): void {
        this.storage.setItem(
            this.keepKey,
            JSON.stringify(Object.fromEntries([...names].map((name) => [name, true]))),
        );
    }

    getPosition(): PanelPosition | null {
        const stored = parseRecord(this.storage.getItem(this.positionKey));
        return stored && typeof stored.left === 'string' && typeof stored.top === 'string'
            ? { left: stored.left, top: stored.top }
            : null;
    }

    savePosition(position: PanelPosition): void {
        this.storage.setItem(this.positionKey, JSON.stringify(position));
    }
}

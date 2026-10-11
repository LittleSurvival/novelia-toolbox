import type { SettingDefinition } from '../interfaces/SettingDefinition';
import { isPipelineWorkspace } from './routes';
import { numberSetting, numberValue } from './settings';

export function concurrencySetting(): SettingDefinition {
    return {
        ...numberSetting('並發數', 1, 1),
        description: '每個 beta 翻譯器的並發數（1–100）',
        visible: (_, pathname) => isPipelineWorkspace(pathname),
    };
}

export function workerConcurrency(settings: SettingDefinition[]): {
    concurrency?: number;
} {
    if (!isPipelineWorkspace(location.pathname)) return {};
    const concurrency = numberValue(settings, '並發數');
    if (concurrency > 100) throw new Error('並發數必須介於 1 和 100');
    return { concurrency };
}

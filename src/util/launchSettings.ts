import type { SettingDefinition } from '../interfaces/SettingDefinition';
import type { LaunchOptions } from '../interfaces/LaunchOptions';
import { booleanValue, exclusions, numberValue, stringValue } from './settings';

export function readLaunchOptions(
    settings: SettingDefinition[],
    automatic: boolean,
): LaunchOptions {
    return {
        interval: numberValue(settings, '延遲間隔'),
        maximum: numberValue(settings, '最多啟動'),
        avoidEmpty: booleanValue(settings, '避免無效啟動'),
        exclusions: exclusions(stringValue(settings, '排除')),
        automatic,
    };
}

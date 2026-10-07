import type { SettingDefinition } from '../interfaces/SettingDefinition';
import type { SettingValue } from '../types/SettingValue';
import type { TranslateMode } from '../types/TranslateMode';

export function numberSetting(name: string, value: number, min = 0): SettingDefinition {
    return {
        name,
        type: 'number',
        value,
        min,
    };
}

export function stringSetting(name: string, value: string): SettingDefinition {
    return {
        name,
        type: 'string',
        value,
    };
}

export function booleanSetting(name: string, value: boolean): SettingDefinition {
    return {
        name,
        type: 'boolean',
        value,
    };
}

export function selectSetting(
    name: string,
    options: string[],
    value: string,
): SettingDefinition {
    return {
        name,
        type: 'select',
        value,
        options,
    };
}

export function settingValue(settings: SettingDefinition[], name: string): SettingValue {
    const setting = settings.find((item) => item.name === name);
    if (!setting) {
        throw new Error(`找不到設定：${name}`);
    }
    return setting.value;
}

export function numberValue(settings: SettingDefinition[], name: string): number {
    const definition = settings.find((item) => item.name === name);
    const value = settingValue(settings, name);
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < (definition?.min ?? 0)
    ) {
        throw new Error(`${name} 必須是大於等於 ${definition?.min ?? 0} 的整數`);
    }
    return value;
}

export function stringValue(settings: SettingDefinition[], name: string): string {
    return String(settingValue(settings, name));
}

export function booleanValue(settings: SettingDefinition[], name: string): boolean {
    return settingValue(settings, name) === true;
}

export function translateMode(value: string): TranslateMode {
    if (value === '常規') {
        return 'normal';
    }
    if (value === '過期') {
        return 'expire';
    }
    if (value === '重翻') {
        return 'all';
    }
    throw new Error(`不支援的翻譯模式：${value}`);
}

export function exclusions(value: string): string[] {
    return value
        .split(/[,，]/)
        .map((word) => word.trim())
        .filter(Boolean);
}

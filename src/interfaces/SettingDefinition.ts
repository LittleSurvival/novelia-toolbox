import type { SettingValue } from '../types/SettingValue';

export interface SettingDefinition {
    name: string;
    type: 'boolean' | 'number' | 'string' | 'select';
    value: SettingValue;
    options?: string[];
    min?: number;
}

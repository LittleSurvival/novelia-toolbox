import type { SettingValue } from '../types/SettingValue';

export interface SettingDefinition {
    name: string;
    type: 'boolean' | 'number' | 'string' | 'select';
    value: SettingValue;
    options?: string[];
    min?: number;
    label?: string;
    description?: string;
    visible?: (settings: readonly SettingDefinition[], pathname: string) => boolean;
}

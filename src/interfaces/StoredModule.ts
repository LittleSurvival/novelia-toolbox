import type { SettingDefinition } from './SettingDefinition';

export interface StoredModule {
    name: string;
    settings: SettingDefinition[];
}

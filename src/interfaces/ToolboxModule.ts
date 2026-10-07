import type { ModuleId } from '../types/ModuleId';
import type { SettingDefinition } from './SettingDefinition';
import type { ModuleContext } from './ModuleContext';
import type { RunResult } from './RunResult';

export interface ToolboxModule {
    readonly id: ModuleId;
    readonly name: string;
    readonly kind: 'command' | 'continuous';
    readonly settings: SettingDefinition[];
    supports(pathname: string): boolean;
    execute(context: ModuleContext): Promise<RunResult>;
    dispose(): void;
}

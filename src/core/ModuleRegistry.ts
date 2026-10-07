import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { ModuleId } from '../types/ModuleId';

export class ModuleRegistry {
    constructor(readonly modules: readonly ToolboxModule[]) {
        if (new Set(modules.map((module) => module.id)).size !== modules.length) {
            throw new Error('功能 ID 不可重複');
        }
    }

    get(id: ModuleId): ToolboxModule {
        const module = this.modules.find((item) => item.id === id);
        if (!module) {
            throw new Error(`找不到功能：${id}`);
        }
        return module;
    }

    dispose(): void {
        this.modules.forEach((module) => module.dispose());
    }
}

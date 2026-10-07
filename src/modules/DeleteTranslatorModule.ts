import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { ModuleContext } from '../interfaces/ModuleContext';
import type { RunResult } from '../interfaces/RunResult';
import { WorkspaceService } from '../services/WorkspaceService';
import { exclusions, stringSetting, stringValue } from '../util/settings';
import { workspaceKind } from '../util/routes';

export class DeleteTranslatorModule implements ToolboxModule {
    readonly id = 'delete-translators';
    readonly name = '刪除翻譯器';
    readonly kind = 'command';
    readonly settings = [
        stringSetting('排除', '共享,本机,AutoDL'),
        stringSetting('bind', 'none'),
    ];

    constructor(private readonly workspace: WorkspaceService) {}

    supports(pathname: string): boolean {
        return workspaceKind(pathname) !== null;
    }

    async execute({ signal }: ModuleContext): Promise<RunResult> {
        const kind = workspaceKind(location.pathname);
        if (!kind) {
            throw new Error('請先開啟翻譯器工作區');
        }
        const removed = await this.workspace.removeWorkers(
            kind,
            exclusions(stringValue(this.settings, '排除')),
            signal,
        );
        return { status: 'success', message: `已刪除 ${removed} 個翻譯器` };
    }

    dispose(): void {}
}

import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { ModuleContext } from '../interfaces/ModuleContext';
import type { RunResult } from '../interfaces/RunResult';
import { WorkspaceService } from '../services/WorkspaceService';
import { numberSetting, numberValue, stringSetting, stringValue } from '../util/settings';
import { workspaceKind } from '../util/routes';

export class AddSakuraTranslatorModule implements ToolboxModule {
    readonly id = 'add-sakura';
    readonly name = '添加Sakura翻譯器';
    readonly kind = 'command';
    readonly settings = [
        numberSetting('數量', 5, 1),
        stringSetting('名稱', 'NTR translator '),
        stringSetting('鏈接', 'https://sakura-share.one'),
        stringSetting('bind', 'none'),
    ];

    constructor(private readonly workspace: WorkspaceService) {}

    supports(pathname: string): boolean {
        return workspaceKind(pathname) === 'sakura';
    }

    async execute({ signal }: ModuleContext): Promise<RunResult> {
        const count = numberValue(this.settings, '數量');
        const prefix = stringValue(this.settings, '名稱');
        const endpoint = stringValue(this.settings, '鏈接');
        const workers = Array.from({ length: count }, (_, index) => ({
            id: `${prefix}${index + 1}`,
            endpoint,
            prevSegLength: 500,
            segLength: 500,
        }));
        const added = await this.workspace.upsertWorkers('sakura', workers, signal);
        return {
            status: 'success',
            message: `已新增或更新 ${added} 個 Sakura 翻譯器`,
        };
    }

    dispose(): void {}
}

import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { ModuleContext } from '../interfaces/ModuleContext';
import type { RunResult } from '../interfaces/RunResult';
import { WorkspaceService } from '../services/WorkspaceService';
import { numberSetting, numberValue, stringSetting, stringValue } from '../util/settings';
import { workspaceKind } from '../util/routes';

export class AddGPTTranslatorModule implements ToolboxModule {
    readonly id = 'add-gpt';
    readonly name = '添加GPT翻譯器';
    readonly kind = 'command';
    readonly settings = [
        numberSetting('數量', 5, 1),
        stringSetting('名稱', 'NTR translator '),
        stringSetting('模型', 'deepseek-chat'),
        stringSetting('鏈接', 'https://api.deepseek.com'),
        stringSetting('Key', 'sk-wait-for-input'),
        stringSetting('bind', 'none'),
    ];

    constructor(private readonly workspace: WorkspaceService) {}

    supports(pathname: string): boolean {
        return workspaceKind(pathname) === 'gpt';
    }

    async execute({ signal }: ModuleContext): Promise<RunResult> {
        const count = numberValue(this.settings, '數量');
        const prefix = stringValue(this.settings, '名稱');
        const model = stringValue(this.settings, '模型');
        const endpoint = stringValue(this.settings, '鏈接');
        const key = stringValue(this.settings, 'Key');
        const workers = Array.from({ length: count }, (_, index) => ({
            id: `${prefix}${index + 1}`,
            model,
            endpoint,
            key,
        }));
        const added = await this.workspace.upsertWorkers('gpt', workers, signal);
        return {
            status: 'success',
            message: `已新增或更新 ${added} 個 GPT 翻譯器`,
        };
    }

    dispose(): void {}
}

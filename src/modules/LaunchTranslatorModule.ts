import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { ModuleContext } from '../interfaces/ModuleContext';
import type { RunResult } from '../interfaces/RunResult';
import { TranslatorService } from '../services/TranslatorService';
import { booleanSetting, numberSetting, stringSetting } from '../util/settings';
import { readLaunchOptions } from '../util/launchSettings';
import { workspaceKind } from '../util/routes';

export class LaunchTranslatorModule implements ToolboxModule {
    readonly id = 'launch-translators';
    readonly name = '啟動翻譯器';
    readonly kind = 'command';
    readonly settings = [
        numberSetting('延遲間隔', 50),
        numberSetting('最多啟動', 999),
        booleanSetting('避免無效啟動', true),
        stringSetting('排除', '本机,AutoDL'),
        stringSetting('bind', 'none'),
    ];

    constructor(private readonly translators: TranslatorService) {}

    supports(pathname: string): boolean {
        return workspaceKind(pathname) !== null;
    }

    async execute({ signal, automatic }: ModuleContext): Promise<RunResult> {
        const clicked = await this.translators.launch(
            readLaunchOptions(this.settings, automatic),
            signal,
        );
        return { status: 'success', message: `已送出 ${clicked} 次啟動操作` };
    }

    dispose(): void {}
}

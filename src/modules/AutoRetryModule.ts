import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { ModuleContext } from '../interfaces/ModuleContext';
import type { RunResult } from '../interfaces/RunResult';
import type { SettingDefinition } from '../interfaces/SettingDefinition';
import { SiteAdapter } from '../services/SiteAdapter';
import { TranslatorService } from '../services/TranslatorService';
import { WorkspaceService } from '../services/WorkspaceService';
import {
    booleanSetting,
    booleanValue,
    numberSetting,
    numberValue,
} from '../util/settings';
import { readLaunchOptions } from '../util/launchSettings';
import { workspaceKind } from '../util/routes';

export class AutoRetryModule implements ToolboxModule {
    readonly id = 'auto-retry';
    readonly name = '自動重試';
    readonly kind = 'continuous';
    readonly settings = [
        numberSetting('最大重試次數', 99),
        booleanSetting('置頂重試任務', false),
        booleanSetting('重啟翻譯器', true),
    ];
    private attempts = 0;
    private nextRun = 0;
    private listening = false;
    private readonly onManualClick = (event: MouseEvent) => {
        const element = event.target instanceof Element ? event.target : null;
        if (
            event.isTrusted &&
            element?.closest('button') &&
            !element.closest('[data-ntr-root]')
        ) {
            this.attempts = 0;
            this.nextRun = 0;
        }
    };

    constructor(
        private readonly site: SiteAdapter,
        private readonly translators: TranslatorService,
        private readonly launchSettings: SettingDefinition[],
        private readonly workspace: WorkspaceService,
    ) {}

    supports(pathname: string): boolean {
        return workspaceKind(pathname) !== null;
    }

    async execute({ signal }: ModuleContext): Promise<RunResult> {
        if (!this.listening) {
            document.addEventListener('click', this.onManualClick);
            this.listening = true;
        }
        const quiet: RunResult = { status: 'success', message: '' };
        if (Date.now() < this.nextRun || this.site.runningCount() > 0) {
            return quiet;
        }
        if (this.attempts >= numberValue(this.settings, '最大重試次數')) {
            return quiet;
        }
        const kind = workspaceKind(location.pathname);
        if (!kind) {
            return quiet;
        }
        const unfinished = this.workspace.unfinishedCount(kind);
        if (!unfinished) {
            return quiet;
        }
        const retry = await this.workspace.retryUnfinishedJobs(
            kind,
            booleanValue(this.settings, '置頂重試任務'),
            signal,
        );
        this.attempts++;
        this.nextRun =
            Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(this.attempts - 1, 6));
        if (booleanValue(this.settings, '重啟翻譯器')) {
            await this.translators.launch(
                readLaunchOptions(this.launchSettings, true),
                signal,
            );
        }
        return {
            status: 'success',
            message: `已重排 ${retry.retried} 個任務，跳過 ${retry.skipped} 個已排任務（第 ${this.attempts} 輪）`,
        };
    }

    dispose(): void {
        document.removeEventListener('click', this.onManualClick);
        this.listening = false;
        this.attempts = 0;
        this.nextRun = 0;
    }
}

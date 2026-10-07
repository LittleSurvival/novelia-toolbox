import type { LaunchOptions } from '../interfaces/LaunchOptions';
import { SiteAdapter } from './SiteAdapter';
import { delay } from '../util/async';

export class TranslatorService {
    private active: Promise<number> | null = null;

    constructor(private readonly site: SiteAdapter) {}

    launch(options: LaunchOptions, signal: AbortSignal): Promise<number> {
        if (this.active) {
            return this.active;
        }
        const operation = this.launchSequentially(options, signal);
        this.active = operation;
        void operation
            .finally(() => {
                if (this.active === operation) {
                    this.active = null;
                }
            })
            .catch(() => {});
        return operation;
    }

    private async launchSequentially(
        options: LaunchOptions,
        signal: AbortSignal,
    ): Promise<number> {
        const buttons = this.site.launchButtons(options.exclusions, options.automatic);
        let clicked = 0;
        let lastRunning = this.site.runningCount();
        let emptyAttempts = 0;
        for (const button of buttons) {
            signal.throwIfAborted();
            if (clicked >= options.maximum) {
                break;
            }
            if (
                !button.isConnected ||
                button.disabled ||
                !/^(启动|啟動)$/.test(button.textContent?.trim() ?? '')
            ) {
                continue;
            }
            button.click();
            clicked++;
            await delay(options.interval, signal);
            if (options.avoidEmpty) {
                const running = this.site.runningCount();
                emptyAttempts = running > lastRunning ? 0 : emptyAttempts + 1;
                lastRunning = running;
                if (emptyAttempts >= 4) {
                    break;
                }
            }
        }
        return clicked;
    }
}

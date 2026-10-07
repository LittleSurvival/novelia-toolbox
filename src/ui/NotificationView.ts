import type { RunResult } from '../interfaces/RunResult';
import { errorMessage } from '../util/async';

export class NotificationView {
    private readonly container = document.createElement('div');
    private readonly timers = new Set<ReturnType<typeof setTimeout>>();

    constructor() {
        this.container.className = 'ntr-notification-container';
    }

    show(result: RunResult): void {
        if (!result.message) {
            return;
        }
        if (!this.container.isConnected) {
            document.body.append(this.container);
        }
        const box = document.createElement('div');
        box.className = `ntr-notification-message ${result.status}`;
        box.setAttribute('role', result.status === 'failed' ? 'alert' : 'status');
        const icon = {
            success: '✅',
            partial: '⚠️',
            failed: '❌',
            cancelled: '⏹️',
        }[result.status];
        box.textContent = `${icon} ${result.message}`;
        this.container.append(box);
        const timer = setTimeout(
            () => {
                box.remove();
                this.timers.delete(timer);
            },
            result.status === 'failed' ? 8000 : 5000,
        );
        this.timers.add(timer);
    }

    error(error: unknown): void {
        this.show({ status: 'failed', message: errorMessage(error) });
    }

    dispose(): void {
        this.timers.forEach((timer) => clearTimeout(timer));
        this.timers.clear();
        this.container.remove();
    }
}

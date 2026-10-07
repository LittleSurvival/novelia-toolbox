import type { ToolboxModule } from '../interfaces/ToolboxModule';
import type { ModuleContext } from '../interfaces/ModuleContext';
import type { RunResult } from '../interfaces/RunResult';
import { QueueService } from '../services/QueueService';
import { queueSettings, readQueueOptions } from '../util/queueSettings';
import { queueSupported } from '../util/routes';

export class QueueGPTModule implements ToolboxModule {
    readonly id = 'queue-gpt';
    readonly name = '排隊GPT v2';
    readonly kind = 'command';
    readonly settings = queueSettings();

    constructor(private readonly queue: QueueService) {}

    supports(pathname: string): boolean {
        return queueSupported(pathname);
    }

    execute({ signal }: ModuleContext): Promise<RunResult> {
        return this.queue.queue('gpt', readQueueOptions(this.settings), signal);
    }

    dispose(): void {}
}

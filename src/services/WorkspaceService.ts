import type { TranslatorKind } from '../types/TranslatorKind';
import type { WorkspaceData } from '../interfaces/WorkspaceData';
import type { WorkspaceWorker } from '../interfaces/WorkspaceWorker';
import type { WorkspaceJob } from '../interfaces/WorkspaceJob';
import type { RetryResult } from '../interfaces/RetryResult';
import { isRecord } from '../util/record';
import { finishedJob, insertJob } from '../util/workspaceJobs';
import { taskIdentity } from '../util/taskLinks';

export class WorkspaceService {
    constructor(private readonly storage: Storage) {}

    read(kind: TranslatorKind): WorkspaceData {
        const raw = this.storage.getItem(this.key(kind));
        const defaults: WorkspaceData = {
            workers:
                kind === 'sakura'
                    ? [
                          { id: '共享', endpoint: 'https://sakura-share.one' },
                          { id: '本机', endpoint: 'http://127.0.0.1:8080' },
                          { id: 'AutoDL', endpoint: 'http://127.0.0.1:6006' },
                      ]
                    : [],
            jobs: [],
            uncompletedJobs: [],
        };
        if (!raw) {
            return defaults;
        }
        const stored: unknown = JSON.parse(raw);
        if (!isRecord(stored)) {
            throw new Error('工作區資料格式不相容，已停止修改');
        }
        const data = { ...defaults, ...stored };
        if (
            !isRecord(data) ||
            !Array.isArray(data.workers) ||
            !Array.isArray(data.jobs) ||
            !Array.isArray(data.uncompletedJobs) ||
            !data.workers.every(
                (worker) => isRecord(worker) && typeof worker.id === 'string',
            ) ||
            !data.jobs.every((job) => isRecord(job) && typeof job.task === 'string') ||
            !data.uncompletedJobs.every(
                (job) => isRecord(job) && typeof job.task === 'string',
            )
        ) {
            throw new Error('工作區資料格式不相容，已停止修改');
        }
        return data as unknown as WorkspaceData;
    }

    async upsertWorkers(
        kind: TranslatorKind,
        workers: WorkspaceWorker[],
        signal: AbortSignal,
    ): Promise<number> {
        return this.mutate(kind, signal, (data) => {
            for (const worker of workers) {
                const index = data.workers.findIndex(
                    (existing) => existing.id === worker.id,
                );
                if (index < 0) {
                    data.workers.push(worker);
                } else {
                    data.workers[index] = { ...data.workers[index], ...worker };
                }
            }
            return workers.length;
        });
    }

    async removeWorkers(
        kind: TranslatorKind,
        exclusions: string[],
        signal: AbortSignal,
    ): Promise<number> {
        return this.mutate(kind, signal, (data) => {
            const before = data.workers.length;
            data.workers = data.workers.filter((worker) =>
                exclusions.some((keyword) => worker.id.includes(keyword)),
            );
            return before - data.workers.length;
        });
    }

    async addJobs(
        kind: TranslatorKind,
        jobs: WorkspaceJob[],
        signal: AbortSignal,
    ): Promise<WorkspaceJob[]> {
        return this.mutate(kind, signal, (data) => {
            const added: WorkspaceJob[] = [];
            for (const job of jobs) {
                const entry = { ...job, createAt: Date.now() };
                if (insertJob(data.jobs, entry)) {
                    added.push(entry);
                }
            }
            return added;
        });
    }

    unfinishedCount(kind: TranslatorKind): number {
        return this.read(kind).uncompletedJobs.filter((job) => !finishedJob(job)).length;
    }

    async retryUnfinishedJobs(
        kind: TranslatorKind,
        moveToTop: boolean,
        signal: AbortSignal,
    ): Promise<RetryResult> {
        return this.mutate(kind, signal, (data) => {
            const records = data.uncompletedJobs.filter((job) => !finishedJob(job));
            let retried = 0;
            for (const record of records) {
                if (
                    insertJob(data.jobs, {
                        task: record.task,
                        description: record.description,
                        createAt: Date.now(),
                    })
                ) {
                    retried++;
                }
            }
            if (moveToTop) {
                const tasks = new Set(records.map((job) => taskIdentity(job.task)));
                data.jobs = [
                    ...data.jobs.filter((job) => tasks.has(taskIdentity(job.task))),
                    ...data.jobs.filter((job) => !tasks.has(taskIdentity(job.task))),
                ];
            }
            data.uncompletedJobs = data.uncompletedJobs.filter(finishedJob);
            return { retried, skipped: records.length - retried };
        });
    }

    async refresh(kind: TranslatorKind, signal: AbortSignal): Promise<void> {
        // Notify the current SPA without writing back a potentially stale snapshot.
        signal.throwIfAborted();
        const key = this.key(kind);
        const raw = this.storage.getItem(key);
        if (raw !== null) {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key,
                    newValue: raw,
                    url: location.href,
                    storageArea: this.storage,
                }),
            );
        }
    }

    private key(kind: TranslatorKind): string {
        return `workspace-${kind}`;
    }

    private async mutate<T>(
        kind: TranslatorKind,
        signal: AbortSignal,
        change: (data: WorkspaceData) => T,
    ): Promise<T> {
        signal.throwIfAborted();
        if (!navigator.locks) {
            throw new Error('瀏覽器不支援 Web Locks，已停止工作區修改以避免分頁互相覆蓋');
        }
        const key = this.key(kind);
        return navigator.locks.request(`NTRToolBox:${key}`, { signal }, () => {
            signal.throwIfAborted();
            const oldValue = this.storage.getItem(key);
            const data = this.read(kind);
            const result = change(data);
            const newValue = JSON.stringify(data);
            if (oldValue === newValue) {
                return result;
            }
            this.storage.setItem(key, newValue);
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key,
                    oldValue,
                    newValue,
                    url: location.href,
                    storageArea: this.storage,
                }),
            );
            return result;
        });
    }
}

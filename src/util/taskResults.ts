import type { WorkspaceJob } from '../interfaces/WorkspaceJob';

export function jobBookCount(jobs: WorkspaceJob[]): number {
    return new Set(
        jobs.map((job) =>
            job.task.startsWith('wenku/')
                ? job.task.split('/')[1]
                : job.task.split('?')[0],
        ),
    ).size;
}

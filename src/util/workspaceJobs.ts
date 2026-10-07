import type { WorkspaceJob } from '../interfaces/WorkspaceJob';
import { taskIdentity } from './taskLinks';
import { isRecord } from './record';

export function insertJob(jobs: WorkspaceJob[], job: WorkspaceJob): boolean {
    const identity = taskIdentity(job.task);
    const index = jobs.findIndex((existing) => taskIdentity(existing.task) === identity);
    if (index < 0) {
        jobs.push(job);
        return true;
    }
    if (jobs[index]?.finishAt !== undefined) {
        jobs[index] = job;
        return true;
    }
    return false;
}

export function finishedJob(job: WorkspaceJob): boolean {
    return (
        isRecord(job.progress) &&
        typeof job.progress.finished === 'number' &&
        typeof job.progress.total === 'number' &&
        job.progress.finished >= job.progress.total
    );
}

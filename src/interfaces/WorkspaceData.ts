import type { WorkspaceJob } from './WorkspaceJob';
import type { WorkspaceWorker } from './WorkspaceWorker';

export interface WorkspaceData {
    workers: WorkspaceWorker[];
    jobs: WorkspaceJob[];
    uncompletedJobs: WorkspaceJob[];
    [key: string]: unknown;
}

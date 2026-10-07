export interface WorkspaceJob {
    task: string;
    description: string;
    createAt?: number;
    finishAt?: number;
    progress?: {
        finished: number;
        error: number;
        total: number;
    };
    [key: string]: unknown;
}

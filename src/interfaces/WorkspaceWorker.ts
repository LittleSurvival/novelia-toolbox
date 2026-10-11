export interface WorkspaceWorker {
    id: string;
    endpoint: string;
    type?: string;
    model?: string;
    key?: string;
    prevSegLength?: number;
    segLength?: number;
    concurrency?: number;
    [key: string]: unknown;
}

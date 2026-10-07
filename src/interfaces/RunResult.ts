export interface RunResult {
    status: 'success' | 'partial' | 'failed' | 'cancelled';
    message: string;
    added?: number;
    skipped?: number;
    books?: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRecord(raw: string | null): Record<string, unknown> | null {
    if (!raw) {
        return null;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function finiteCount(value: unknown): number {
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error('章節數量格式不正確');
    }
    return count;
}

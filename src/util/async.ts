export function delay(ms: number, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

export function errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : '操作失敗';
    return message
        .replace(/Bearer\s+[^\s]+/gi, 'Bearer [hidden]')
        .replace(/sk-[\w-]+/g, '[hidden]');
}

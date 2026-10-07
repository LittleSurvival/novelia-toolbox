import { beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    history.replaceState(null, '', '/');
    const pending = new Map<string, Promise<unknown>>();
    Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
            request<T>(
                name: string,
                options: { signal: AbortSignal },
                callback: () => T,
            ): Promise<T> {
                const operation = (pending.get(name) ?? Promise.resolve()).then(() => {
                    options.signal.throwIfAborted();
                    return callback();
                });
                pending.set(
                    name,
                    operation.catch(() => undefined),
                );
                return operation;
            },
        },
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

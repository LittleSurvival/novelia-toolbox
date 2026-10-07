import { AuthService } from './AuthService';
import { HttpError } from './HttpError';
import { delay } from '../util/async';

export class ApiService {
    constructor(private readonly auth: AuthService) {}

    async getJson(
        url: string,
        signal: AbortSignal,
        authenticated = true,
    ): Promise<unknown> {
        const target = new URL(url, location.origin);
        if (target.origin !== location.origin) {
            throw new Error('站點 API 請求必須與目前頁面同源');
        }
        for (let attempt = 0; attempt < 3; attempt++) {
            signal.throwIfAborted();
            try {
                const token = authenticated ? this.auth.getToken() : null;
                const response = await fetch(target, {
                    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!response.ok) {
                    throw new HttpError(response.status);
                }
                return (await response.json()) as unknown;
            } catch (error) {
                signal.throwIfAborted();
                if (
                    error instanceof HttpError &&
                    error.status < 500 &&
                    error.status !== 429
                ) {
                    throw error;
                }
                if (attempt === 2) {
                    throw error;
                }
                await delay(1000 * 2 ** attempt, signal);
            }
        }
        throw new Error('API 重試已達上限');
    }
}

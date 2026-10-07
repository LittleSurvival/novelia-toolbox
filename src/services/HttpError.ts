export class HttpError extends Error {
    constructor(readonly status: number) {
        super(
            status === 401 || status === 403
                ? `登入失效或無權限（HTTP ${status}）`
                : `請求失敗（HTTP ${status}）`,
        );
        this.name = 'HttpError';
    }
}

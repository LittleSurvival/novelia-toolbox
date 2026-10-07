import { listPage, listQuery, favoriteSort } from '../util/listQuery';
import { parseRecord } from '../util/record';

export class SiteAdapter {
    wenkuIds(limit: number): string[] {
        const ids = [
            ...document.querySelectorAll<HTMLAnchorElement>('a[href^="/wenku/"]'),
        ]
            .map((link) => new URL(link.href).pathname.split('/')[2])
            .filter((id): id is string => Boolean(id));
        return [...new Set(ids)].slice(0, limit);
    }

    webSearchApi(limit: number): string {
        return `/api/novel?${listQuery(location.search, listPage(location.search), limit)}`;
    }

    favoriteWebQuery(search: string, page: number, limit: number): URLSearchParams {
        const params = listQuery(search, page, limit);
        params.set('sort', favoriteSort(search, this.favoriteCreateTimeFirst()));
        return params;
    }

    favoriteWenkuQuery(search: string, page: number, limit: number): URLSearchParams {
        return new URLSearchParams({
            page: String(page),
            pageSize: String(limit),
            sort: favoriteSort(search, this.favoriteCreateTimeFirst(), 0),
        });
    }

    launchButtons(exclusions: string[], automatic: boolean): HTMLButtonElement[] {
        return this.buttons('启动', '啟動').filter((button) => {
            const item = button.closest('.n-list-item');
            const title =
                item?.querySelector('.n-thing-header__title')?.textContent ?? '';
            if (exclusions.some((keyword) => title.includes(keyword))) {
                return false;
            }
            return (
                !automatic || !item?.textContent?.includes('TypeError: Failed to fetch')
            );
        });
    }

    runningCount(): number {
        return this.buttons('停止').length;
    }

    private favoriteCreateTimeFirst(): boolean {
        return (
            parseRecord(localStorage.getItem('setting'))?.favoriteCreateTimeFirst === true
        );
    }

    private buttons(...labels: string[]): HTMLButtonElement[] {
        return [...document.querySelectorAll<HTMLButtonElement>('button')].filter(
            (button) =>
                !button.disabled &&
                !button.closest('#ntr-panel') &&
                Boolean(button.closest('.n-list-item .n-thing')) &&
                labels.some((label) => button.textContent?.trim() === label),
        );
    }
}

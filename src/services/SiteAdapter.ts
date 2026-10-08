import { listPage, listQuery, favoriteSort } from '../util/listQuery';
import { parseRecord } from '../util/record';
import { pageKind } from '../util/routes';

export class SiteAdapter {
    toolboxMountPoint(): { parent: HTMLElement; before: Element | null } | null {
        const page = pageKind(location.pathname);
        if (page === 'other') return null;
        if (page === 'novel' || page === 'wenku') {
            // Web novels have a fixed right-hand TOC. Stay inside the metadata column;
            // a toolbar spanning the outer layout would sit underneath that fixed TOC.
            const content = document.querySelector<HTMLElement>('.layout-content, main');
            if (!content?.querySelector('h1, h2, h3')) return null;
            const parent =
                page === 'novel'
                    ? content.querySelector<HTMLElement>('.metadata-stat')?.parentElement
                    : content;
            if (!parent) return null;
            const children = [...parent.children].filter(
                (element) => !element.hasAttribute('data-ntr-root'),
            );
            if (page === 'novel') {
                const comments = [...parent.querySelectorAll('h2, h3')].find((heading) =>
                    ['评论', '評論'].includes(heading.textContent?.trim() ?? ''),
                );
                const commentSection =
                    comments && children.find((element) => element.contains(comments));
                if (commentSection) return { parent, before: commentSection };
                // While comments are loading, stay after the native workspace actions.
                const workspace = children.find((element) =>
                    [...element.querySelectorAll('button')].some((button) =>
                        ['导入工作区', '導入工作區'].includes(
                            button.textContent?.trim() ?? '',
                        ),
                    ),
                );
                return workspace
                    ? {
                          parent,
                          before: children[children.indexOf(workspace) + 1] ?? null,
                      }
                    : null;
            }
            return {
                parent,
                before: children[0] ?? null,
            };
        }
        const heading = document.querySelector<HTMLElement>(
            '.layout-content h1, main h1',
        );
        const parent = heading?.parentElement;
        if (!parent) {
            return null;
        }
        const children = [...parent.children].filter(
            (element) => !element.hasAttribute('data-ntr-root'),
        );
        // Keep site-specific anchors here so layout changes do not affect the controls.
        if (page === 'workspace') {
            const section = children.find(
                (element) => element.matches('h2') || element.querySelector('h2'),
            );
            return {
                parent,
                before: section ?? children[children.indexOf(heading!) + 1] ?? null,
            };
        }
        const before =
            children.find((element) => element.matches('.n-pagination')) ??
            children.find((element) => element.matches('ul, [role="list"]')) ??
            null;
        return { parent, before };
    }

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
                !button.closest('[data-ntr-root]') &&
                Boolean(button.closest('.n-list-item .n-thing')) &&
                labels.some((label) => button.textContent?.trim() === label),
        );
    }
}

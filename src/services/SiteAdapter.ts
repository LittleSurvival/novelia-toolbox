import { listPage, listQuery, favoriteSort } from '../util/listQuery';
import { parseRecord } from '../util/record';
import { pageKind } from '../util/routes';

export class SiteAdapter {
    toolboxMountPoint(): { parent: HTMLElement; before: Element | null } | null {
        const page = pageKind(location.pathname);
        if (page === 'other') return null;
        if (page === 'wenku') {
            // The cover banner and the volume gallery are separate content containers.
            // Keep the toolbar immediately above the TOC (including the new tabbed UI).
            const toc =
                document.querySelector('.n-tabs-tab[data-name="wenkuToc"]') ??
                [
                    ...document.querySelectorAll(
                        '.layout-content h2, .layout-content h3, main h2, main h3',
                    ),
                ].find((heading) =>
                    ['目录', '目錄'].includes(heading.textContent?.trim() ?? ''),
                );
            const parent = toc?.closest<HTMLElement>('.layout-content, main');
            const before =
                parent && [...parent.children].find((child) => child.contains(toc!));
            return parent && before ? { parent, before } : null;
        }
        if (page === 'novel') {
            // Web novels have a fixed right-hand TOC. Stay inside the metadata column;
            // a toolbar spanning the outer layout would sit underneath that fixed TOC.
            const content = document.querySelector<HTMLElement>('.layout-content, main');
            if (!content?.querySelector('h1, h2, h3')) return null;
            const parent =
                content.querySelector<HTMLElement>('.metadata-stat')?.parentElement;
            if (!parent) return null;
            const children = [...parent.children].filter(
                (element) => !element.hasAttribute('data-ntr-root'),
            );
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
        // CPage has no pagination while loading, on errors or for a single page.
        // Anchor to its result region in every state, outside any loading wrapper.
        const results = '.n-pagination, .n-spin, .n-result, .n-empty, .n-list';
        const before =
            children.find(
                (element) => element.matches(results) || element.querySelector(results),
            ) ??
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

    runningWorkerIds(): string[] {
        return this.buttons('停止').map((button) => {
            const title = button
                .closest('.n-list-item')
                ?.querySelector('.n-thing-header__title');
            // Worker ID is header text; nested nodes contain model/endpoint/counters.
            return [...(title?.childNodes ?? [])]
                .filter((node) => node.nodeType === Node.TEXT_NODE)
                .map((node) => node.textContent ?? '')
                .join('')
                .trim();
        });
    }

    pipelineTranslating(): boolean {
        return [
            ...document.querySelectorAll('.task-list > .n-card .n-card-header .n-tag'),
        ].some((tag) => ['翻译中', '翻譯中'].includes(tag.textContent?.trim() ?? ''));
    }

    retryPipelineTasks(moveToTop: boolean, signal: AbortSignal): number {
        // Pipeline failures live in TaskState, not uncompletedJobs. Use the native
        // card actions so completed chapters and cached segments stay intact.
        const actions = [
            ...document.querySelectorAll('.task-list > .n-card .n-card-header'),
        ]
            .filter((header) => !header.closest('[data-ntr-root]'))
            .map((header) => ({
                retry: header.querySelector<HTMLButtonElement>(
                    'button.n-button--warning-type',
                ),
                // PipelineTaskCard renders top, bottom, retry (if failed), delete.
                top: header.querySelector<HTMLButtonElement>('button'),
            }))
            .filter((action) => action.retry && !action.retry.disabled);
        if (moveToTop) {
            for (const { top } of [...actions].reverse()) {
                signal.throwIfAborted();
                if (top?.isConnected && !top.disabled) top.click();
            }
        }
        let retried = 0;
        for (const { retry } of actions) {
            signal.throwIfAborted();
            if (!retry?.isConnected || retry.disabled) continue;
            retry.click();
            retried++;
        }
        return retried;
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

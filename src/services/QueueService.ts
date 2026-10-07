import type { TranslatorKind } from '../types/TranslatorKind';
import type { QueueOptions } from '../interfaces/QueueOptions';
import type { RunResult } from '../interfaces/RunResult';
import type { WorkspaceJob } from '../interfaces/WorkspaceJob';
import type { NovelTaskSource } from '../interfaces/NovelTaskSource';
import { ApiService } from './ApiService';
import { HttpError } from './HttpError';
import { WorkspaceService } from './WorkspaceService';
import { SiteAdapter } from './SiteAdapter';
import { pageKind, favoriteId } from '../util/routes';
import {
    apiPage,
    novelSources,
    novelDetailSource,
    volumeIds,
    favoredWenkuIds,
} from '../util/apiData';
import { allocateTasks } from '../util/taskAllocation';
import { wenkuTask } from '../util/taskLinks';
import { jobBookCount } from '../util/taskResults';
import { errorMessage } from '../util/async';

export class QueueService {
    constructor(
        private readonly api: ApiService,
        private readonly workspace: WorkspaceService,
        private readonly site: SiteAdapter,
    ) {}

    async queue(
        kind: TranslatorKind,
        options: QueueOptions,
        signal: AbortSignal,
    ): Promise<RunResult> {
        signal.throwIfAborted();
        let jobs: WorkspaceJob[];
        const failures: string[] = [];
        switch (pageKind(location.pathname)) {
            case 'wenku': {
                const id = location.pathname.split('/')[2];
                if (!id) {
                    throw new Error('找不到文庫小說 ID');
                }
                jobs = await this.wenkuJobs([id], options, signal, failures);
                break;
            }
            case 'wenkus':
                jobs = await this.wenkuJobs(
                    this.site.wenkuIds(options.wenkuLimit),
                    options,
                    signal,
                    failures,
                );
                break;
            case 'novel': {
                const url = location.pathname.slice('/novel'.length);
                const detail = await this.api.getJson(
                    `/api/novel${url}`,
                    signal,
                    options.authenticated,
                );
                jobs = allocateTasks([novelDetailSource(detail, kind, url)], options);
                break;
            }
            case 'novels': {
                const data = apiPage(
                    await this.api.getJson(
                        this.site.webSearchApi(options.webLimit),
                        signal,
                        options.authenticated,
                    ),
                );
                jobs = allocateTasks(novelSources(data.items, kind), options);
                break;
            }
            case 'favorite-web':
                jobs = allocateTasks(
                    await this.favoriteNovels(kind, options, signal),
                    options,
                );
                break;
            case 'favorite-wenku': {
                const ids = await this.favoriteWenkuIds(signal);
                jobs = await this.wenkuJobs(ids, options, signal, failures);
                break;
            }
            default:
                throw new Error('目前頁面不支援排隊');
        }
        signal.throwIfAborted();
        const added = jobs.length ? await this.workspace.addJobs(kind, jobs, signal) : [];
        const skipped = new Set(jobs.map((job) => job.task)).size - added.length;
        const books = jobBookCount(added);
        const status = failures.length
            ? added.length || skipped
                ? 'partial'
                : 'failed'
            : 'success';
        const summary = `新增 ${added.length} 個任務／${books} 本小說，跳過 ${skipped} 個已排任務`;
        const details = failures.length
            ? `；${failures.length} 本文庫失敗：${failures.slice(0, 3).join('；')}`
            : '';
        return {
            status,
            message: summary + details,
            added: added.length,
            skipped,
            books,
        };
    }

    private async wenkuJobs(
        ids: string[],
        options: QueueOptions,
        signal: AbortSignal,
        failures: string[],
    ): Promise<WorkspaceJob[]> {
        const jobs: WorkspaceJob[] = [];
        for (const id of new Set(ids)) {
            signal.throwIfAborted();
            try {
                const data = await this.api.getJson(
                    `/api/wenku/${encodeURIComponent(id)}`,
                    signal,
                    options.authenticated,
                );
                for (const volume of volumeIds(data)) {
                    jobs.push({
                        task: wenkuTask(
                            id,
                            volume,
                            options.mode,
                            options.useBrowserCrawler,
                        ),
                        description: volume,
                    });
                }
            } catch (error) {
                signal.throwIfAborted();
                if (
                    error instanceof HttpError &&
                    (error.status === 401 || error.status === 403)
                ) {
                    throw error;
                }
                failures.push(`${id}：${errorMessage(error)}`);
            }
        }
        return jobs;
    }

    private async favoriteNovels(
        kind: TranslatorKind,
        options: QueueOptions,
        signal: AbortSignal,
    ): Promise<NovelTaskSource[]> {
        const id = encodeURIComponent(favoriteId(new URL(location.href)));
        const search = location.search;
        const novels = new Map<string, NovelTaskSource>();
        for (let page = 0; ; page++) {
            const data = apiPage(
                await this.api.getJson(
                    `/api/user/favored-web/${id}?${this.site.favoriteWebQuery(search, page, 90)}`,
                    signal,
                ),
            );
            const batch = novelSources(data.items, kind);
            const before = novels.size;
            for (const novel of batch) {
                novels.set(novel.url, novel);
            }
            if (
                options.split === 'smart' &&
                [...novels.values()].filter(
                    (n) =>
                        n.total > 0 &&
                        (options.mode !== 'normal' || n.translated < n.total),
                ).length > options.jobLimit
            ) {
                throw new Error(
                    `收藏中的待排小說已超過任務上限 ${options.jobLimit}；請提高上限`,
                );
            }
            if (
                data.pageNumber !== undefined
                    ? page + 1 >= data.pageNumber
                    : data.items.length < 90
            ) {
                return [...novels.values()];
            }
            if (novels.size === before) {
                throw new Error('收藏 API 重複回傳同一頁，已停止擷取');
            }
        }
    }

    private async favoriteWenkuIds(signal: AbortSignal): Promise<string[]> {
        const id = encodeURIComponent(favoriteId(new URL(location.href)));
        const search = location.search;
        const ids = new Set<string>();
        for (let page = 0; ; page++) {
            const data = apiPage(
                await this.api.getJson(
                    `/api/user/favored-wenku/${id}?${this.site.favoriteWenkuQuery(search, page, 72)}`,
                    signal,
                ),
            );
            const before = ids.size;
            for (const novelId of favoredWenkuIds(data.items)) {
                ids.add(novelId);
            }
            if (
                data.pageNumber !== undefined
                    ? page + 1 >= data.pageNumber
                    : data.items.length < 72
            ) {
                return [...ids];
            }
            if (ids.size === before) {
                throw new Error('收藏 API 重複回傳同一頁，已停止擷取');
            }
        }
    }
}

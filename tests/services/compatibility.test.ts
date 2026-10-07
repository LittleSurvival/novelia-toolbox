import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../../src/services/AuthService';
import { ApiService } from '../../src/services/ApiService';
import { WorkspaceService } from '../../src/services/WorkspaceService';
import { QueueService } from '../../src/services/QueueService';
import { SiteAdapter } from '../../src/services/SiteAdapter';
import { webTask } from '../../src/util/taskLinks';
import type { QueueOptions } from '../../src/interfaces/QueueOptions';

const signal = () => new AbortController().signal;
const job = (id: string) => ({
    task: webTask(`/p/${id}`, 0, 10, 'normal'),
    description: id,
});
const options: QueueOptions = {
    webLimit: 20,
    wenkuLimit: 20,
    mode: 'normal',
    split: 'static',
    jobLimit: 1000,
    chapterMinimum: 5,
    parts: 1,
    authenticated: true,
    useBrowserCrawler: false,
};
const fixture = (id: string) => ({
    providerId: 'p',
    novelId: id,
    titleJp: 'same title',
    total: 10,
    gpt: 0,
});

describe('authentication and workspace compatibility', () => {
    it('reads and follows auth-v2 changes without resurrecting legacy sessions on logout', () => {
        const auth = new AuthService(localStorage);
        localStorage.setItem(
            'authInfo',
            JSON.stringify({ profile: { token: 'old-token' } }),
        );
        localStorage.setItem(
            'auth-v2',
            JSON.stringify({ token: 'new-token', adminMode: false }),
        );
        expect(auth.getToken()).toBe('new-token');
        localStorage.setItem('auth-v2', JSON.stringify({ token: 'rotated-token' }));
        expect(auth.getToken()).toBe('rotated-token');
        localStorage.removeItem('auth-v2');
        expect(auth.getToken()).toBeNull();
        localStorage.setItem('auth-v2', '{bad json');
        expect(auth.getToken()).toBeNull();
    });

    it('uses modern bearer credentials and does not retry unauthorized API calls', async () => {
        localStorage.setItem('auth-v2', JSON.stringify({ token: 'fixture-token' }));
        const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
        vi.stubGlobal('fetch', fetcher);
        const api = new ApiService(new AuthService(localStorage));
        await expect(api.getJson('/api/user/favored', signal())).rejects.toThrow('401');
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(fetcher.mock.calls[0]?.[1].headers).toEqual({
            Authorization: 'Bearer fixture-token',
        });
    });

    it('bounds transient API failures to three attempts', async () => {
        vi.useFakeTimers();
        const fetcher = vi.fn().mockRejectedValue(new TypeError('network fixture'));
        vi.stubGlobal('fetch', fetcher);
        const api = new ApiService(new AuthService(localStorage));
        const rejection = expect(
            api.getJson('/api/wenku/fixture', signal()),
        ).rejects.toThrow('network fixture');
        await vi.runAllTimersAsync();
        await rejection;
        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('preserves unpersisted Sakura defaults and unknown workspace fields', async () => {
        const workspace = new WorkspaceService(localStorage);
        await workspace.upsertWorkers(
            'sakura',
            [{ id: 'QA 1', endpoint: 'https://example.invalid' }],
            signal(),
        );
        expect(workspace.read('sakura').workers.map((worker) => worker.id)).toEqual([
            '共享',
            '本机',
            'AutoDL',
            'QA 1',
        ]);
        localStorage.setItem(
            'workspace-gpt',
            JSON.stringify({
                workers: [],
                jobs: [],
                uncompletedJobs: [],
                futureField: 'retained',
            }),
        );
        await workspace.addJobs('gpt', [job('one')], signal());
        expect(workspace.read('gpt').futureField).toBe('retained');
    });

    it('keeps protected worker names by substring while removing other workers', async () => {
        const workspace = new WorkspaceService(localStorage);
        await workspace.upsertWorkers(
            'gpt',
            [
                { id: '共享 1', endpoint: 'x' },
                { id: 'QA 1', endpoint: 'x' },
            ],
            signal(),
        );
        expect(await workspace.removeWorkers('gpt', ['共享'], signal())).toBe(1);
        expect(workspace.read('gpt').workers.map((worker) => worker.id)).toEqual([
            '共享 1',
        ]);
    });

    it('serializes competing updates and deduplicates each batch', async () => {
        const workspace = new WorkspaceService(localStorage);
        await Promise.all([
            workspace.addJobs('gpt', [job('a'), job('a')], signal()),
            workspace.addJobs('gpt', [job('b')], signal()),
        ]);
        expect(workspace.read('gpt').jobs).toHaveLength(2);
    });

    it('requeues finished entries and recognizes equivalent legacy queries', async () => {
        const workspace = new WorkspaceService(localStorage);
        localStorage.setItem(
            'workspace-gpt',
            JSON.stringify({
                workers: [],
                uncompletedJobs: [],
                jobs: [
                    { ...job('a'), finishAt: 123 },
                    {
                        task: 'web/p/b?level=normal&forceMetadata=false&startIndex=0&endIndex=10',
                        description: 'b',
                    },
                ],
            }),
        );
        const added = await workspace.addJobs('gpt', [job('a'), job('b')], signal());
        expect(added).toHaveLength(1);
        expect(workspace.read('gpt').jobs[0]?.finishAt).toBeUndefined();
        expect(workspace.read('gpt').jobs).toHaveLength(2);
    });

    it('bulk retries only unfinished records and moves them ahead of unrelated jobs', async () => {
        const workspace = new WorkspaceService(localStorage);
        localStorage.setItem(
            'workspace-gpt',
            JSON.stringify({
                workers: [],
                jobs: [job('existing')],
                uncompletedJobs: [
                    {
                        ...job('done'),
                        finishAt: 10,
                        progress: { finished: 10, total: 10, error: 0 },
                    },
                    {
                        ...job('failed'),
                        finishAt: 11,
                        progress: { finished: 3, total: 10, error: 7 },
                    },
                ],
            }),
        );
        expect(await workspace.retryUnfinishedJobs('gpt', true, signal())).toEqual({
            retried: 1,
            skipped: 0,
        });
        const state = workspace.read('gpt');
        expect(state.jobs.map((item) => item.description)).toEqual([
            'failed',
            'existing',
        ]);
        expect(state.jobs[0]?.finishAt).toBeUndefined();
        expect(state.uncompletedJobs.map((item) => item.description)).toEqual(['done']);
    });
});

describe('queue API integration', () => {
    it('continues favorite pagination using pageNumber even when pages are smaller than requested', async () => {
        history.replaceState(
            null,
            '',
            '/favorite/web/default?query=fixture&selected=8&selected=0&selected=0&selected=1&selected=1',
        );
        const api = new ApiService(new AuthService(localStorage));
        const request = vi.spyOn(api, 'getJson').mockImplementation(async (url) => {
            const params = new URL(url, location.origin).searchParams;
            return {
                pageNumber: 2,
                items: [fixture(params.get('page') === '0' ? 'a' : 'b')],
            };
        });
        const workspace = new WorkspaceService(localStorage);
        const result = await new QueueService(api, workspace, new SiteAdapter()).queue(
            'gpt',
            options,
            signal(),
        );
        expect(request).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({ added: 2, books: 2 });
        const first = new URL(request.mock.calls[0]![0], location.origin);
        expect(first.searchParams.get('query')).toBe('fixture');
        expect(first.searchParams.get('provider')).toBe('hameln');
        expect(first.searchParams.get('sort')).toBe('create');
    });

    it('queues GPT Wenku detail from its API without clicking Sakura controls', async () => {
        history.replaceState(null, '', '/wenku/book');
        const api = new ApiService(new AuthService(localStorage));
        vi.spyOn(api, 'getJson').mockResolvedValue({
            volumeJp: [{ volumeId: '卷?%/1.epub' }],
        });
        const workspace = new WorkspaceService(localStorage);
        await new QueueService(api, workspace, new SiteAdapter()).queue(
            'gpt',
            options,
            signal(),
        );
        expect(workspace.read('gpt').jobs[0]?.task).toContain(
            'wenku/book/%E5%8D%B7%3F%25%2F1.epub',
        );
        expect(workspace.read('sakura').jobs).toHaveLength(0);
    });

    it('queues web detail even when old translated-count DOM is absent', async () => {
        history.replaceState(null, '', '/novel/p/book');
        const api = new ApiService(new AuthService(localStorage));
        vi.spyOn(api, 'getJson').mockResolvedValue({
            titleJp: 'fixture',
            gpt: 1,
            toc: [{ titleJp: 'section' }, { chapterId: '1' }, { chapterId: '2' }],
        });
        const workspace = new WorkspaceService(localStorage);
        await new QueueService(api, workspace, new SiteAdapter()).queue(
            'gpt',
            options,
            signal(),
        );
        expect(workspace.read('gpt').jobs[0]?.task).toContain('startIndex=0&endIndex=2');
    });
});

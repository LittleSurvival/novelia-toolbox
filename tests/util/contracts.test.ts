import { describe, it, expect } from 'vitest';
import { webTask, wenkuTask, taskIdentity } from '../../src/util/taskLinks';
import { listQuery, listPage, favoriteSort } from '../../src/util/listQuery';
import { allocateTasks } from '../../src/util/taskAllocation';
import { novelDetailSource } from '../../src/util/apiData';
import type { QueueOptions } from '../../src/interfaces/QueueOptions';

const options: QueueOptions = {
    webLimit: 20,
    wenkuLimit: 20,
    mode: 'normal',
    split: 'smart',
    jobLimit: 1000,
    chapterMinimum: 5,
    parts: 6,
    authenticated: true,
    useBrowserCrawler: false,
};

describe('deployed task and list contracts', () => {
    it('encodes a Wenku filename so the site parser retains percent, slash and question marks', () => {
        const volume = '上巻 / 100% ? 完.epub';
        const task = wenkuTask('book', volume, 'expire');
        const [descriptor, search] = task.split('?');
        expect(decodeURIComponent(descriptor!.split('/')[2]!)).toBe(volume);
        expect(new URLSearchParams(search).get('level')).toBe('expire');
        expect(new URLSearchParams(search).get('useBrowserCrawler')).toBe('false');
    });

    it('deduplicates legacy tasks missing the new browser-crawler flag', () => {
        expect(
            taskIdentity(
                'web/p/n?level=normal&forceMetadata=false&startIndex=0&endIndex=20',
            ),
        ).toBe(taskIdentity(webTask('/p/n', 0, 20, 'normal')));
        expect(taskIdentity(webTask('/p/n', 0, 20, 'normal', true))).not.toBe(
            taskIdentity(webTask('/p/n', 0, 20, 'normal')),
        );
    });

    it('uses selected URL bitmask and category indices rather than hashed CSS classes', () => {
        const search =
            '?page=3&query=百合&selected=8&selected=2&selected=2&selected=1&selected=2';
        const params = listQuery(search, listPage(search), 50);
        expect(Object.fromEntries(params)).toEqual({
            page: '2',
            pageSize: '50',
            query: '百合',
            provider: 'hameln',
            type: '2',
            level: '2',
            translate: '1',
            sort: '2',
        });
    });

    it('respects both web and Wenku favorite sort indices', () => {
        expect(
            favoriteSort(
                '?selected=255&selected=0&selected=0&selected=0&selected=1',
                false,
            ),
        ).toBe('create');
        expect(favoriteSort('?selected=1', true, 0)).toBe('update');
        expect(favoriteSort('', true)).toBe('create');
    });

    it('counts actual chapters from detail DTO without requiring Baidu text', () => {
        expect(
            novelDetailSource(
                {
                    titleJp: 'Fixture',
                    gpt: 1,
                    toc: [{ titleJp: 'section' }, { chapterId: '1' }, { chapterId: '2' }],
                },
                'gpt',
                '/p/n',
            ),
        ).toMatchObject({ total: 2, translated: 1, description: 'Fixture' });
    });

    it('covers translation holes and clamps static task ranges', () => {
        const jobs = allocateTasks(
            [{ url: '/p/n', description: 'Fixture', total: 10, translated: 5 }],
            { ...options, split: 'static', parts: 6 },
        );
        const covered = jobs.flatMap((job) => {
            const params = new URLSearchParams(job.task.split('?')[1]);
            return Array.from(
                {
                    length:
                        Number(params.get('endIndex')) - Number(params.get('startIndex')),
                },
                (_, index) => Number(params.get('startIndex')) + index,
            );
        });
        expect(covered).toEqual(Array.from({ length: 10 }, (_, index) => index));
    });

    it('rejects a cap that would silently omit books and covers all books within a feasible cap', () => {
        const novels = [0, 1, 2].map((index) => ({
            url: `/p/${index}`,
            description: 'same title',
            total: 6,
            translated: 0,
        }));
        expect(() => allocateTasks(novels, { ...options, jobLimit: 2 })).toThrow(
            '超過任務上限',
        );
        const jobs = allocateTasks(novels, { ...options, jobLimit: 4 });
        expect(jobs.length).toBeLessThanOrEqual(4);
        expect(new Set(jobs.map((job) => job.task.split('?')[0])).size).toBe(3);
    });
});

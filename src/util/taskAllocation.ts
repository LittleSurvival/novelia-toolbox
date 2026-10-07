import type { NovelTaskSource } from '../interfaces/NovelTaskSource';
import type { QueueOptions } from '../interfaces/QueueOptions';
import type { WorkspaceJob } from '../interfaces/WorkspaceJob';
import { webTask } from './taskLinks';

export function allocateTasks(
    novels: NovelTaskSource[],
    options: QueueOptions,
): WorkspaceJob[] {
    const eligible = novels.filter(
        (n) => n.total > 0 && (options.mode !== 'normal' || n.translated < n.total),
    );
    if (!eligible.length) {
        return [];
    }
    if (options.split === 'static') {
        return eligible.flatMap((n) => splitNovel(n, options.parts, options));
    }
    if (eligible.length > options.jobLimit) {
        throw new Error(
            `共有 ${eligible.length} 本待排小說，超過任務上限 ${options.jobLimit}；請提高上限`,
        );
    }
    // Every book receives one slot first. Additional slots favor the largest remaining workload.
    const chapters = eligible.reduce((sum, novel) => sum + novel.total, 0);
    const budget = Math.min(
        options.jobLimit,
        Math.max(eligible.length, Math.floor(chapters / options.chapterMinimum)),
    );
    const slots = eligible.map(() => 1);
    for (let used = eligible.length; used < budget; used++) {
        let candidate = -1;
        let largest = 0;
        eligible.forEach((novel, index) => {
            const count = slots[index] ?? 1;
            if (count >= novel.total) {
                return;
            }
            const size = novel.total / count;
            if (size > largest) {
                candidate = index;
                largest = size;
            }
        });
        if (candidate < 0) {
            break;
        }
        slots[candidate] = (slots[candidate] ?? 1) + 1;
    }
    return eligible.flatMap((novel, index) =>
        splitNovel(novel, slots[index] ?? 1, options),
    );
}

function splitNovel(
    novel: NovelTaskSource,
    requested: number,
    options: QueueOptions,
): WorkspaceJob[] {
    const parts = Math.min(requested, novel.total);
    const result: WorkspaceJob[] = [];
    // Counts do not identify chapter positions. Cover the whole range; normal mode must skip translated chapters.
    for (let index = 0; index < parts; index++) {
        const start = Math.floor((index * novel.total) / parts);
        const end = Math.floor(((index + 1) * novel.total) / parts);
        result.push({
            task: webTask(novel.url, start, end, options.mode, options.useBrowserCrawler),
            description: novel.description,
        });
    }
    return result;
}

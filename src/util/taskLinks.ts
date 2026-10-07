import type { TranslateMode } from '../types/TranslateMode';

export function webTask(
    url: string,
    start: number,
    end: number,
    mode: TranslateMode,
    useBrowserCrawler = false,
): string {
    return `web${url}?level=${mode}&forceMetadata=false&useBrowserCrawler=${useBrowserCrawler}&startIndex=${start}&endIndex=${end}`;
}

export function wenkuTask(
    series: string,
    volume: string,
    mode: TranslateMode,
    useBrowserCrawler = false,
): string {
    return `wenku/${series}/${encodeURIComponent(volume)}?level=${mode}&forceMetadata=false&useBrowserCrawler=${useBrowserCrawler}&startIndex=0&endIndex=65536`;
}

export function taskIdentity(task: string): string {
    const separator = task.indexOf('?');
    const descriptor = separator < 0 ? task : task.slice(0, separator);
    const query = new URLSearchParams(separator < 0 ? '' : task.slice(separator + 1));
    if (!/^(web|wenku|local|personal|personal2)\//.test(descriptor)) {
        return task;
    }
    for (const [name, value] of [
        ['forceMetadata', 'false'],
        ['useBrowserCrawler', 'false'],
        ['startIndex', '0'],
        ['endIndex', '65535'],
    ]) {
        if (name && value && !query.has(name)) {
            query.set(name, value);
        }
    }
    query.sort();
    return `${descriptor}?${query}`;
}

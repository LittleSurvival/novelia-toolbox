import type { TranslateMode } from '../types/TranslateMode';

export interface QueueOptions {
    webLimit: number;
    wenkuLimit: number;
    mode: TranslateMode;
    split: 'smart' | 'static';
    jobLimit: number;
    chapterMinimum: number;
    parts: number;
    authenticated: boolean;
    useBrowserCrawler: boolean;
}

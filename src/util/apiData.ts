import type { TranslatorKind } from '../types/TranslatorKind';
import type { ApiPage } from '../interfaces/ApiPage';
import type { NovelTaskSource } from '../interfaces/NovelTaskSource';
import { finiteCount, isRecord } from './record';

export function apiPage(value: unknown): ApiPage {
    if (!isRecord(value) || !Array.isArray(value.items)) {
        throw new Error('小說列表回應格式不相容');
    }
    const pageNumber = value.pageNumber;
    if (
        pageNumber !== undefined &&
        (typeof pageNumber !== 'number' ||
            !Number.isSafeInteger(pageNumber) ||
            pageNumber < 0)
    ) {
        throw new Error('小說列表回應頁數不正確');
    }
    return { items: value.items, pageNumber };
}

export function novelDetailSource(
    value: unknown,
    kind: TranslatorKind,
    url: string,
): NovelTaskSource {
    if (!isRecord(value) || !Array.isArray(value.toc)) {
        throw new Error('小說回應缺少章節目錄');
    }
    return {
        url,
        description: String(value.titleZh ?? value.titleJp ?? url),
        total: value.toc.filter(
            (item) =>
                isRecord(item) &&
                typeof item.chapterId === 'string' &&
                item.chapterId.length > 0,
        ).length,
        translated: finiteCount(value[kind] ?? 0),
    };
}

export function novelSources(items: unknown[], kind: TranslatorKind): NovelTaskSource[] {
    return items.map((item) => {
        if (
            !isRecord(item) ||
            typeof item.providerId !== 'string' ||
            typeof item.novelId !== 'string'
        ) {
            throw new Error('小說回應缺少 providerId 或 novelId');
        }
        return {
            url: `/${item.providerId}/${item.novelId}`,
            description: String(item.titleZh ?? item.titleJp ?? item.novelId),
            total: finiteCount(item.total),
            translated: finiteCount(item[kind] ?? 0),
        };
    });
}

export function volumeIds(value: unknown): string[] {
    if (!isRecord(value) || !Array.isArray(value.volumeJp)) {
        throw new Error('文庫回應缺少 volumeJp');
    }
    return [
        ...new Set(
            value.volumeJp.map((volume) => {
                if (!isRecord(volume) || typeof volume.volumeId !== 'string') {
                    throw new Error('文庫回應缺少 volumeId');
                }
                return volume.volumeId;
            }),
        ),
    ];
}

export function favoredWenkuIds(items: unknown[]): string[] {
    return [
        ...new Set(
            items.map((item) => {
                if (!isRecord(item) || typeof item.id !== 'string') {
                    throw new Error('收藏文庫回應缺少 id');
                }
                return item.id;
            }),
        ),
    ];
}

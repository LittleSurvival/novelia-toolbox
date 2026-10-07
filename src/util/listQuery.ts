export function listQuery(search: string, page: number, limit: number): URLSearchParams {
    const route = new URLSearchParams(search);
    const selected = route.getAll('selected');
    const mask = selectedNumber(selected[0], 255);
    const providers = [
        'kakuyomu',
        'syosetu',
        'novelup',
        'hameln',
        'pixiv',
        'alphapolis',
    ].filter((_, index) => (mask & (1 << index)) !== 0);
    return new URLSearchParams({
        page: String(page),
        pageSize: String(limit),
        query: route.get('query') ?? '',
        provider: providers.join(','),
        type: String(selectedNumber(selected[1], 0)),
        level: String(selectedNumber(selected[2], 0)),
        translate: String(selectedNumber(selected[3], 0)),
        sort: String(selectedNumber(selected[4], 0)),
    });
}

export function listPage(search: string): number {
    return Math.max(
        0,
        selectedNumber(new URLSearchParams(search).get('page') ?? undefined, 1) - 1,
    );
}

export function favoriteSort(
    search: string,
    createTimeFirst: boolean,
    offset = 4,
): string {
    const index = selectedNumber(
        new URLSearchParams(search).getAll('selected')[offset],
        0,
    );
    return index === 0
        ? createTimeFirst
            ? 'create'
            : 'update'
        : createTimeFirst
          ? 'update'
          : 'create';
}

function selectedNumber(value: string | undefined, fallback: number): number {
    const parsed = value === undefined || value === '' ? NaN : Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

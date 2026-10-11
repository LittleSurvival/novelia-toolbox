import type { PageKind } from '../types/PageKind';
import type { TranslatorKind } from '../types/TranslatorKind';
import type { WorkerWorkspaceKind } from '../types/WorkerWorkspaceKind';

export function allowedHost(hostname: string): boolean {
    return ['books.fishhawk.top', 'books1.fishhawk.top', 'n.novelia.cc'].includes(
        hostname,
    );
}

export function pageKind(pathname: string): PageKind {
    const path = pathname.replace(/\/+$/, '') || '/';
    if (path === '/wenku') {
        return 'wenkus';
    }
    if (path.startsWith('/wenku/')) {
        return 'wenku';
    }
    if (path === '/novel') {
        return 'novels';
    }
    if (path.startsWith('/novel/')) {
        return 'novel';
    }
    if (/^\/favorite\/web(?:\/|$)/.test(path)) {
        return 'favorite-web';
    }
    if (/^\/favorite\/wenku(?:\/|$)/.test(path)) {
        return 'favorite-wenku';
    }
    if (workspaceKind(path)) {
        return 'workspace';
    }
    return 'other';
}

export function workspaceKind(pathname: string): TranslatorKind | null {
    const match = /^\/workspace\/(sakura|gpt)(?:-pipeline)?\/?$/.exec(pathname);
    return match?.[1] === 'sakura' ? 'sakura' : match?.[1] === 'gpt' ? 'gpt' : null;
}

export function isPipelineWorkspace(pathname: string): boolean {
    return /^\/workspace\/(sakura|gpt)-pipeline\/?$/.test(pathname);
}

export function workerWorkspaceKind(pathname: string): WorkerWorkspaceKind | null {
    const kind = workspaceKind(pathname);
    return kind === 'gpt' && isPipelineWorkspace(pathname) ? 'gpt-pipeline' : kind;
}

export function queueSupported(pathname: string): boolean {
    return [
        'wenkus',
        'wenku',
        'novels',
        'novel',
        'favorite-web',
        'favorite-wenku',
    ].includes(pageKind(pathname));
}

export function favoriteId(url: URL): string {
    const path = url.pathname.replace(/\/+$/, '');
    return /^\/favorite\/(web|wenku)$/.test(path)
        ? 'default'
        : decodeURIComponent(path.split('/').pop() ?? 'default');
}

import { expect, it } from 'vitest';
import { build } from 'vite';
import type { RuntimeWindow } from '../../src/types/RuntimeWindow';

it('ships shadow styles without document-scoped light/dark polyfill dependencies', async () => {
    const result = await build({
        configFile: 'vite.config.ts',
        logLevel: 'silent',
        build: { write: false },
    });
    const bundles = Array.isArray(result) ? result : [result];
    const script = bundles
        .flatMap((bundle) => ('output' in bundle ? bundle.output : []))
        .find(
            (output) => output.type === 'chunk' && output.fileName.endsWith('.user.js'),
        );
    expect(script?.type).toBe('chunk');
    if (script?.type !== 'chunk') throw new Error('Missing production userscript');

    history.replaceState(null, '', '/novel');
    document.body.innerHTML =
        '<main style="--n-color: rgb(16, 16, 20)"><h1>网络小说</h1><div class="n-pagination"></div></main>';
    const runtime = window as RuntimeWindow;
    try {
        window.eval(script.code);
        const host = document.querySelector<HTMLElement>('#ntr-web-novel');
        expect(host?.dataset.theme).toBe('dark');
        const css = host?.shadowRoot?.querySelector('style')?.textContent;
        expect(css).toBeTruthy();
        // These document-level flags are not initialized inside a shadow root.
        expect(css).not.toContain('--lightningcss-');
        expect(css).toContain('--queue-line:#303038');
        expect(css).toContain('--queue-green:#63e2b7');
    } finally {
        runtime._NoveliaToolBoxApp?.dispose();
        delete runtime._NoveliaToolBoxApp;
        delete runtime._NTRToolBoxInstance;
    }
});

it('ships beta workspace routing and refreshes GPT worker and job stores separately', async () => {
    const result = await build({
        configFile: 'vite.config.ts',
        logLevel: 'silent',
        build: { write: false },
    });
    const bundles = Array.isArray(result) ? result : [result];
    const script = bundles
        .flatMap((bundle) => ('output' in bundle ? bundle.output : []))
        .find(
            (output) => output.type === 'chunk' && output.fileName.endsWith('.user.js'),
        );
    if (script?.type !== 'chunk') throw new Error('Missing production userscript');
    history.replaceState(null, '', '/workspace/gpt-pipeline');
    document.body.innerHTML =
        '<main data-theme="dark"><div class="layout-content"><div id="title-row"><h1>GPT工作区</h1><button>本地书架</button></div><div class="notice">公告</div><section id="workers"><h2>翻译器</h2></section></div></main>';
    const stored = JSON.stringify({ workers: [], jobs: [], uncompletedJobs: [] });
    localStorage.setItem('workspace-gpt', stored);
    localStorage.setItem('workspace-gpt-pipeline', stored);
    const events: string[] = [];
    const listener = (event: StorageEvent) => events.push(event.key!);
    window.addEventListener('storage', listener);
    const runtime = window as RuntimeWindow;
    try {
        window.eval(script.code);
        const host = document.querySelector('#ntr-web-novel')!;
        expect(host.parentElement?.className).toBe('layout-content');
        expect(host.getAttribute('data-theme')).toBe('dark');
        expect(host.nextElementSibling?.id).toBe('workers');
        expect(host.shadowRoot?.querySelectorAll('.module-tabs button')).toHaveLength(4);
        expect(events).toEqual(['workspace-gpt', 'workspace-gpt-pipeline']);
        expect(localStorage.getItem('workspace-gpt')).toBe(stored);
        expect(localStorage.getItem('workspace-gpt-pipeline')).toBe(stored);
    } finally {
        window.removeEventListener('storage', listener);
        runtime._NoveliaToolBoxApp?.dispose();
        delete runtime._NoveliaToolBoxApp;
        delete runtime._NTRToolBoxInstance;
    }
});

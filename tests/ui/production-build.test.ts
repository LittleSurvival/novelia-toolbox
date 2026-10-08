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

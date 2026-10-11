import { expect, it, vi } from 'vitest';
import { AddGPTTranslatorModule } from '../../src/modules/AddGPTTranslatorModule';
import { AddSakuraTranslatorModule } from '../../src/modules/AddSakuraTranslatorModule';
import { DeleteTranslatorModule } from '../../src/modules/DeleteTranslatorModule';
import { LaunchTranslatorModule } from '../../src/modules/LaunchTranslatorModule';
import { AutoRetryModule } from '../../src/modules/AutoRetryModule';
import { WorkspaceService } from '../../src/services/WorkspaceService';
import { TranslatorService } from '../../src/services/TranslatorService';
import { SiteAdapter } from '../../src/services/SiteAdapter';
import { pageKind, workspaceKind, workerWorkspaceKind } from '../../src/util/routes';

const context = () => ({ signal: new AbortController().signal, automatic: false });
const data = (id: string) => ({
    workers: [{ id, endpoint: 'https://example.invalid' }],
    jobs: [{ task: 'web/p/n', description: 'fixture' }],
    uncompletedJobs: [],
    extra: 'keep',
});
const worker = (id: string, running = false) =>
    `<li class="n-list-item"><div class="n-thing"><div class="n-thing-header__title">${id}<span class="n-text">model@endpoint</span><span class="viz-translator">0/3</span></div><button>${running ? '停止' : '启动'}</button></div></li>`;
const taskCard = (id: string, failed = true, translating = false) =>
    `<div class="n-card" id="${id}"><div class="n-card-header"><a class="task-link">web/p/${id}</a><span class="n-tag">${translating ? '翻译中' : '等待中'}</span><button class="top"></button><button class="bottom"></button>${failed ? '<button class="n-button--warning-type"></button>' : ''}<button class="n-button--error-type"></button></div></div>`;

it.each(['gpt', 'sakura'])(
    'recognizes %s classic and beta routes without accepting unrelated paths',
    (kind) => {
        for (const suffix of ['', '/', '-pipeline', '-pipeline/']) {
            const path = `/workspace/${kind}${suffix}`;
            expect(workspaceKind(path)).toBe(kind);
            expect(pageKind(path)).toBe('workspace');
            expect(workerWorkspaceKind(path)).toBe(
                kind === 'gpt' && suffix.startsWith('-pipeline') ? 'gpt-pipeline' : kind,
            );
        }
        for (const suffix of ['-beta', '-pipeline/other', '/other'])
            expect(workspaceKind(`/workspace/${kind}${suffix}`)).toBeNull();
    },
);

it('adds and deletes GPT beta workers without changing classic workers or shared jobs', async () => {
    history.replaceState(null, '', '/workspace/gpt-pipeline');
    const classic = JSON.stringify(data('classic'));
    localStorage.setItem('workspace-gpt', classic);
    const beta = data('protected');
    beta.workers.push({ id: 'NTR translator 1', endpoint: 'old' });
    Object.assign(beta.workers[1]!, {
        profile: { id: 'openai', values: { custom: true } },
        future: 42,
    });
    localStorage.setItem('workspace-gpt-pipeline', JSON.stringify(beta));
    const service = new WorkspaceService(localStorage);
    const add = new AddGPTTranslatorModule(service);
    add.settings.find((s) => s.name === '數量')!.value = 2;
    add.settings.find((s) => s.name === '並發數')!.value = 3;
    const events: string[] = [];
    const listener = (e: StorageEvent) => events.push(e.key!);
    window.addEventListener('storage', listener);
    try {
        expect(add.supports(location.pathname)).toBe(true);
        await add.execute(context());
        const saved = service.read('gpt-pipeline');
        expect(saved.workers).toHaveLength(3);
        expect(saved.workers[1]).toMatchObject({
            concurrency: 3,
            profile: { id: 'openai', values: { custom: true } },
            future: 42,
        });
        expect(saved.workers[2]).toMatchObject({
            concurrency: 3,
            key: 'sk-wait-for-input',
            model: 'deepseek-chat',
        });
        expect(saved.jobs).toEqual(beta.jobs);
        expect(saved.extra).toBe('keep');
        const remove = new DeleteTranslatorModule(service);
        remove.settings.find((s) => s.name === '排除')!.value = 'protected';
        await remove.execute(context());
        expect(service.read('gpt-pipeline').workers.map((w) => w.id)).toEqual([
            'protected',
        ]);
        expect(events).toEqual(['workspace-gpt-pipeline', 'workspace-gpt-pipeline']);
        expect(localStorage.getItem('workspace-gpt')).toBe(classic);
        await service.addJobs(
            'gpt',
            [{ task: 'web/p/new', description: 'new' }],
            context().signal,
        );
        expect(service.read('gpt').jobs).toHaveLength(2);
        expect(service.read('gpt-pipeline').jobs).toEqual(beta.jobs);
    } finally {
        window.removeEventListener('storage', listener);
    }
});

it('shares Sakura workers with classic and validates beta concurrency before writing', async () => {
    history.replaceState(null, '', '/workspace/sakura-pipeline');
    const service = new WorkspaceService(localStorage);
    const add = new AddSakuraTranslatorModule(service);
    add.settings.find((s) => s.name === '數量')!.value = 1;
    const concurrency = add.settings.find((s) => s.name === '並發數')!;
    for (const value of [0, 1.5, 101]) {
        concurrency.value = value;
        await expect(add.execute(context())).rejects.toThrow('並發數');
        expect(localStorage.getItem('workspace-sakura')).toBeNull();
    }
    concurrency.value = 4;
    await add.execute(context());
    expect(service.read('sakura').workers).toHaveLength(4);
    expect(service.read('sakura').workers[3]).toMatchObject({
        concurrency: 4,
        segLength: 500,
        prevSegLength: 500,
    });
    expect(localStorage.getItem('workspace-sakura-pipeline')).toBeNull();
    history.replaceState(null, '', '/workspace/sakura');
    concurrency.value = 999; // Hidden beta option must not affect classic actions.
    await add.execute(context());
    expect(service.read('sakura').workers[3]?.concurrency).toBe(4);
});

it('refuses to overwrite or delete active beta workers, preserving the whole stored batch', async () => {
    history.replaceState(null, '', '/workspace/gpt-pipeline');
    document.body.innerHTML = `<ul class="worker-list">${worker('busy', true)}</ul>`;
    const stored = JSON.stringify(data('busy'));
    localStorage.setItem('workspace-gpt-pipeline', stored);
    const service = new WorkspaceService(localStorage);
    await expect(
        service.upsertWorkers(
            'gpt-pipeline',
            [
                { id: 'new', endpoint: 'x' },
                { id: 'busy', endpoint: 'x' },
            ],
            context().signal,
        ),
    ).rejects.toThrow('先停止');
    await expect(
        service.removeWorkers('gpt-pipeline', [], context().signal),
    ).rejects.toThrow('先停止');
    expect(localStorage.getItem('workspace-gpt-pipeline')).toBe(stored);
    await service.upsertWorkers(
        'gpt-pipeline',
        [{ id: 'new', endpoint: 'x' }],
        context().signal,
    );
    expect(await service.removeWorkers('gpt-pipeline', ['busy'], context().signal)).toBe(
        1,
    );
});

it.each(['gpt', 'sakura'])(
    'launches individual %s beta workers with exclusions and a maximum',
    async (kind) => {
        vi.useFakeTimers();
        history.replaceState(null, '', `/workspace/${kind}-pipeline`);
        document.body.innerHTML = `<button id="all">启动全部</button><ul class="worker-list">${worker('keep')}${worker('one')}${worker('two')}${worker('already', true)}</ul><button id="unrelated">启动</button>`;
        const site = new SiteAdapter();
        const clicked: string[] = [];
        document.querySelectorAll('button').forEach((button) =>
            button.addEventListener('click', () => {
                clicked.push(button.closest('.n-list-item')?.textContent ?? button.id);
                button.textContent = '停止';
            }),
        );
        const operation = new TranslatorService(site).launch(
            {
                exclusions: ['keep'],
                maximum: 1,
                interval: 10,
                avoidEmpty: true,
                automatic: false,
            },
            context().signal,
        );
        await vi.runAllTimersAsync();
        expect(await operation).toBe(1);
        expect(clicked).toHaveLength(1);
        expect(clicked[0]).toContain('one');
        expect(site.runningCount()).toBe(2);
    },
);

it.each(['gpt', 'sakura'])(
    'retries only visible failed %s beta cards while idle workers stay started',
    async (kind) => {
        vi.useFakeTimers();
        history.replaceState(null, '', `/workspace/${kind}-pipeline`);
        const stored = JSON.stringify({
            ...data('old'),
            uncompletedJobs: [{ task: 'web/old/failure', description: 'classic record' }],
        });
        localStorage.setItem(`workspace-${kind}`, stored);
        document.body.innerHTML = `<ul class="worker-list">${worker('idle', true)}</ul><button id="global">重试失败任务</button><div class="task-list">${taskCard('one')}${taskCard('two')}${taskCard('done', false)}</div>`;
        const actions: string[] = [];
        document
            .querySelectorAll('button')
            .forEach((button) =>
                button.addEventListener('click', () =>
                    actions.push(
                        `${button.closest('.n-card')?.id ?? 'global'}:${button.className}`,
                    ),
                ),
            );
        const site = new SiteAdapter();
        const translators = new TranslatorService(site);
        const launch = new LaunchTranslatorModule(translators);
        const operation = vi.spyOn(translators, 'launch').mockResolvedValue(0);
        const service = new WorkspaceService(localStorage);
        const legacyRetry = vi.spyOn(service, 'retryUnfinishedJobs');
        const retry = new AutoRetryModule(site, translators, launch.settings, service);
        retry.settings.find((s) => s.name === '置頂重試任務')!.value = true;
        retry.settings.find((s) => s.name === '重啟翻譯器')!.value = false;
        retry.settings.find((s) => s.name === '最大重試次數')!.value = 1;
        try {
            const result = await retry.execute(context());
            expect(result.message).toContain('2 個 beta 任務');
            expect(actions).toEqual([
                'two:top',
                'one:top',
                'one:n-button--warning-type',
                'two:n-button--warning-type',
            ]);
            await retry.execute(context());
            await vi.advanceTimersByTimeAsync(60000);
            await retry.execute(context());
            expect(actions).toHaveLength(4);
            expect(operation).not.toHaveBeenCalled();
            expect(legacyRetry).not.toHaveBeenCalled();
            expect(localStorage.getItem(`workspace-${kind}`)).toBe(stored);
        } finally {
            retry.dispose();
        }
    },
);

it('waits for active beta chapters, then retries and optionally restarts stopped workers', async () => {
    history.replaceState(null, '', '/workspace/gpt-pipeline');
    document.body.innerHTML = `<div class="task-list">${taskCard('one', true, true)}</div>`;
    const site = new SiteAdapter();
    const translators = new TranslatorService(site);
    const operation = vi.spyOn(translators, 'launch').mockResolvedValue(1);
    const retry = new AutoRetryModule(
        site,
        translators,
        new LaunchTranslatorModule(translators).settings,
        new WorkspaceService(localStorage),
    );
    const clicked = vi.fn();
    document
        .querySelector('button.n-button--warning-type')!
        .addEventListener('click', clicked);
    try {
        await retry.execute(context());
        expect(clicked).not.toHaveBeenCalled();
        document.querySelector('.n-tag')!.textContent = '等待中';
        await retry.execute(context());
        expect(clicked).toHaveBeenCalledOnce();
        expect(operation).toHaveBeenCalledOnce();
    } finally {
        retry.dispose();
    }
});

it('does not trigger native retry or top actions after cancellation', () => {
    document.body.innerHTML = `<div class="task-list">${taskCard('one')}</div>`;
    const click = vi.fn();
    document
        .querySelectorAll('button')
        .forEach((b) => b.addEventListener('click', click));
    const controller = new AbortController();
    controller.abort();
    expect(() => new SiteAdapter().retryPipelineTasks(true, controller.signal)).toThrow();
    expect(click).not.toHaveBeenCalled();
});

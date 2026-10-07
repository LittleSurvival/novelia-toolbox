import { ModuleRegistry } from '../core/ModuleRegistry';
import { ModuleRunner } from '../core/ModuleRunner';
import { typingEvent } from '../util/keyboard';

export class KeyboardBindings {
    private readonly onKey = (event: KeyboardEvent) => {
        if (
            event.defaultPrevented ||
            event.repeat ||
            event.isComposing ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            typingEvent(event)
        ) {
            return;
        }
        const key = event.key.toLowerCase();
        for (const module of this.registry.modules) {
            const bind = module.settings.find(
                (setting) => setting.name === 'bind',
            )?.value;
            if (
                typeof bind === 'string' &&
                bind !== 'none' &&
                bind.toLowerCase() === key &&
                module.supports(location.pathname)
            ) {
                event.preventDefault();
                this.runner.activate(module);
            }
        }
    };

    constructor(
        private readonly registry: ModuleRegistry,
        private readonly runner: ModuleRunner,
    ) {}

    start(): void {
        document.addEventListener('keydown', this.onKey);
    }

    dispose(): void {
        document.removeEventListener('keydown', this.onKey);
    }
}

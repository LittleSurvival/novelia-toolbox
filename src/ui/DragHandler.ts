import { SettingsService } from '../services/SettingsService';

export class DragHandler {
    private readonly lifetime = new AbortController();
    private pointerId: number | null = null;
    private offsetX = 0;
    private offsetY = 0;
    private startX = 0;
    private startY = 0;
    private moved = false;
    private blockedUntil = 0;
    private layoutFrame: number | null = null;

    constructor(
        private readonly panel: HTMLElement,
        private readonly handle: HTMLElement,
        private readonly settings: SettingsService,
    ) {
        const options = { signal: this.lifetime.signal };
        handle.addEventListener(
            'pointerdown',
            (event) => {
                if (
                    event.button !== 0 ||
                    (event.target instanceof Element && event.target.closest('button'))
                ) {
                    return;
                }
                const rect = panel.getBoundingClientRect();
                this.pointerId = event.pointerId;
                this.offsetX = event.clientX - rect.left;
                this.offsetY = event.clientY - rect.top;
                this.startX = event.clientX;
                this.startY = event.clientY;
                this.moved = false;
                handle.setPointerCapture(event.pointerId);
            },
            options,
        );
        handle.addEventListener(
            'pointermove',
            (event) => {
                if (event.pointerId !== this.pointerId) {
                    return;
                }
                this.moved ||=
                    Math.abs(event.clientX - this.startX) +
                        Math.abs(event.clientY - this.startY) >
                    5;
                if (this.moved) {
                    panel.style.left = `${event.clientX - this.offsetX}px`;
                    panel.style.top = `${event.clientY - this.offsetY}px`;
                    this.clamp();
                }
            },
            options,
        );
        handle.addEventListener(
            'pointerup',
            (event) => {
                if (event.pointerId !== this.pointerId) {
                    return;
                }
                this.pointerId = null;
                if (this.moved) {
                    this.blockedUntil = Date.now() + 400;
                    this.settings.savePosition({
                        left: panel.style.left,
                        top: panel.style.top,
                    });
                }
                if (handle.hasPointerCapture(event.pointerId)) {
                    handle.releasePointerCapture(event.pointerId);
                }
            },
            options,
        );
        handle.addEventListener(
            'pointercancel',
            () => {
                this.pointerId = null;
            },
            options,
        );
        window.addEventListener('resize', () => this.clamp(), options);
        this.layoutFrame = requestAnimationFrame(() => {
            this.layoutFrame = null;
            if (!this.lifetime.signal.aborted) {
                this.clamp();
            }
        });
    }

    clickAfterDrag(): boolean {
        return Date.now() < this.blockedUntil;
    }

    clamp(): void {
        const rect = this.panel.getBoundingClientRect();
        if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            getComputedStyle(this.panel).position !== 'fixed'
        ) {
            return;
        }
        const left = Math.min(
            Math.max(rect.left, 0),
            Math.max(0, window.innerWidth - rect.width),
        );
        const top = Math.min(
            Math.max(rect.top, 0),
            Math.max(0, window.innerHeight - rect.height),
        );
        this.panel.style.left = `${left}px`;
        this.panel.style.top = `${top}px`;
    }

    dispose(): void {
        if (this.layoutFrame !== null) {
            cancelAnimationFrame(this.layoutFrame);
        }
        if (this.pointerId !== null && this.handle.hasPointerCapture(this.pointerId)) {
            this.handle.releasePointerCapture(this.pointerId);
        }
        this.pointerId = null;
        this.lifetime.abort();
    }
}

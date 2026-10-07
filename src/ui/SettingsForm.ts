import type { SettingDefinition } from '../interfaces/SettingDefinition';
import { NotificationView } from './NotificationView';

export class SettingsForm {
    private readonly lifetime = new AbortController();
    private pendingSetting: SettingDefinition | null = null;
    private pendingButton: HTMLButtonElement | null = null;
    private readonly captureKey = (event: KeyboardEvent) => {
        if (
            !this.pendingSetting ||
            event.isComposing ||
            ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)
        ) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        this.pendingSetting.value =
            event.key === 'Escape' ? 'none' : event.key.toLowerCase();
        this.cancelCapture();
        this.save();
    };

    constructor(
        private readonly onSave: () => void,
        private readonly notifications: NotificationView,
    ) {
        document.addEventListener('keydown', this.captureKey, {
            capture: true,
            signal: this.lifetime.signal,
        });
    }

    render(settings: SettingDefinition[]): HTMLDivElement {
        const form = document.createElement('div');
        form.className = 'ntr-settings-container';
        form.hidden = true;
        for (const setting of settings) {
            const row = document.createElement('label');
            row.className = 'ntr-setting-row';
            const caption = document.createElement('span');
            caption.textContent =
                setting.name === '擷取單頁wenku數量(deving)'
                    ? '擷取單頁文庫數量'
                    : setting.name;
            row.append(caption, this.input(setting));
            form.append(row);
        }
        return form;
    }

    dispose(): void {
        this.cancelCapture();
        this.lifetime.abort();
    }

    private input(setting: SettingDefinition): HTMLElement {
        if (setting.name === 'bind') {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = this.bindLabel(setting);
            button.addEventListener(
                'click',
                () => {
                    this.cancelCapture();
                    this.pendingSetting = setting;
                    this.pendingButton = button;
                    button.textContent = '請按按鍵（Esc 清除）';
                },
                { signal: this.lifetime.signal },
            );
            return button;
        }
        if (setting.type === 'select') {
            const select = document.createElement('select');
            for (const value of setting.options ?? []) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.append(option);
            }
            select.value = String(setting.value);
            select.addEventListener(
                'change',
                () => {
                    setting.value = select.value;
                    this.save();
                },
                { signal: this.lifetime.signal },
            );
            return select;
        }
        const input = document.createElement('input');
        input.type =
            setting.type === 'boolean'
                ? 'checkbox'
                : setting.type === 'number'
                  ? 'number'
                  : setting.name === 'Key'
                    ? 'password'
                    : 'text';
        if (setting.type === 'boolean') {
            input.checked = setting.value === true;
        } else {
            input.value = String(setting.value);
        }
        if (setting.type === 'number') {
            input.min = String(setting.min ?? 0);
            input.step = '1';
        }
        const commitInput = (reportInvalid: boolean) => {
            if (setting.type === 'number') {
                const value = input.valueAsNumber;
                if (!Number.isSafeInteger(value) || value < (setting.min ?? 0)) {
                    if (reportInvalid) {
                        this.notifications.error(
                            new Error(
                                `${setting.name} 必須是大於等於 ${setting.min ?? 0} 的整數`,
                            ),
                        );
                        input.value = String(setting.value);
                    }
                    return;
                }
                setting.value = value;
            } else {
                setting.value = setting.type === 'boolean' ? input.checked : input.value;
            }
            this.save();
        };
        input.addEventListener('input', () => commitInput(false), {
            signal: this.lifetime.signal,
        });
        input.addEventListener('change', () => commitInput(true), {
            signal: this.lifetime.signal,
        });
        return input;
    }

    private bindLabel(setting: SettingDefinition): string {
        return setting.value === 'none'
            ? '(None)'
            : `[${String(setting.value).toUpperCase()}]`;
    }

    private cancelCapture(): void {
        if (this.pendingButton && this.pendingSetting) {
            this.pendingButton.textContent = this.bindLabel(this.pendingSetting);
        }
        this.pendingButton = null;
        this.pendingSetting = null;
    }

    private save(): void {
        try {
            this.onSave();
        } catch (error) {
            this.notifications.error(error);
        }
    }
}

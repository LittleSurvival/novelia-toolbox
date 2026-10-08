import type { SettingDefinition } from '../interfaces/SettingDefinition';
import { NotificationView } from './NotificationView';

export class SettingsForm {
    private readonly lifetime = new AbortController();
    private pendingSetting: SettingDefinition | null = null;
    private pendingButton: HTMLButtonElement | null = null;
    private readonly fields: {
        setting: SettingDefinition;
        settings: SettingDefinition[];
        row: HTMLElement;
    }[] = [];
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
        private readonly selectStyle: 'native' | 'segments' = 'native',
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
            const row = document.createElement(
                setting.type === 'select' && this.selectStyle === 'segments'
                    ? 'div'
                    : 'label',
            );
            row.className = 'ntr-setting-row';
            row.dataset.setting = setting.name;
            row.dataset.type = setting.type;
            const caption = document.createElement('span');
            caption.textContent =
                setting.label ??
                (setting.name === 'bind'
                    ? '快捷鍵'
                    : setting.name === '擷取單頁wenku數量(deving)'
                      ? '擷取單頁文庫數量'
                      : setting.name);
            row.append(caption, this.input(setting));
            if (setting.description) {
                const description = document.createElement('small');
                description.textContent = setting.description;
                row.append(description);
            }
            form.append(row);
            this.fields.push({ setting, settings, row });
        }
        this.refreshVisibility();
        return form;
    }

    refreshVisibility(): void {
        for (const { setting, settings, row } of this.fields) {
            row.hidden = setting.visible?.(settings, location.pathname) === false;
            if (row.hidden && this.pendingSetting === setting) {
                this.cancelCapture();
            }
        }
    }

    dispose(): void {
        this.cancelCapture();
        this.lifetime.abort();
        this.fields.length = 0;
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
            if (this.selectStyle === 'segments') {
                return this.enumButtons(setting);
            }
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
            input.required = true;
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

    private enumButtons(setting: SettingDefinition): HTMLElement {
        const group = document.createElement('div');
        group.className = 'ntr-enum';
        group.setAttribute('role', 'radiogroup');
        group.setAttribute('aria-label', setting.label ?? setting.name);
        const options = setting.options ?? [];
        group.style.setProperty('--enum-count', String(options.length));
        const buttons: HTMLButtonElement[] = [];
        const update = () => {
            const selected = options.indexOf(String(setting.value));
            group.style.setProperty('--enum-index', String(Math.max(0, selected)));
            buttons.forEach((button, index) => {
                button.setAttribute('aria-checked', String(index === selected));
                button.tabIndex = index === selected ? 0 : -1;
            });
        };
        const select = (index: number) => {
            setting.value = options[index]!;
            update();
            this.save();
        };
        options.forEach((value, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = value;
            button.setAttribute('role', 'radio');
            button.addEventListener('click', () => select(index), {
                signal: this.lifetime.signal,
            });
            button.addEventListener(
                'keydown',
                (event) => {
                    let next: number;
                    switch (event.key) {
                        case 'ArrowRight':
                        case 'ArrowDown':
                            next = (index + 1) % options.length;
                            break;
                        case 'ArrowLeft':
                        case 'ArrowUp':
                            next = (index + options.length - 1) % options.length;
                            break;
                        case 'Home':
                            next = 0;
                            break;
                        case 'End':
                            next = options.length - 1;
                            break;
                        default:
                            return;
                    }
                    event.preventDefault();
                    select(next);
                    buttons[next]!.focus();
                },
                { signal: this.lifetime.signal },
            );
            buttons.push(button);
            group.append(button);
        });
        update();
        return group;
    }

    private bindLabel(setting: SettingDefinition): string {
        return setting.value === 'none'
            ? '(None)'
            : `[${String(setting.value).toUpperCase()}]`;
    }

    cancelCapture(): void {
        if (this.pendingButton && this.pendingSetting) {
            this.pendingButton.textContent = this.bindLabel(this.pendingSetting);
        }
        this.pendingButton = null;
        this.pendingSetting = null;
    }

    private save(): void {
        this.refreshVisibility();
        try {
            this.onSave();
        } catch (error) {
            this.notifications.error(error);
        }
    }
}

import { it, expect, vi } from 'vitest';
import { SettingsForm } from '../../src/ui/SettingsForm';
import { NotificationView } from '../../src/ui/NotificationView';
import { numberSetting, stringSetting } from '../../src/util/settings';

it('commits valid fields on input before a module is executed or focus changes', () => {
    const saved = vi.fn();
    const notifications = new NotificationView();
    const form = new SettingsForm(saved, notifications);
    const settings = [numberSetting('數量', 5, 1), stringSetting('名稱', 'old')];
    const panel = form.render(settings);
    document.body.append(panel);
    const inputs = panel.querySelectorAll('input');
    inputs[0]!.value = '2';
    inputs[0]!.dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1]!.value = 'NTR-QA-';
    inputs[1]!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(settings.map((setting) => setting.value)).toEqual([2, 'NTR-QA-']);
    expect(saved).toHaveBeenCalledTimes(2);
    inputs[0]!.value = '';
    inputs[0]!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(settings[0]!.value).toBe(2);
    form.dispose();
    notifications.dispose();
});

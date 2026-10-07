import { it, expect, vi } from 'vitest';
import { DragHandler } from '../../src/ui/DragHandler';
import { SettingsService } from '../../src/services/SettingsService';

it('does not erase a saved position before layout is available', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 720);
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.left = '895px';
    panel.style.top = '56px';
    const handle = document.createElement('div');
    panel.append(handle);
    document.body.append(panel);
    const bounds = vi
        .spyOn(panel, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect());
    const drag = new DragHandler(panel, handle, new SettingsService(localStorage));
    drag.clamp();
    expect(panel.style.left).toBe('895px');
    expect(panel.style.top).toBe('56px');
    bounds.mockReturnValue(new DOMRect(895, 56, 340, 300));
    drag.clamp();
    expect(panel.style.left).toBe('895px');
    expect(panel.style.top).toBe('56px');
    drag.dispose();
});

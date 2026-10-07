import type { QueueOptions } from '../interfaces/QueueOptions';
import type { SettingDefinition } from '../interfaces/SettingDefinition';
import {
    booleanSetting,
    booleanValue,
    numberSetting,
    numberValue,
    selectSetting,
    stringSetting,
    stringValue,
    translateMode,
} from './settings';

export function queueSettings(): SettingDefinition[] {
    return [
        numberSetting('單次擷取web數量(可破限)', 20, 1),
        numberSetting('擷取單頁wenku數量(deving)', 20, 1),
        selectSetting('模式', ['常規', '過期', '重翻'], '常規'),
        selectSetting('分段', ['智能', '固定'], '智能'),
        numberSetting('智能均分任務上限', 1000, 1),
        numberSetting('智能均分章節下限', 5, 1),
        numberSetting('固定均分任務', 6, 1),
        booleanSetting('R18(需登入)', true),
        booleanSetting('使用瀏覽器爬蟲', false),
        stringSetting('bind', 'none'),
    ];
}

export function readQueueOptions(settings: SettingDefinition[]): QueueOptions {
    return {
        webLimit: numberValue(settings, '單次擷取web數量(可破限)'),
        wenkuLimit: numberValue(settings, '擷取單頁wenku數量(deving)'),
        mode: translateMode(stringValue(settings, '模式')),
        split: stringValue(settings, '分段') === '智能' ? 'smart' : 'static',
        jobLimit: numberValue(settings, '智能均分任務上限'),
        chapterMinimum: numberValue(settings, '智能均分章節下限'),
        parts: numberValue(settings, '固定均分任務'),
        authenticated: booleanValue(settings, 'R18(需登入)'),
        useBrowserCrawler: booleanValue(settings, '使用瀏覽器爬蟲'),
    };
}

import type { QueueOptions } from '../interfaces/QueueOptions';
import type { SettingDefinition } from '../interfaces/SettingDefinition';
import { pageKind } from './routes';
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
    const isWeb = (pathname: string) =>
        ['novel', 'novels', 'favorite-web'].includes(pageKind(pathname));
    const splitIs = (settings: readonly SettingDefinition[], value: string) =>
        settings.find((setting) => setting.name === '分段')?.value === value;
    return [
        {
            ...numberSetting('單次擷取web數量(可破限)', 20, 1),
            label: '擷取數量（本）',
            description: '可超過網站單頁顯示數量',
            visible: (_, pathname) => pageKind(pathname) === 'novels',
        },
        {
            ...numberSetting('擷取單頁wenku數量(deving)', 20, 1),
            visible: (_, pathname) => pageKind(pathname) === 'wenkus',
        },
        { ...selectSetting('模式', ['常規', '過期', '重翻'], '常規'), label: '翻譯模式' },
        {
            ...selectSetting('分段', ['智能', '固定'], '智能'),
            label: '任務分段',
            visible: (_, pathname) => isWeb(pathname),
        },
        {
            ...numberSetting('智能均分任務上限', 1000, 1),
            label: '任務上限',
            visible: (settings, pathname) => isWeb(pathname) && splitIs(settings, '智能'),
        },
        {
            ...numberSetting('智能均分章節下限', 5, 1),
            label: '每個任務至少（章）',
            visible: (settings, pathname) => isWeb(pathname) && splitIs(settings, '智能'),
        },
        {
            ...numberSetting('固定均分任務', 6, 1),
            label: '均分任務數',
            visible: (settings, pathname) => isWeb(pathname) && splitIs(settings, '固定'),
        },
        { ...booleanSetting('R18(需登入)', true), label: '使用登入權限（含 R18）' },
        {
            ...booleanSetting('使用瀏覽器爬蟲', false),
            visible: (_, pathname) =>
                ['wenku', 'wenkus', 'favorite-wenku'].includes(pageKind(pathname)),
        },
        { ...stringSetting('bind', 'none'), label: '快捷鍵' },
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

import type { ToolboxApp } from '../core/ToolboxApp';

export type RuntimeWindow = Window & {
    _NTRToolBoxInstance?: boolean;
    _NoveliaToolBoxApp?: ToolboxApp;
};

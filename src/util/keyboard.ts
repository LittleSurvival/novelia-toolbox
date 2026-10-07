export function typingEvent(event: KeyboardEvent): boolean {
    return event
        .composedPath()
        .some(
            (target) =>
                target instanceof Element &&
                (target.matches('input, textarea, select, [role="textbox"]') ||
                    (target instanceof HTMLElement && target.isContentEditable) ||
                    Boolean(
                        target.closest(
                            '[contenteditable]:not([contenteditable="false"])',
                        ),
                    )),
        );
}

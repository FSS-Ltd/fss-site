interface MobileDialogElement extends EventTarget {
  readonly open: boolean;
  close(): void;
  showModal(): void;
}

interface MobileMediaQuery extends EventTarget {
  readonly matches: boolean;
}

interface MobileDialogControllerOptions {
  bodyStyle: Pick<CSSStyleDeclaration, "overflow">;
  dialog: MobileDialogElement;
  mediaQuery: MobileMediaQuery;
  trigger: Pick<HTMLElement, "focus">;
}

interface CloseOptions {
  restoreFocus?: boolean;
}

export interface MobileDialogController {
  close(options?: CloseOptions): void;
  dispose(): void;
  open(): void;
}

export function createMobileDialogController({
  bodyStyle,
  dialog,
  mediaQuery,
  trigger,
}: MobileDialogControllerOptions): MobileDialogController {
  let disposed = false;
  let ownsScrollLock = false;
  let previousOverflow = "";
  let restoreFocusOnClose = true;

  function releaseScrollLock() {
    if (!ownsScrollLock) return;

    bodyStyle.overflow = previousOverflow;
    ownsScrollLock = false;
  }

  function handleClosed() {
    releaseScrollLock();
    if (!disposed && restoreFocusOnClose) trigger.focus();
    restoreFocusOnClose = true;
  }

  function close({ restoreFocus = true }: CloseOptions = {}) {
    if (!dialog.open) {
      releaseScrollLock();
      return;
    }

    restoreFocusOnClose = restoreFocus;
    dialog.close();
  }

  function handleBreakpointChange() {
    if (!mediaQuery.matches) close({ restoreFocus: false });
  }

  dialog.addEventListener("close", handleClosed);
  mediaQuery.addEventListener("change", handleBreakpointChange);

  return {
    close,
    dispose() {
      disposed = true;
      dialog.removeEventListener("close", handleClosed);
      mediaQuery.removeEventListener("change", handleBreakpointChange);
      if (dialog.open) dialog.close();
      releaseScrollLock();
    },
    open() {
      if (disposed || dialog.open || !mediaQuery.matches) return;

      previousOverflow = bodyStyle.overflow;
      dialog.showModal();
      bodyStyle.overflow = "hidden";
      ownsScrollLock = true;
      restoreFocusOnClose = true;
    },
  };
}

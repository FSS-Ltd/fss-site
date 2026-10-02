"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  activeStudioSettingsSchema,
  type ActiveStudioSettings,
  type StudioSettingsSection,
} from "@/lib/operations/studio/active-settings-types";
import {
  createSettingsEditorState,
  settingsEditorDirty,
  settingsEditorReducer,
  settingsSectionUpdate,
  type SettingsEditorState,
} from "./settings-editor-state";

type SettingsEditorController = Readonly<{
  state: SettingsEditorState;
  discardRequested: boolean;
  keepEditing: () => void;
  discard: () => void;
  edit: (
    section: StudioSettingsSection,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  change: (values: Partial<Omit<ActiveStudioSettings, "revision">>) => void;
  close: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  reviewConflict: () => void;
}>;

function responseError(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  )
    return body.error;
  return "We could not apply these settings. Your edits are still here.";
}

export function useSettingsEditor(
  active: ActiveStudioSettings,
): SettingsEditorController {
  const [state, dispatch] = useReducer(
    settingsEditorReducer,
    active,
    createSettingsEditorState,
  );
  const [discardRequested, setDiscardRequested] = useState(false);
  const pendingRef = useRef(false);
  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const dirty = settingsEditorDirty(state);

  useEffect(() => {
    if (!dirty && state.status !== "pending") return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const protectNavigation = (event: globalThis.MouseEvent) => {
      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const destination = new URL(anchor.href);
      const current = new URL(window.location.href);
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search
      )
        return;
      if (
        state.status === "pending" ||
        !window.confirm("Leave settings and discard your unapplied edits?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", protectNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", protectNavigation, true);
    };
  }, [dirty, state.status]);

  function restoreFocus(): void {
    requestAnimationFrame(() => editButtonRef.current?.focus());
  }
  function edit(
    section: StudioSettingsSection,
    event: MouseEvent<HTMLButtonElement>,
  ): void {
    editButtonRef.current = event.currentTarget;
    dispatch({ type: "edit", section });
  }
  function close(): void {
    if (dirty) {
      setDiscardRequested(true);
      return;
    }
    dispatch({ type: "close" });
    restoreFocus();
  }
  function keepEditing(): void {
    setDiscardRequested(false);
    requestAnimationFrame(() => {
      document
        .getElementById(`settings-${state.section}-editor`)
        ?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select")
        ?.focus();
    });
  }
  function discard(): void {
    dispatch({ type: "discard" });
    setDiscardRequested(false);
    restoreFocus();
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const update = settingsSectionUpdate(state);
    if (!update || pendingRef.current || state.conflict) return;
    pendingRef.current = true;
    dispatch({ type: "pending" });
    try {
      const response = await fetch("/api/portal/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const current =
          body && typeof body === "object" && "current" in body
            ? activeStudioSettingsSchema.safeParse(body.current)
            : null;
        if (response.status === 409 && current?.success)
          dispatch({
            type: "conflict",
            current: current.data,
            message: responseError(body),
          });
        else dispatch({ type: "error", message: responseError(body) });
        return;
      }
      const applied = activeStudioSettingsSchema.safeParse(body);
      if (
        !applied.success ||
        applied.data.revision !== update.expectedRevision + 1
      ) {
        dispatch({
          type: "error",
          message:
            "The applied settings response was incomplete. Your edits are retained; retry to review the current revision.",
        });
        return;
      }
      dispatch({ type: "applied", active: applied.data });
      router.refresh();
      restoreFocus();
    } catch {
      dispatch({
        type: "error",
        message:
          "We could not apply these settings. Your edits are still here.",
      });
    } finally {
      pendingRef.current = false;
    }
  }

  return {
    state,
    discardRequested,
    discard,
    edit,
    close,
    submit,
    change: (values) => dispatch({ type: "change", values }),
    reviewConflict: () => dispatch({ type: "review-conflict" }),
    keepEditing,
  };
}

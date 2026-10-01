import type {
  ActiveStudioSettings,
  StudioSettingsSection,
  StudioSettingsSectionUpdate,
} from "@/lib/operations/studio/active-settings-types";

export type SettingsEditorState = Readonly<{
  active: ActiveStudioSettings;
  values: ActiveStudioSettings;
  section: StudioSettingsSection | null;
  status: "idle" | "pending" | "error" | "conflict" | "success";
  message: string | null;
  conflict: ActiveStudioSettings | null;
}>;
type SettingsEditorAction =
  | { type: "edit"; section: StudioSettingsSection }
  | { type: "change"; values: Partial<Omit<ActiveStudioSettings, "revision">> }
  | { type: "pending" | "close" | "discard" | "review-conflict" }
  | { type: "error"; message: string }
  | { type: "conflict"; current: ActiveStudioSettings; message: string }
  | { type: "applied"; active: ActiveStudioSettings };

export function createSettingsEditorState(
  active: ActiveStudioSettings,
): SettingsEditorState {
  return {
    active,
    values: active,
    section: null,
    status: "idle",
    message: null,
    conflict: null,
  };
}

export function settingsSectionUpdate(
  state: SettingsEditorState,
): StudioSettingsSectionUpdate | null {
  const { active, values, section } = state;
  const expectedRevision = active.revision;
  switch (section) {
    case "identity":
      return {
        section,
        expectedRevision,
        values: { displayName: values.displayName },
      };
    case "communication":
      return {
        section,
        expectedRevision,
        values: {
          replyTo: values.replyTo,
          responseExpectationHours: values.responseExpectationHours,
        },
      };
    case "timezone":
      return {
        section,
        expectedRevision,
        values: { timezone: values.timezone },
      };
    case "delivery":
      return {
        section,
        expectedRevision,
        values: { deliveryCapacity: values.deliveryCapacity },
      };
    case null:
      return null;
  }
}

export function settingsEditorDirty(state: SettingsEditorState): boolean {
  const { active, values, section } = state;
  switch (section) {
    case "identity":
      return values.displayName !== active.displayName;
    case "communication":
      return (
        values.replyTo !== active.replyTo ||
        values.responseExpectationHours !== active.responseExpectationHours
      );
    case "timezone":
      return values.timezone !== active.timezone;
    case "delivery":
      return values.deliveryCapacity !== active.deliveryCapacity;
    case null:
      return false;
  }
}

export function settingsEditorReducer(
  state: SettingsEditorState,
  action: SettingsEditorAction,
): SettingsEditorState {
  if (
    state.status === "pending" &&
    ["edit", "change", "close", "discard", "pending"].includes(action.type)
  )
    return state;
  switch (action.type) {
    case "edit":
      return state.section
        ? state
        : {
            ...createSettingsEditorState(state.active),
            section: action.section,
          };
    case "change":
      return {
        ...state,
        values: { ...state.values, ...action.values },
        status: state.conflict ? "conflict" : "idle",
        message: null,
      };
    case "pending":
      return { ...state, status: "pending", message: null };
    case "error":
      return { ...state, status: "error", message: action.message };
    case "conflict":
      return {
        ...state,
        status: "conflict",
        conflict: action.current,
        message: action.message,
      };
    case "review-conflict":
      return state.conflict
        ? {
            ...state,
            active: state.conflict,
            conflict: null,
            status: "idle",
            message:
              "Current revision reviewed. Your edits are retained; Save and apply when ready.",
          }
        : state;
    case "applied":
      return {
        ...createSettingsEditorState(action.active),
        status: "success",
        message: `Settings revision ${action.active.revision} applied.`,
      };
    case "close":
      return settingsEditorDirty(state)
        ? state
        : createSettingsEditorState(state.active);
    case "discard":
      return createSettingsEditorState(state.active);
  }
}

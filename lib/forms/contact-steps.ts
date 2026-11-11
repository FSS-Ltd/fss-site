import type {
  ContactAnswers,
  ContactNeed,
  ContactTeamSize,
  ContactTiming,
  ContactTool,
} from "./contact-request";

export const contactStepCount = 5;
export const contactLastStep = contactStepCount - 1;

export type ContactFlowState = {
  step: number;
  answers: ContactAnswers;
  error: string | null;
};

export type ContactFlowAction =
  | { type: "choose-need"; value: ContactNeed }
  | { type: "toggle-tool"; value: ContactTool }
  | { type: "choose-team"; value: ContactTeamSize }
  | { type: "choose-timing"; value: ContactTiming }
  | { type: "set-detail"; value: string }
  | { type: "next" }
  | { type: "back" };

export const initialContactFlow: ContactFlowState = {
  step: 0,
  answers: { need: "", detail: "", tools: [], teamSize: "", timing: "" },
  error: null,
};

function missing({ answers, step }: ContactFlowState): string | null {
  if (step === 0 && !answers.need)
    return "Choose the option that fits best to continue.";
  if (step === 2 && !answers.teamSize)
    return "Choose a team size to continue.";
  if (step === 3 && !answers.timing) return "Choose a timeframe to continue.";
  return null;
}

function advance(
  state: ContactFlowState,
  answers: ContactAnswers,
): ContactFlowState {
  return {
    step: Math.min(state.step + 1, contactLastStep),
    answers,
    error: null,
  };
}

export function contactFlowReducer(
  state: ContactFlowState,
  action: ContactFlowAction,
): ContactFlowState {
  switch (action.type) {
    case "choose-need":
      return advance(state, { ...state.answers, need: action.value });
    case "choose-team":
      return advance(state, { ...state.answers, teamSize: action.value });
    case "choose-timing":
      return advance(state, { ...state.answers, timing: action.value });
    case "toggle-tool": {
      const tools = state.answers.tools.includes(action.value)
        ? state.answers.tools.filter((tool) => tool !== action.value)
        : [...state.answers.tools, action.value];
      return { ...state, answers: { ...state.answers, tools } };
    }
    case "set-detail":
      return { ...state, answers: { ...state.answers, detail: action.value } };
    case "next": {
      const error = missing(state);
      return error ? { ...state, error } : advance(state, state.answers);
    }
    case "back":
      return { ...state, step: Math.max(state.step - 1, 0), error: null };
  }
}

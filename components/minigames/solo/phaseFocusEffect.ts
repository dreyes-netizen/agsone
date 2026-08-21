import { focusOnPhase } from "./focusTransition";

type FocusRef = { current: Pick<HTMLElement, "focus"> | null };

export function runPhaseFocusEffect(phase: string, activePhase: string, ref: FocusRef) {
  focusOnPhase(phase, activePhase, ref.current);
}

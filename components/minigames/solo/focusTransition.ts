type FocusTarget = Pick<HTMLElement, "focus"> | null | undefined;

export function focusOnPhase(phase: string, activePhase: string, target: FocusTarget) {
  if (phase === activePhase) target?.focus();
}

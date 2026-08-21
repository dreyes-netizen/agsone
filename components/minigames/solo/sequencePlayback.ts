type TimerApi = Pick<typeof globalThis, "setTimeout" | "clearTimeout">;

const FLASH_MS = 450;
const STEP_MS = 700;

export function scheduleSequencePlayback(
  sequence: readonly number[],
  level: number,
  onFlash: (button: number | null) => void,
  onComplete: () => void,
  timers: TimerApi = globalThis,
) {
  const ids = sequence.slice(0, level).flatMap((button, index) => [
    timers.setTimeout(() => onFlash(button), index * STEP_MS),
    timers.setTimeout(() => {
      onFlash(null);
      if (index === level - 1) onComplete();
    }, index * STEP_MS + FLASH_MS),
  ]);

  return () => ids.forEach((id) => timers.clearTimeout(id));
}

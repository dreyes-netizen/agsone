export function getTypingLiveMetrics(expectedText: string, typedText: string, elapsedMs: number) {
  const correctChars = typedText.split("").filter((character, index) => character === expectedText[index % expectedText.length]).length;
  const accuracy = typedText.length ? Math.round((correctChars / typedText.length) * 100) : 100;
  const elapsedMinutes = Math.max(1 / 60, elapsedMs / 60_000);

  return {
    correctChars,
    accuracy,
    wpm: Math.floor((correctChars / 5) / elapsedMinutes),
  };
}

// Walks the candidate manager's chain upward looking for the employee being
// moved. `getManagerId` is injected so this stays a pure function testable
// without a live database — the caller (the employees PATCH route) supplies
// a Prisma-backed lookup. `seen` bounds the walk so a pre-existing, unrelated
// cycle elsewhere in the data can't hang this in an infinite loop.
export async function wouldCreateCycle(
  employeeId: string,
  newManagerId: string,
  getManagerId: (userId: string) => Promise<string | null>,
): Promise<boolean> {
  let currentId: string | null = newManagerId;
  const seen = new Set<string>();

  while (currentId) {
    if (currentId === employeeId) return true;
    if (seen.has(currentId)) return false;
    seen.add(currentId);
    currentId = await getManagerId(currentId);
  }

  return false;
}

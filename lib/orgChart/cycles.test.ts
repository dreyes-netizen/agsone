import { describe, it, expect } from "vitest";
import { wouldCreateCycle } from "./cycles";

function chainLookup(managerById: Record<string, string | null>) {
  return async (userId: string) => managerById[userId] ?? null;
}

describe("wouldCreateCycle", () => {
  it("rejects a direct self-report", async () => {
    const lookup = chainLookup({});
    expect(await wouldCreateCycle("paul", "paul", lookup)).toBe(true);
  });

  it("rejects reassigning to a descendant several levels down (indirect cycle)", async () => {
    // paul -> tristan -> vincent ; proposing paul reports to vincent
    const lookup = chainLookup({ vincent: "tristan", tristan: "paul" });
    expect(await wouldCreateCycle("paul", "vincent", lookup)).toBe(true);
  });

  it("allows a valid reassignment to an unrelated manager", async () => {
    const lookup = chainLookup({ john: "ceo" });
    expect(await wouldCreateCycle("paul", "john", lookup)).toBe(false);
  });

  it("allows moving to a top-level (no manager) new manager", async () => {
    const lookup = chainLookup({ ceo: null });
    expect(await wouldCreateCycle("paul", "ceo", lookup)).toBe(false);
  });

  it("does not hang on a pre-existing unrelated cycle in the chain", async () => {
    // a -> b -> a (bad data elsewhere), unrelated to "paul"
    const lookup = chainLookup({ a: "b", b: "a" });
    expect(await wouldCreateCycle("paul", "a", lookup)).toBe(false);
  });
});

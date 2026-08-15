import { describe, it, expect } from "vitest";
import { getStockState } from "./rewardAvailability";

describe("getStockState", () => {
  it("treats -1 as unlimited stock", () => {
    const state = getStockState(-1);
    expect(state).toMatchObject({ outOfStock: false, unlimited: true, lowStock: false, label: "Unlimited" });
  });

  it("treats 0 as out of stock", () => {
    const state = getStockState(0);
    expect(state).toMatchObject({ outOfStock: true, unlimited: false, lowStock: false, label: "Out of stock" });
  });

  it("flags quantities at or below the low-stock threshold", () => {
    const state = getStockState(3);
    expect(state).toMatchObject({ outOfStock: false, unlimited: false, lowStock: true, label: "3 left" });
  });

  it("does not flag low stock above the threshold", () => {
    const state = getStockState(4);
    expect(state).toMatchObject({ outOfStock: false, unlimited: false, lowStock: false, label: "4 left" });
  });
});

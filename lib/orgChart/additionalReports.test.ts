import { describe, it, expect } from "vitest";
import { validateAdditionalReport } from "./additionalReports";

const BASE = {
  userId: "user-1",
  managerId: "manager-1",
  relationshipType: "dotted-line",
  primaryManagerId: "primary-1",
  existingManagerIds: [] as string[],
};

describe("validateAdditionalReport", () => {
  it("allows a valid new relationship", () => {
    expect(validateAdditionalReport(BASE)).toBeNull();
  });

  it("blocks self-report", () => {
    expect(validateAdditionalReport({ ...BASE, userId: "user-1", managerId: "user-1" })).toMatch(/themselves/);
  });

  it("blocks an invalid relationship type", () => {
    expect(validateAdditionalReport({ ...BASE, relationshipType: "buddy" })).toMatch(/Invalid relationship type/);
  });

  it("blocks a manager that duplicates the primary manager", () => {
    expect(validateAdditionalReport({ ...BASE, managerId: "primary-1" })).toMatch(/primary manager/);
  });

  it("allows the same managerId when there is no primary manager (top-of-chart employee)", () => {
    expect(validateAdditionalReport({ ...BASE, primaryManagerId: null })).toBeNull();
  });

  it("blocks a duplicate additional relationship", () => {
    expect(validateAdditionalReport({ ...BASE, existingManagerIds: ["manager-1"] })).toMatch(/already exists/);
  });

  it("allows a second, distinct additional relationship", () => {
    expect(validateAdditionalReport({ ...BASE, existingManagerIds: ["some-other-manager"] })).toBeNull();
  });
});

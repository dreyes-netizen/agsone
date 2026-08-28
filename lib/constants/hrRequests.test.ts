import { describe, it, expect } from "vitest";
import {
  HR_REQUEST_CATEGORIES,
  HR_QUICK_PICK_IDS,
  HR_QUICK_PICKS,
  HR_HANDLED_ELSEWHERE,
  findHrRequestType,
  findHrCategoryForType,
  findHrCategory,
  validateHrRequestFields,
  type HrRequestType,
} from "./hrRequests";

const allTypes: HrRequestType[] = HR_REQUEST_CATEGORIES.flatMap((c) => [...c.types]);

function typeById(id: string): HrRequestType {
  const type = findHrRequestType(id);
  if (!type) throw new Error(`fixture drift: no request type "${id}"`);
  return type;
}

describe("HR request catalog integrity", () => {
  // These ids are persisted on HrRequest rows, so a duplicate would make two
  // different requests indistinguishable after the fact.
  it("has globally unique category ids", () => {
    const ids = HR_REQUEST_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has globally unique type ids across all categories", () => {
    const ids = allTypes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique field ids within each type", () => {
    for (const type of allTypes) {
      const ids = type.fields.map((f) => f.id);
      expect(new Set(ids).size, `duplicate field id in "${type.id}"`).toBe(ids.length);
    }
  });

  it("gives every type a non-empty uppercase tag", () => {
    for (const type of allTypes) {
      expect(type.tag, `type "${type.id}"`).toMatch(/^[A-Z0-9-]{2,12}$/);
    }
  });

  it("gives every select field at least two options with unique values", () => {
    for (const type of allTypes) {
      for (const field of type.fields) {
        if (field.kind !== "select") continue;
        const options = field.options ?? [];
        expect(options.length, `"${type.id}.${field.id}"`).toBeGreaterThanOrEqual(2);
        const values = options.map((o) => o.value);
        expect(new Set(values).size, `"${type.id}.${field.id}"`).toBe(values.length);
        for (const option of options) {
          expect(option.label.trim(), `"${type.id}.${field.id}"`).not.toBe("");
        }
      }
    }
  });

  it("never puts options on a non-select field", () => {
    for (const type of allTypes) {
      for (const field of type.fields) {
        if (field.kind === "select") continue;
        expect(field.options, `"${type.id}.${field.id}"`).toBeUndefined();
      }
    }
  });

  it("caps every free-text field so the composed Gmail URL stays bounded", () => {
    for (const type of allTypes) {
      for (const field of type.fields) {
        if (field.kind !== "text" && field.kind !== "textarea") continue;
        expect(field.maxLength, `"${type.id}.${field.id}"`).toBeDefined();
      }
    }
  });

  it("resolves every summaryFieldId to a real field on its own type", () => {
    for (const type of allTypes) {
      if (!type.summaryFieldId) continue;
      const match = type.fields.find((f) => f.id === type.summaryFieldId);
      expect(match, `"${type.id}" summaryFieldId "${type.summaryFieldId}"`).toBeDefined();
    }
  });

  it("resolves every quick pick", () => {
    expect(HR_QUICK_PICKS).toHaveLength(HR_QUICK_PICK_IDS.length);
    for (const id of HR_QUICK_PICK_IDS) {
      expect(findHrRequestType(id), `quick pick "${id}"`).not.toBeNull();
      expect(findHrCategoryForType(id), `quick pick "${id}"`).not.toBeNull();
    }
  });

  it("covers the request groups HR asked for", () => {
    const ids = HR_REQUEST_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("payroll");
    expect(ids).toContain("gov_benefits");
    expect(ids).toContain("documents");
  });

  it("does not offer leave, attendance, shift or WFH filing — those are Sprout/TL-owned", () => {
    const ids = HR_REQUEST_CATEGORIES.map((c) => c.id);
    expect(ids).not.toContain("leave");
    for (const removed of [
      "leave_application",
      "leave_balance",
      "attendance_correction",
      "schedule_change",
      "wfh_request",
      "payslip_copy",
    ]) {
      expect(findHrRequestType(removed), `"${removed}" should no longer resolve`).toBeNull();
    }
  });

  it("keeps overtime/undertime as a payroll concern, without the TL-owned approval option", () => {
    const type = typeById("overtime_undertime");
    expect(findHrCategoryForType("overtime_undertime")?.id).toBe("payroll");
    expect(type.tag).toBe("PAYROLL");
    const concern = type.fields.find((f) => f.id === "concern");
    expect(concern?.options?.map((o) => o.value)).not.toContain("ot_unapproved");
  });

  it("documents where requests AGS One doesn't take actually belong", () => {
    expect(HR_HANDLED_ELSEWHERE.length).toBeGreaterThan(0);
    for (const item of HR_HANDLED_ELSEWHERE) {
      expect(item.what.trim()).not.toBe("");
      expect(item.where.trim()).not.toBe("");
    }
  });

  it("warns offboarding requests that AGS One access ends at resignation", () => {
    for (const id of ["final_pay", "bir_2316", "clearance"]) {
      const warning = typeById(id).warning;
      expect(warning, `"${id}" should carry an access-ending warning`).toBeTruthy();
      expect(warning).toMatch(/last day/i);
    }
  });

  it("offers SSS, Pag-IBIG, PhilHealth and BIR requests", () => {
    const tags = new Set(typeTagsIn("gov_benefits"));
    expect(tags).toContain("SSS");
    expect(tags).toContain("PAG-IBIG");
    expect(tags).toContain("PHILHEALTH");
    expect(tags).toContain("BIR");
  });

  it("gives the COE request a purpose dropdown", () => {
    const purpose = typeById("coe").fields.find((f) => f.id === "purpose");
    expect(purpose?.kind).toBe("select");
    expect(purpose?.required).toBe(true);
    expect(purpose?.options?.map((o) => o.value)).toContain("loan_bank");
  });

  it("breaks the payslip concern into sub-reasons including night differential", () => {
    const issue = typeById("payslip_concern").fields.find((f) => f.id === "issue");
    const values = issue?.options?.map((o) => o.value) ?? [];
    expect(values).toContain("deduction");
    expect(values).toContain("night_diff");
  });

  it("returns null for unknown lookups rather than throwing", () => {
    expect(findHrRequestType("nope")).toBeNull();
    expect(findHrCategoryForType("nope")).toBeNull();
    expect(findHrCategory("nope")).toBeNull();
  });
});

function typeTagsIn(categoryId: string): string[] {
  const category = findHrCategory(categoryId);
  if (!category) throw new Error(`fixture drift: no category "${categoryId}"`);
  return category.types.map((t) => t.tag);
}

describe("validateHrRequestFields", () => {
  const coe = typeById("coe");
  const payslip = typeById("payslip_concern");
  const resignation = typeById("resignation");
  const hmoLoa = typeById("hmo_loa");

  it("accepts a valid submission and returns trimmed values", () => {
    const result = validateHrRequestFields(coe, {
      purpose: "loan_bank",
      include_salary: "yes",
      addressed_to: "  BDO Unibank  ",
    });
    expect(result).toEqual({
      ok: true,
      cleaned: { purpose: "loan_bank", include_salary: "yes", addressed_to: "BDO Unibank" },
    });
  });

  it("reports a missing required field, keyed by field id", () => {
    const result = validateHrRequestFields(coe, { include_salary: "yes" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors.purpose).toBe("Purpose of request is required");
  });

  it("treats a whitespace-only required value as missing", () => {
    const result = validateHrRequestFields(coe, { purpose: "   ", include_salary: "yes" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors.purpose).toBeDefined();
  });

  it("rejects a select value outside its options", () => {
    const result = validateHrRequestFields(coe, { purpose: "bribery", include_salary: "yes" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors.purpose).toBe("Choose a valid option for Purpose of request");
  });

  it("omits optional empty fields from cleaned rather than storing blanks", () => {
    const result = validateHrRequestFields(coe, {
      purpose: "school",
      include_salary: "no",
      addressed_to: "",
      needed_by: "   ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.cleaned).not.toHaveProperty("addressed_to");
    expect(result.cleaned).not.toHaveProperty("needed_by");
  });

  it("drops unknown field ids without erroring, so a stale tab still submits", () => {
    const result = validateHrRequestFields(coe, {
      purpose: "visa",
      include_salary: "no",
      retired_field: "value from an older deploy",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.cleaned).not.toHaveProperty("retired_field");
  });

  describe("numbers", () => {
    const base = { pay_period: "Aug 1–15, 2026", issue: "night_diff" };

    it("accepts integers and decimals", () => {
      const result = validateHrRequestFields(payslip, { ...base, expected: "1500.75" });
      expect(result.ok).toBe(true);
    });

    it("rejects non-numeric input", () => {
      const result = validateHrRequestFields(payslip, { ...base, expected: "a lot" });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.errors.expected).toBe("Expected amount (PHP) must be a number");
    });

    it("rejects a value below min", () => {
      const result = validateHrRequestFields(payslip, { ...base, expected: "-5" });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.errors.expected).toContain("cannot be less than 0");
    });

    it("rejects a value above max", () => {
      const result = validateHrRequestFields(payslip, { ...base, expected: "99999999" });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.errors.expected).toContain("cannot be more than");
    });
  });

  describe("dates", () => {
    it("accepts a real ISO date", () => {
      const result = validateHrRequestFields(resignation, { last_day: "2026-09-30" });
      expect(result.ok).toBe(true);
    });

    it("rejects a calendar-impossible date", () => {
      const result = validateHrRequestFields(resignation, { last_day: "2026-02-30" });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.errors.last_day).toBe("Intended last day must be a valid date");
    });

    it("rejects a non-ISO format", () => {
      const result = validateHrRequestFields(resignation, { last_day: "28/02/2026" });
      expect(result.ok).toBe(false);
    });
  });

  it("rejects text longer than the field's maxLength", () => {
    const result = validateHrRequestFields(coe, {
      purpose: "other",
      include_salary: "no",
      addressed_to: "x".repeat(151),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.errors.addressed_to).toContain("150 characters or fewer");
  });

  it("collects every failing field at once rather than stopping at the first", () => {
    const result = validateHrRequestFields(hmoLoa, {});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(Object.keys(result.errors).sort()).toEqual(["patient", "provider"]);
  });
});

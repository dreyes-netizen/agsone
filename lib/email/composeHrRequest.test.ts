import { describe, it, expect } from "vitest";
import { composeHrRequest, type HrRequesterProfile } from "./composeHrRequest";
import { buildGmailComposeUrl } from "./gmailCompose";
import {
  HR_REQUEST_CATEGORIES,
  HR_BODY_MAX_CHARS,
  findHrRequestType,
  findHrCategoryForType,
  type HrRequestType,
  type HrRequestCategory,
} from "@/lib/constants/hrRequests";

const profile: HrRequesterProfile = {
  displayName: "Juan Dela Cruz",
  email: "juan.delacruz@allianceglobalsolutions.com",
  employeeId: "AGS-00123",
  position: "Senior Associate",
  departmentName: "Operations",
};

function resolve(typeId: string): { type: HrRequestType; category: HrRequestCategory } {
  const type = findHrRequestType(typeId);
  const category = findHrCategoryForType(typeId);
  if (!type || !category) throw new Error(`fixture drift: no request type "${typeId}"`);
  return { type, category };
}

describe("composeHrRequest", () => {
  it("composes the COE request exactly", () => {
    const { type, category } = resolve("coe");
    const { subject, body } = composeHrRequest({
      profile,
      category,
      type,
      values: {
        purpose: "loan_bank",
        include_salary: "yes",
        addressed_to: "BDO Unibank",
        needed_by: "2026-09-05",
        copy_type: "soft",
      },
      notes: "I need this before my loan interview on the 8th.",
      ref: "HRQ-8F3K2A19",
    });

    expect(subject).toBe("[COE] Bank / loan application — Juan Dela Cruz (AGS-00123)");
    expect(body).toBe(
      [
        "Hi HR,",
        "",
        "I would like to request: Certificate of Employment (COE) (Certificates & Documents)",
        "",
        "--- EMPLOYEE ---",
        "Name: Juan Dela Cruz",
        "Employee ID: AGS-00123",
        "Position: Senior Associate",
        "Department: Operations",
        "Company email: juan.delacruz@allianceglobalsolutions.com",
        "",
        "--- REQUEST DETAILS ---",
        "Purpose of request: Bank / loan application",
        "Include compensation?: Yes — include salary",
        "Addressed to: BDO Unibank",
        "Needed by: 2026-09-05",
        "Copy needed: Soft copy (PDF via email)",
        "",
        "--- ADDITIONAL NOTES ---",
        "I need this before my loan interview on the 8th.",
        "",
        "Expected turnaround: COEs are typically released within 3 working days.",
        "",
        "Sent from AGS One · Ref HRQ-8F3K2A19",
      ].join("\n"),
    );
  });

  it("renders select labels, never the stored codes", () => {
    const { type, category } = resolve("payslip_concern");
    const { body } = composeHrRequest({
      profile,
      category,
      type,
      values: { pay_period: "Aug 1–15, 2026", issue: "night_diff" },
      ref: "HRQ-1",
    });
    expect(body).toContain("What's the concern?: Night differential");
    expect(body).not.toContain("night_diff");
  });

  it("headlines the subject with the summary field", () => {
    const { type, category } = resolve("sss_salary_loan");
    const { subject } = composeHrRequest({
      profile,
      category,
      type,
      values: { sss_number: "03-1234567-8", concern: "balance" },
      ref: "HRQ-2",
    });
    expect(subject).toBe("[SSS] Outstanding loan balance — Juan Dela Cruz (AGS-00123)");
  });

  it("falls back to the type label when the summary field is blank", () => {
    const { type, category } = resolve("sss_salary_loan");
    const { subject } = composeHrRequest({
      profile,
      category,
      type,
      values: { sss_number: "03-1234567-8" },
      ref: "HRQ-3",
    });
    expect(subject).toBe("[SSS] SSS — Salary Loan — Juan Dela Cruz (AGS-00123)");
  });

  it("emits no line at all for an empty optional field", () => {
    const { type, category } = resolve("coe");
    const { body } = composeHrRequest({
      profile,
      category,
      type,
      values: { purpose: "school", include_salary: "no", addressed_to: "   " },
      ref: "HRQ-4",
    });
    expect(body).not.toContain("Addressed to:");
    expect(body).not.toMatch(/: *\n/);
  });

  it("omits the notes section entirely when there are no notes", () => {
    const { type, category } = resolve("coe");
    const { body } = composeHrRequest({
      profile,
      category,
      type,
      values: { purpose: "visa", include_salary: "yes" },
      notes: "   ",
      ref: "HRQ-5",
    });
    expect(body).not.toContain("ADDITIONAL NOTES");
  });

  it("lists attachment reminders when the type declares them, and omits the block otherwise", () => {
    const withAttachments = resolve("sss_salary_loan");
    const withBody = composeHrRequest({
      profile,
      category: withAttachments.category,
      type: withAttachments.type,
      values: { sss_number: "03-1234567-8", concern: "status" },
      ref: "HRQ-6",
    }).body;
    expect(withBody).toContain("--- PLEASE ATTACH BEFORE SENDING ---");
    expect(withBody).toContain("- A photo or scan of your SSS ID or UMID showing your SSS number");

    const without = resolve("coe");
    const withoutBody = composeHrRequest({
      profile,
      category: without.category,
      type: without.type,
      values: { purpose: "personal", include_salary: "no" },
      ref: "HRQ-7",
    }).body;
    expect(withoutBody).not.toContain("PLEASE ATTACH");
  });

  it("skips missing profile details instead of printing null", () => {
    const { type, category } = resolve("coe");
    const { subject, body } = composeHrRequest({
      profile: {
        displayName: "New Hire",
        email: null,
        employeeId: null,
        position: null,
        departmentName: null,
      },
      category,
      type,
      values: { purpose: "new_employment", include_salary: "no" },
      ref: "HRQ-8",
    });
    expect(subject).toBe("[COE] New employment — New Hire");
    expect(body).not.toContain("null");
    expect(body).not.toContain("Employee ID:");
    expect(body).toContain("Name: New Hire");
  });

  it("follows catalog order regardless of the order values arrive in", () => {
    const { type, category } = resolve("coe");
    const { body } = composeHrRequest({
      profile,
      category,
      type,
      // Deliberately reversed relative to the catalog.
      values: {
        copy_type: "hard",
        needed_by: "2026-09-05",
        addressed_to: "BPI",
        include_salary: "no",
        purpose: "credit_card",
      },
      ref: "HRQ-9",
    });
    const order = ["Purpose of request:", "Include compensation?:", "Addressed to:", "Needed by:", "Copy needed:"];
    const positions = order.map((label) => body.indexOf(label));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((p) => p > -1)).toBe(true);
  });

  it("always starts the subject with the type tag", () => {
    for (const category of HR_REQUEST_CATEGORIES) {
      for (const type of category.types) {
        const { subject } = composeHrRequest({ profile, category, type, values: {}, ref: "HRQ-X" });
        expect(subject.startsWith(`[${type.tag}] `), `type "${type.id}"`).toBe(true);
      }
    }
  });

  it("uses only \\n, so the Gmail draft doesn't gain stray carriage returns", () => {
    const { type, category } = resolve("resignation");
    const { body } = composeHrRequest({
      profile,
      category,
      type,
      values: { last_day: "2026-09-30", notice_date: "2026-09-01" },
      ref: "HRQ-10",
    });
    expect(body).not.toContain("\r");
  });

  it("survives the Gmail compose URL round-trip unchanged", () => {
    const { type, category } = resolve("payslip_concern");
    const { subject, body } = composeHrRequest({
      profile,
      category,
      type,
      values: { pay_period: "Aug 1–15, 2026", issue: "deduction", expected: "25000", actual: "23150.50" },
      notes: "Ampersands & em—dashes should survive.",
      ref: "HRQ-11",
    });

    const url = new URL(buildGmailComposeUrl({ to: "hr@allianceglobalsolutions.com", subject, body }));
    expect(url.searchParams.get("su")).toBe(subject);
    expect(url.searchParams.get("body")).toBe(body);
  });

  it("keeps the worst-case body inside the Gmail URL budget for every request type", () => {
    for (const category of HR_REQUEST_CATEGORIES) {
      for (const type of category.types) {
        const values: Record<string, string> = {};
        for (const field of type.fields) {
          switch (field.kind) {
            case "select":
              values[field.id] = field.options?.[0]?.value ?? "";
              break;
            case "date":
              values[field.id] = "2026-12-31";
              break;
            case "number":
              values[field.id] = String(field.max ?? 999999);
              break;
            default:
              values[field.id] = "x".repeat(field.maxLength ?? 100);
          }
        }
        const { body } = composeHrRequest({
          profile,
          category,
          type,
          values,
          notes: "y".repeat(1000),
          ref: "HRQ-12345678",
        });
        expect(body.length, `type "${type.id}"`).toBeLessThan(HR_BODY_MAX_CHARS);
      }
    }
  });
});

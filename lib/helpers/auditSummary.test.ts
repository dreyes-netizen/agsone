import { describe, it, expect } from "vitest";
import { auditSummary, type AuditEntryLike } from "./auditSummary";
import { ALL_ACTIONS } from "@/lib/constants/auditActions";

function entry(overrides: Partial<AuditEntryLike>): AuditEntryLike {
  return {
    action: "UNKNOWN",
    entityType: "Unknown",
    beforeState: null,
    afterState: null,
    ...overrides,
  };
}

function text(entry: AuditEntryLike): string {
  return auditSummary(entry).map((s) => s.text).join("");
}

describe("auditSummary", () => {
  it("every known action renders at least one segment (never falls through silently)", () => {
    for (const action of ALL_ACTIONS) {
      const segments = auditSummary(entry({ action, entityType: "Whatever" }));
      expect(segments.length).toBeGreaterThan(0);
    }
  });

  it("falls back to entityType for an unrecognized action", () => {
    expect(text(entry({ action: "SOMETHING_NEW", entityType: "Widget" }))).toBe("Widget");
  });

  describe("UPDATE_ROLE", () => {
    it("shows the target's name and the before -> after role when both are present", () => {
      const line = text(entry({
        action: "UPDATE_ROLE",
        afterState: { targetUserId: "u1", targetUserName: "Jane Cruz", role: "SUPER_ADMIN" },
        beforeState: { role: "EMPLOYEE" },
      }));
      expect(line).toBe("Jane Cruz · Employee → Super Admin");
    });

    it("degrades to a generic 'Role →' when there is no captured previous role (legacy row)", () => {
      const line = text(entry({
        action: "UPDATE_ROLE",
        afterState: { targetUserId: "u1", targetUserName: "Jane Cruz", role: "SUPER_ADMIN" },
        beforeState: null,
      }));
      expect(line).toBe("Jane Cruz · Role → Super Admin");
    });

    it("reads a legacy v1 row that has no name at all, only bare fields", () => {
      // Oldest possible shape: afterState = { role }, no name captured anywhere.
      // resolveAuditNames is responsible for injecting a name before this runs;
      // absent that, the formatter must still not throw or render blank.
      const segments = auditSummary(entry({
        action: "UPDATE_ROLE",
        afterState: { role: "HR_ADMIN" },
        beforeState: null,
      }));
      expect(segments.length).toBeGreaterThan(0);
      expect(text(entry({ action: "UPDATE_ROLE", afterState: { role: "HR_ADMIN" } }))).toBe("Role → HR Admin");
    });
  });

  describe("UPDATE_USER", () => {
    it("reports a deactivation", () => {
      const line = text(entry({
        action: "UPDATE_USER",
        afterState: {
          targetUserId: "u1",
          targetUserName: "Jane Cruz",
          changes: { isActive: { from: true, to: false } },
        },
      }));
      expect(line).toBe("Jane Cruz · Deactivated");
    });

    it("reports a role change made through the generic employee editor", () => {
      const line = text(entry({
        action: "UPDATE_USER",
        afterState: {
          targetUserId: "u1",
          targetUserName: "Jane Cruz",
          changes: { role: { from: "EMPLOYEE", to: "MANAGER" } },
        },
      }));
      expect(line).toBe("Jane Cruz · Role: Employee → Manager");
    });

    it("reports a department reassignment", () => {
      const line = text(entry({
        action: "UPDATE_USER",
        afterState: {
          targetUserId: "u1",
          targetUserName: "Jane Cruz",
          changes: { departmentName: { from: "Support", to: "Operations" } },
        },
      }));
      expect(line).toBe("Jane Cruz · Dept: Support → Operations");
    });
  });

  describe("AWARD_POINTS", () => {
    it("shows recipient, amount, and note", () => {
      const line = text(entry({
        action: "AWARD_POINTS",
        afterState: { toUserId: "u1", toUserName: "Jane Cruz", amount: 500, note: "Great work" },
      }));
      expect(line).toBe('To Jane Cruz · +500 pts · "Great work"');
    });
  });

  describe("DEDUCT_POINTS", () => {
    it("renders a negative amount even though the payload key is 'deducted', not 'amount'", () => {
      // Regression test: the pre-existing bug was that the display logic
      // checked `after.amount`, but this route writes `after.deducted` — so
      // the "-" branch was silently dead code. It must work via either key.
      const line = text(entry({
        action: "DEDUCT_POINTS",
        afterState: { toUserId: "u1", toUserName: "Jane Cruz", deducted: 150, violationType: "SPAM_POSTING" },
      }));
      expect(line).toBe("Jane Cruz · −150 pts · Spam posting");
    });
  });

  describe("BULK_AWARD_POINTS", () => {
    it("shows recipient count and per-person amount", () => {
      const line = text(entry({
        action: "BULK_AWARD_POINTS",
        afterState: { count: 12, amount: 200, recipientNames: ["A", "B"] },
      }));
      expect(line).toBe("12 employees · +200 pts each");
    });
  });

  describe("ATTENDANCE_AWARD", () => {
    it("shows recipient count, amount, and the attendance month", () => {
      const line = text(entry({
        action: "ATTENDANCE_AWARD",
        afterState: { count: 18, amount: 300, attendanceMonth: "2026-07-01" },
      }));
      expect(line).toBe("18 employees · +300 pts · July 2026");
    });
  });

  describe("REDEMPTION_STATUS", () => {
    it("shows employee, reward, status transition, and refund note", () => {
      const line = text(entry({
        action: "REDEMPTION_STATUS",
        afterState: {
          targetUserId: "u1",
          targetUserName: "Jane Cruz",
          rewardName: "Coffee Voucher",
          fromStatus: "PENDING",
          toStatus: "REJECTED",
          refunded: 500,
        },
      }));
      expect(line).toBe("Jane Cruz · Coffee Voucher · Pending → Rejected · (500 pts refunded)");
    });
  });

  describe("DELETE_POST / DELETE_COMMENT", () => {
    it("shows the author's resolved name when present", () => {
      const line = text(entry({
        action: "DELETE_POST",
        beforeState: { authorId: "u1", authorName: "Jane Cruz", content: "hello world" },
      }));
      expect(line).toBe('Post by Jane Cruz · "hello world"');
    });

    it("falls back to 'Unknown user' when the author name was never resolved", () => {
      const line = text(entry({
        action: "DELETE_COMMENT",
        beforeState: { authorId: "u1", content: "hi" },
      }));
      expect(line).toBe('Comment by Unknown user · "hi"');
    });
  });

  describe("UPDATE_SETTING", () => {
    it("no longer falls through to the raw entityType — this was the original display bug", () => {
      const line = text(entry({
        action: "UPDATE_SETTING",
        entityType: "AppSetting",
        afterState: { allyEnabled: true },
      }));
      expect(line).toBe("Ally assistant → Enabled");
    });
  });

  describe("HARD_DELETE_REWARD", () => {
    it("no longer falls through to the raw entityType", () => {
      const line = text(entry({
        action: "HARD_DELETE_REWARD",
        entityType: "Reward",
        beforeState: { name: "Coffee Voucher", pointCost: 500 },
      }));
      expect(line).toBe("Coffee Voucher · 500 pts");
    });
  });

  describe("CREATE_USER", () => {
    it("shows the new employee's name and role", () => {
      const line = text(entry({
        action: "CREATE_USER",
        afterState: { targetUserId: "u1", targetUserName: "Jane Cruz", role: "EMPLOYEE" },
      }));
      expect(line).toBe("Jane Cruz · Added as Employee");
    });
  });

  describe("MEDICINE_REQUEST_STATUS", () => {
    it("shows employee, medicine, and decision", () => {
      const line = text(entry({
        action: "MEDICINE_REQUEST_STATUS",
        afterState: {
          targetUserId: "u1",
          targetUserName: "Jane Cruz",
          medicineName: "Paracetamol",
          quantity: 2,
          toStatus: "APPROVED",
        },
      }));
      expect(line).toBe("Jane Cruz · Paracetamol ×2 · Approved");
    });
  });

  describe("CREATE_REWARD / UPDATE_REWARD / DELETE_REWARD", () => {
    it("CREATE_REWARD shows name and cost", () => {
      expect(text(entry({ action: "CREATE_REWARD", afterState: { name: "Coffee Voucher", pointCost: 500 } })))
        .toBe("Coffee Voucher · 500 pts");
    });

    it("UPDATE_REWARD shows only the field(s) that changed", () => {
      const line = text(entry({
        action: "UPDATE_REWARD",
        afterState: { name: "Coffee Voucher", changes: { pointCost: { from: 500, to: 400 } } },
      }));
      expect(line).toBe("Coffee Voucher · 500 → 400 pts");
    });

    it("DELETE_REWARD (soft) shows the reward was deactivated", () => {
      expect(text(entry({ action: "DELETE_REWARD", afterState: { name: "Coffee Voucher" } })))
        .toBe("Coffee Voucher · Deactivated");
    });
  });

  describe("UPDATE_FEEDBACK_STATUS", () => {
    it("shows category and status transition, never the reporter or content", () => {
      const line = text(entry({
        action: "UPDATE_FEEDBACK_STATUS",
        afterState: { category: "TEAM_DYNAMICS", fromStatus: "OPEN", toStatus: "RESOLVED" },
      }));
      expect(line).toBe("Team Dynamics · Open → Resolved");
    });
  });

  describe("SYNC_EMPLOYEES", () => {
    it("summarizes the bulk sync outcome in one row", () => {
      const line = text(entry({
        action: "SYNC_EMPLOYEES",
        afterState: { imported: 3, deactivated: 2, reactivated: 1, failedImports: 0 },
      }));
      expect(line).toBe("3 imported · 2 deactivated · 1 reactivated");
    });
  });
});

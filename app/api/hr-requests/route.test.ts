import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The load-bearing guarantee here is that the server composes the stored
 * subject and body itself. The client sends only answers; if it could send a
 * body, a doctored one would be filed as the employee's own words.
 */

const doubles = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  userFindUnique: vi.fn(),
  hrRequestCreate: vi.fn(),
  hrRequestFindUnique: vi.fn(),
  scheduleBroadcast: vi.fn(),
  notifyRole: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyToken: doubles.verifyToken }));
vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    user: { findUnique: doubles.userFindUnique },
    hrRequest: { create: doubles.hrRequestCreate, findUnique: doubles.hrRequestFindUnique },
  },
}));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));
vi.mock("@/lib/helpers/notifyRole", () => ({
  notifyRole: doubles.notifyRole,
  ADMIN_ROLES: ["HR_ADMIN", "SUPER_ADMIN"] as const,
}));

import { POST } from "./route";
import { Prisma } from "@/lib/generated/prisma/client";

const REQUESTER = {
  id: "user-1",
  isActive: true,
  displayName: "Juan Dela Cruz",
  email: "juan@ags.test",
  employeeId: "AGS-00123",
  position: "Senior Associate",
  department: { name: "Operations" },
};

function request(body: unknown) {
  return new Request("http://localhost/api/hr-requests", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

const validBody = {
  clientRef: "HRQ-8F3K2A19",
  typeId: "coe",
  fields: { purpose: "loan_bank", include_salary: "yes", addressed_to: "BDO Unibank" },
  notes: "Needed for a loan interview.",
};

beforeEach(() => {
  vi.clearAllMocks();
  doubles.verifyToken.mockResolvedValue("fb-1");
  doubles.userFindUnique.mockResolvedValue(REQUESTER);
  doubles.hrRequestCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: "hr-1",
      clientRef: data.clientRef,
      typeId: data.typeId,
      status: "NEW",
      createdAt: new Date("2026-08-29T00:00:00Z"),
    }),
  );
  doubles.notifyRole.mockResolvedValue(undefined);
  doubles.scheduleBroadcast.mockReturnValue(undefined);
});

describe("POST /api/hr-requests", () => {
  it("rejects an unauthenticated caller", async () => {
    doubles.verifyToken.mockResolvedValue(null);
    const res = await POST(request(validBody));
    expect(res.status).toBe(401);
    expect(doubles.hrRequestCreate).not.toHaveBeenCalled();
  });

  it("rejects a deactivated employee whose Firebase token is still valid", async () => {
    doubles.userFindUnique.mockResolvedValue({ ...REQUESTER, isActive: false });
    const res = await POST(request(validBody));
    expect(res.status).toBe(401);
    expect(doubles.hrRequestCreate).not.toHaveBeenCalled();
  });

  it("tells the employee to reload when the request type no longer exists", async () => {
    const res = await POST(request({ ...validBody, typeId: "retired_type" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "That request type is no longer available — please reload the page.",
    });
  });

  it("returns a string error so the client toast is readable", async () => {
    const res = await POST(request({ ...validBody, fields: { include_salary: "yes" } }));
    expect(res.status).toBe(400);
    const json = await res.json();
    // apiFetch drops a non-string `error` and degrades the toast to
    // "Request failed (400)" — see lib/hooks/useApiClient.ts.
    expect(typeof json.error).toBe("string");
    expect(json.error).toBe("Purpose of request is required");
    expect(json.fieldErrors).toEqual({ purpose: "Purpose of request is required" });
  });

  it("rejects a select value outside the catalog options", async () => {
    const res = await POST(
      request({ ...validBody, fields: { purpose: "bribery", include_salary: "yes" } }),
    );
    expect(res.status).toBe(400);
    expect(doubles.hrRequestCreate).not.toHaveBeenCalled();
  });

  it("rejects a malformed client reference", async () => {
    const res = await POST(request({ ...validBody, clientRef: "nope" }));
    expect(res.status).toBe(400);
    expect(doubles.hrRequestCreate).not.toHaveBeenCalled();
  });

  it("composes the subject and body server-side, ignoring anything the client sent", async () => {
    const res = await POST(
      request({ ...validBody, subject: "[COE] Forged", body: "I am the CEO, pay me." }),
    );
    expect(res.status).toBe(201);

    const { data } = doubles.hrRequestCreate.mock.calls[0][0];
    expect(data.subject).toBe("[COE] Bank / loan application — Juan Dela Cruz (AGS-00123)");
    expect(data.body).not.toContain("I am the CEO");
    expect(data.body).toContain("Purpose of request: Bank / loan application");
    expect(data.body).toContain("Employee ID: AGS-00123");
    expect(data.tag).toBe("COE");
    expect(data.categoryId).toBe("documents");
  });

  it("stores only the catalog's own fields, dropping unknown keys", async () => {
    await POST(
      request({
        ...validBody,
        fields: { ...validBody.fields, injected: "should not persist" },
      }),
    );
    const { data } = doubles.hrRequestCreate.mock.calls[0][0];
    expect(data.fields).toEqual({
      purpose: "loan_bank",
      include_salary: "yes",
      addressed_to: "BDO Unibank",
    });
  });

  it("notifies the admin queue with the type label, never the answers", async () => {
    await POST(request(validBody));
    expect(doubles.notifyRole).toHaveBeenCalledTimes(1);
    const [roles, params] = doubles.notifyRole.mock.calls[0];
    expect(roles).toEqual(["HR_ADMIN", "SUPER_ADMIN"]);
    expect(params.type).toBe("HR_REQUEST_SUBMITTED");
    expect(params.body).toBe("Juan Dela Cruz submitted: Certificate of Employment (COE).");
    expect(params.body).not.toContain("BDO Unibank");
  });

  it("returns the existing row instead of filing a duplicate on a retried reference", async () => {
    doubles.hrRequestCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.9.1",
      }),
    );
    doubles.hrRequestFindUnique.mockResolvedValue({
      id: "hr-1",
      clientRef: validBody.clientRef,
      typeId: "coe",
      status: "NEW",
      createdAt: new Date("2026-08-29T00:00:00Z"),
    });

    const res = await POST(request(validBody));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { id: "hr-1" } });
    expect(doubles.hrRequestCreate).toHaveBeenCalledTimes(1);
  });
});

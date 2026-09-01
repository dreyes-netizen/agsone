import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  accountFindMany: vi.fn(),
  accountCount: vi.fn(),
  accountFindUnique: vi.fn(),
  accountCreate: vi.fn(),
  scheduleBroadcast: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireRole")>(
    "@/lib/auth/requireRole"
  );
  return { verifyAuth: doubles.verifyAuth, requireRole: actual.requireRole };
});

vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    account: {
      findMany: doubles.accountFindMany,
      count: doubles.accountCount,
      findUnique: doubles.accountFindUnique,
      create: doubles.accountCreate,
    },
  },
}));

vi.mock("@/lib/realtime/broadcast", () => ({
  scheduleBroadcast: doubles.scheduleBroadcast,
}));

import { GET, POST } from "./route";

const HR_ADMIN = {
  id: "hr-1",
  firebaseUid: "fb-hr-1",
  email: "hr@ags.test",
  displayName: "HR Admin",
  role: "HR_ADMIN" as const,
  departmentId: null,
};

const EMPLOYEE = { ...HR_ADMIN, id: "emp-1", role: "EMPLOYEE" as const };

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/accounts", () => {
  it("returns 403 for a non-admin caller", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    const res = await GET(req("http://test/api/admin/accounts"));
    expect(res.status).toBe(403);
  });

  it("returns the account list for an HR_ADMIN caller", async () => {
    doubles.verifyAuth.mockResolvedValue(HR_ADMIN);
    doubles.accountFindMany.mockResolvedValue([
      { id: "a1", name: "EMB", createdAt: new Date("2026-01-01") },
      { id: "a2", name: "Flyland", createdAt: new Date("2026-01-02") },
    ]);
    doubles.accountCount.mockResolvedValue(2);
    const res = await GET(req("http://test/api/admin/accounts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe("EMB");
  });
});

describe("POST /api/admin/accounts", () => {
  it("returns 403 for a non-admin caller", async () => {
    doubles.verifyAuth.mockResolvedValue(EMPLOYEE);
    const res = await POST(req("http://test/api/admin/accounts", {
      method: "POST",
      body: JSON.stringify({ name: "Flyland" }),
    }));
    expect(res.status).toBe(403);
  });

  it("rejects a duplicate name", async () => {
    doubles.verifyAuth.mockResolvedValue(HR_ADMIN);
    doubles.accountFindUnique.mockResolvedValue({ id: "existing", name: "Flyland" });
    const res = await POST(req("http://test/api/admin/accounts", {
      method: "POST",
      body: JSON.stringify({ name: "Flyland" }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/);
  });

  it("creates an account and broadcasts", async () => {
    doubles.verifyAuth.mockResolvedValue(HR_ADMIN);
    doubles.accountFindUnique.mockResolvedValue(null);
    doubles.accountCreate.mockResolvedValue({
      id: "a3",
      name: "Flyland",
      createdAt: new Date("2026-01-03"),
    });
    const res = await POST(req("http://test/api/admin/accounts", {
      method: "POST",
      body: JSON.stringify({ name: "Flyland" }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Flyland");
    expect(doubles.scheduleBroadcast).toHaveBeenCalledWith([{ topic: "accounts" }]);
  });
});

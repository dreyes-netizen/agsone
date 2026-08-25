import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * displayName is intentionally not part of this route's schema (see the
 * roster-sync test at app/api/admin/employees/sync/route.test.ts for the
 * other half of this change) -- a self-service PATCH from onboarding must
 * never be able to override the name HR imported. This covers that a
 * displayName in the request body is silently ignored (zod strips unknown
 * keys by default) rather than written to the user's row.
 */

const doubles = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  userUpdate: vi.fn(),
  departmentFindUnique: vi.fn(),
  scheduleBroadcast: vi.fn(),
}));

vi.mock("@/lib/auth/verifyAuth", () => ({ verifyAuth: doubles.verifyAuth }));
vi.mock("@/lib/prisma/client", () => ({
  prisma: {
    user: { update: doubles.userUpdate },
    department: { findUnique: doubles.departmentFindUnique },
  },
}));
vi.mock("@/lib/realtime/broadcast", () => ({ scheduleBroadcast: doubles.scheduleBroadcast }));

import { PATCH } from "./route";

const USER = {
  id: "user-1",
  firebaseUid: "fb-1",
  email: "alice@ags.test",
  displayName: "Alice Wonder",
  role: "EMPLOYEE" as const,
  departmentId: null,
};

function request(body: unknown) {
  return new Request("http://localhost/api/auth/onboarding", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.verifyAuth.mockResolvedValue(USER);
  doubles.userUpdate.mockResolvedValue({ ...USER, onboardingComplete: true });
  doubles.departmentFindUnique.mockResolvedValue({ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", name: "Engineering" });
  doubles.scheduleBroadcast.mockReturnValue(undefined);
});

describe("PATCH /api/auth/onboarding", () => {
  it("ignores a displayName in the request body instead of writing it", async () => {
    const res = await PATCH(request({ displayName: "Hacked Name", birthday: "1990-01-01" }));
    expect(res.status).toBe(200);

    expect(doubles.userUpdate).toHaveBeenCalledTimes(1);
    const data = doubles.userUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("displayName");
    expect(data.onboardingComplete).toBe(true);
    expect(data.birthday).toEqual(new Date("1990-01-01"));
  });

  it("still succeeds with no displayName field at all", async () => {
    const res = await PATCH(request({ departmentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6" }));
    expect(res.status).toBe(200);

    const data = doubles.userUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("displayName");
    expect(data.departmentId).toBe("3fa85f64-5717-4562-b3fc-2c963f66afa6");
  });
});

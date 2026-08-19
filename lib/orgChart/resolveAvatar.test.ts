import { describe, it, expect } from "vitest";
import { resolveOrgChartAvatarUrl, withOrgChartPhotoUrl } from "./resolveAvatar";

describe("resolveOrgChartAvatarUrl", () => {
  it("prefers the org chart photo override when set", () => {
    const url = resolveOrgChartAvatarUrl({ orgChartPhotoPublicId: "ags-one/abc123", avatarUrl: "https://res.cloudinary.com/x/image/upload/profile.jpg" });
    expect(url).toContain("ags-one/abc123");
    expect(url).toContain("c_thumb,g_face");
  });

  it("falls back to the account avatar when there is no override", () => {
    const url = resolveOrgChartAvatarUrl({ orgChartPhotoPublicId: null, avatarUrl: "https://res.cloudinary.com/x/image/upload/profile.jpg" });
    expect(url).toBe("https://res.cloudinary.com/x/image/upload/profile.jpg");
  });

  it("falls back to null when neither exists (EmployeeNode's Avatar renders initials from there)", () => {
    expect(resolveOrgChartAvatarUrl({ orgChartPhotoPublicId: null, avatarUrl: null })).toBeNull();
  });
});

describe("withOrgChartPhotoUrl", () => {
  it("replaces orgChartPhotoPublicId with a resolved orgChartPhotoUrl, keeping other fields intact", () => {
    const result = withOrgChartPhotoUrl({
      id: "u1",
      displayName: "Carl Ong",
      avatarUrl: "https://res.cloudinary.com/x/image/upload/profile.jpg",
      orgChartPhotoPublicId: "ags-one/abc123",
    });
    expect(result).not.toHaveProperty("orgChartPhotoPublicId");
    expect(result.id).toBe("u1");
    expect(result.displayName).toBe("Carl Ong");
    expect(result.avatarUrl).toBe("https://res.cloudinary.com/x/image/upload/profile.jpg");
    expect(result.orgChartPhotoUrl).toContain("ags-one/abc123");
  });

  it("falls back to avatarUrl for orgChartPhotoUrl when there is no override — this is how Points of Contact picks up the same override the org chart uses", () => {
    const result = withOrgChartPhotoUrl({
      avatarUrl: "https://res.cloudinary.com/x/image/upload/profile.jpg",
      orgChartPhotoPublicId: null,
    });
    expect(result.orgChartPhotoUrl).toBe("https://res.cloudinary.com/x/image/upload/profile.jpg");
  });
});

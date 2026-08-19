import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildOrgChartPhotoUrl } from "./orgChartPhoto";

describe("buildOrgChartPhotoUrl", () => {
  const originalCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = originalCloudName;
  });

  it("builds a face-cropped, small-avatar delivery URL from a public_id", () => {
    const url = buildOrgChartPhotoUrl("ags-one/org-chart/carl-ong-abc123");
    expect(url).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/c_thumb,g_face,w_160,h_160,q_auto,f_auto/ags-one/org-chart/carl-ong-abc123",
    );
  });

  it("never uses the full-size w_1600 transform meant for feed images", () => {
    const url = buildOrgChartPhotoUrl("some-public-id");
    expect(url).not.toContain("w_1600");
  });
});

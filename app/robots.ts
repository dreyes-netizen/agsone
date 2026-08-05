import type { MetadataRoute } from "next";

// Internal, auth-gated company tool — nothing here should be crawled or indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}

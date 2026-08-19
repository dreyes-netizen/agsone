import { buildOrgChartPhotoUrl } from "./orgChartPhoto";

// A raw Cloudinary secure_url points at the original upload — full resolution,
// original format. A 4 MB phone photo would be served at full size into e.g.
// a 24px avatar or a 3-column feed thumbnail. Cloudinary can transform on
// delivery via URL segments, so insert them once here (at upload time, baked
// into the URL we store) instead of touching every place the URL is later
// rendered:
//   f_auto   — serve WebP/AVIF to browsers that support it, original format otherwise
//   q_auto   — Cloudinary picks the smallest quality that looks visually identical
//   w_1600,c_limit — never serve wider than 1600px, but only ever shrinks,
//                    never upscales or crops — 1600px is comfortably above
//                    anything this app displays, including the lightbox
const DELIVERY_TRANSFORM = "f_auto,q_auto,w_1600,c_limit";

function withDeliveryTransform(url: string): string {
  return url.includes("/upload/")
    ? url.replace("/upload/", `/upload/${DELIVERY_TRANSFORM}/`)
    : url;
}

export async function uploadToCloudinary(file: File, token: string): Promise<string> {
  // Step 1: Get a short-lived signature from our server (requires auth)
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!signRes.ok) throw new Error("Failed to get upload signature");
  const { timestamp, signature, apiKey, cloudName } = await signRes.json() as {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
  };

  // Step 2: Upload directly to Cloudinary with the signature — no upload preset needed
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json() as { secure_url: string };
  return withDeliveryTransform(data.secure_url);
}

// Org-chart photo override: unlike uploadToCloudinary, the caller needs the
// raw public_id (to persist and later destroy — see lib/cloudinary/destroy.ts
// and app/api/admin/org-chart/photo/route.ts), not just a delivery URL, and
// the delivery URL itself needs the small face-cropped avatar transform
// rather than the full-size w_1600 one baked into withDeliveryTransform.
export async function uploadOrgChartPhoto(file: File, token: string): Promise<{ publicId: string; url: string }> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!signRes.ok) throw new Error("Failed to get upload signature");
  const { timestamp, signature, apiKey, cloudName } = await signRes.json() as {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
  };

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json() as { public_id: string };
  return { publicId: data.public_id, url: buildOrgChartPhotoUrl(data.public_id) };
}

// For non-image files (PDFs, docs) — posts to Cloudinary's `raw` endpoint
// instead of `image`, and skips the image delivery transform above, which
// would otherwise try to rasterize the file. Returns the URL to the original
// file as uploaded.
export async function uploadRawToCloudinary(file: File, token: string): Promise<string> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!signRes.ok) throw new Error("Failed to get upload signature");
  const { timestamp, signature, apiKey, cloudName } = await signRes.json() as {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
  };

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json() as { secure_url: string };
  return data.secure_url;
}

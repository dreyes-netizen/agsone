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

type SignedUpload = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  params?: Record<string, string>;
};

// Every upload follows the same three steps: ask our server for a signature,
// POST the file straight to Cloudinary (the bytes never touch our server, so
// Vercel's request-size limit never applies), read back the delivery URL.
// `kind` picks Cloudinary's endpoint AND tells the sign route which params to
// sign — the two must agree or Cloudinary rejects the upload.
async function signedUpload(
  file: File,
  token: string,
  kind: "image" | "video" | "raw"
): Promise<Record<string, unknown>> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  if (!signRes.ok) throw new Error("Failed to get upload signature");
  const { timestamp, signature, apiKey, cloudName, params } = (await signRes.json()) as SignedUpload;

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  // Append exactly the extra params the server signed — no more, no less.
  for (const [k, v] of Object.entries(params ?? {})) {
    if (k !== "timestamp") form.append(k, v);
  }

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${kind}/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error("Upload failed");
  return (await res.json()) as Record<string, unknown>;
}

export async function uploadToCloudinary(file: File, token: string): Promise<string> {
  const data = await signedUpload(file, token, "image");
  return withDeliveryTransform(data.secure_url as string);
}

// Org-chart photo override: unlike uploadToCloudinary, the caller needs the
// raw public_id (to persist and later destroy — see lib/cloudinary/destroy.ts
// and app/api/admin/org-chart/photo/route.ts), not just a delivery URL, and
// the delivery URL itself needs the small face-cropped avatar transform
// rather than the full-size w_1600 one baked into withDeliveryTransform.
export async function uploadOrgChartPhoto(file: File, token: string): Promise<{ publicId: string; url: string }> {
  const data = await signedUpload(file, token, "image");
  const publicId = data.public_id as string;
  return { publicId, url: buildOrgChartPhotoUrl(publicId) };
}

// For non-image files (PDFs, docs) — posts to Cloudinary's `raw` endpoint
// instead of `image`, and skips the image delivery transform above, which
// would otherwise try to rasterize the file. Returns the URL to the original
// file as uploaded.
export async function uploadRawToCloudinary(file: File, token: string): Promise<string> {
  const data = await signedUpload(file, token, "raw");
  return data.secure_url as string;
}

// Video delivery transform. Distinct from the image one: no f_auto (that's an
// image-format hint), and vc_auto lets Cloudinary pick the codec per browser.
const VIDEO_DELIVERY_TRANSFORM = "q_auto,w_720,c_limit";

/**
 * Uploads a video and returns its delivery URL.
 *
 * Note the eager transcode requested in the sign route runs *asynchronously* —
 * `secure_url` here points at the original upload, which is correct and
 * playable immediately. The transform baked into the URL below is applied by
 * Cloudinary on first request, so the derived file is what actually gets
 * served and cached.
 */
export async function uploadVideoToCloudinary(file: File, token: string): Promise<string> {
  const data = await signedUpload(file, token, "video");
  const url = data.secure_url as string;
  return url.includes("/upload/")
    ? url.replace("/upload/", `/upload/${VIDEO_DELIVERY_TRANSFORM}/`)
    : url;
}

// Re-exported so callers importing from this module keep working.
export { videoPosterUrl } from "./videoUrl";

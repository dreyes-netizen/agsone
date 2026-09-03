import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { checkRateLimit } from "@/lib/guardrails/rateLimiter";
import { createHash } from "crypto";
import { z } from "zod";

const bodySchema = z.object({
  kind: z.enum(["image", "video", "raw"]).optional().default("image"),
});

// Cloudinary verifies a signature by re-hashing every upload parameter it
// receives (except file, api_key, cloud_name and resource_type), sorted
// alphabetically, joined with &, with the API secret appended. So the set of
// params we sign here has to match the set the browser actually sends — byte
// for byte — or the upload is rejected with "Invalid Signature".
//
// The client sends a `kind`, never the params themselves. If it could hand us
// arbitrary params to sign, an authenticated user could have us bless things
// we don't want (overwriting an existing public_id, a notification_url
// pointing anywhere, a transformation chain that burns credits). Deciding the
// params server-side keeps that surface closed.
function paramsForKind(kind: "image" | "video" | "raw"): Record<string, string> {
  if (kind !== "video") return {};
  return {
    // Transcode once, at upload, to a web-sized H.264 MP4 — we then store and
    // serve that instead of the phone's original. A 50 MB 1080p clip lands
    // around 6-10 MB, which is the difference between video fitting in the
    // Cloudinary credit budget and not.
    eager: "q_auto,w_720,c_limit,vc_h264/mp4",
    // Transcoding a 50 MB file is not instant. Without this the upload POST
    // blocks until Cloudinary finishes and the browser request times out.
    eager_async: "true",
  };
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(user.id, "write");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429 });
  }

  // Tolerate a bodyless POST — the original callers send none and must keep working.
  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload kind" }, { status: 400 });

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!apiSecret || !apiKey || !cloudName) {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const params: Record<string, string> = { ...paramsForKind(parsed.data.kind), timestamp: String(timestamp) };

  const signature = createHash("sha1")
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("&") + apiSecret
    )
    .digest("hex");

  // `params` is echoed back so the client appends exactly what we signed.
  return NextResponse.json({ timestamp, signature, apiKey, cloudName, params });
}

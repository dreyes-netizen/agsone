import { v2 as cloudinary } from "cloudinary";

// Server-only asset cleanup for the org-chart photo override. Deliberately
// separate from lib/cloudinary/upload.ts (client-side, signed-upload flow) —
// destroying an asset needs the API secret, which must never reach the
// browser. Always call this fire-and-forget (`.catch(() => {})`) from the
// route that just persisted the new state; a failed cleanup should never
// block or fail the request that triggered it.
export async function destroyCloudinaryAsset(publicId: string): Promise<void> {
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  await cloudinary.uploader.destroy(publicId);
}

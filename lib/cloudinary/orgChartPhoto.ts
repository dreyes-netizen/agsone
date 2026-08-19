// Small, face-cropped delivery transform for org-chart headshots — distinct
// from lib/cloudinary/upload.ts's DELIVERY_TRANSFORM, which targets full-size
// feed/content images (w_1600,c_limit). The chart only ever renders this at
// avatar size, so serve it that small instead of a giant original:
//   c_thumb,g_face — crop to a square, centered on the detected face
//   w_160,h_160    — comfortably above the ~48px rendered size for retina
//   q_auto,f_auto  — same "smallest visually-identical quality/format" policy
const ORG_CHART_PHOTO_TRANSFORM = "c_thumb,g_face,w_160,h_160,q_auto,f_auto";

export function buildOrgChartPhotoUrl(publicId: string): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${ORG_CHART_PHOTO_TRANSFORM}/${publicId}`;
}

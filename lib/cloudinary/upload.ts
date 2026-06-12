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
  return data.secure_url;
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { uploadPdf } from "@/lib/supabase/storageClient";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.policyDocument.findMany({
    orderBy: { uploadedAt: "desc" },
    include: { uploadedBy: { select: { displayName: true } } },
  });

  return NextResponse.json({ data: documents });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;

  if (!file || !name?.trim()) {
    return NextResponse.json({ error: "file and name are required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
  }
  const TEN_MB = 10 * 1024 * 1024;
  if (file.size > TEN_MB) {
    return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storagePath = `${randomUUID()}-${file.name.replace(/\s+/g, "_")}`;

  await uploadPdf(storagePath, buffer);

  const doc = await prisma.policyDocument.create({
    data: {
      name: name.trim(),
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      uploadedById: user!.id,
    },
    include: { uploadedBy: { select: { displayName: true } } },
  });

  return NextResponse.json({ data: doc }, { status: 201 });
}

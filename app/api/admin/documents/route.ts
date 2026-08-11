import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { parsePaginationParams, paginatedResponse } from "@/lib/api/pagination";
import { uploadPdf } from "@/lib/supabase/storageClient";
import { storeDocumentChunks } from "@/lib/rag/search";
import { randomUUID } from "crypto";
import { extractText, getDocumentProxy } from "unpdf";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePaginationParams(searchParams);

  const [documents, total] = await Promise.all([
    // `include` with no `select` returned every column, including `content`
    // — the full extracted PDF text, potentially megabytes per row — for a
    // list view that only ever displays name/fileName/fileSize/isActive/
    // uploadedAt. Select just those instead.
    prisma.policyDocument.findMany({
      orderBy: { uploadedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        fileName: true,
        fileSize: true,
        isActive: true,
        uploadedAt: true,
        uploadedBy: { select: { displayName: true } },
      },
    }),
    prisma.policyDocument.count(),
  ]);

  return NextResponse.json(paginatedResponse(documents, total, page, limit));
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;

  if (!file || !name?.trim()) {
    return NextResponse.json({ error: "file and name are required" }, { status: 400 });
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  const isPdf = file.type === "application/pdf" || ext === "pdf";
  const isText = ["text/markdown", "text/plain", "application/octet-stream", ""].includes(file.type) && (ext === "md" || ext === "txt");
  if (!isPdf && !isText) {
    return NextResponse.json({ error: "Only PDF, Markdown (.md), or plain text (.txt) files are allowed" }, { status: 400 });
  }
  const TEN_MB = 10 * 1024 * 1024;
  if (file.size > TEN_MB) {
    return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storagePath = `${randomUUID()}-${file.name.replace(/\s+/g, "_")}`;

  let text: string;
  if (isPdf) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const parsed = await extractText(pdf, { mergePages: true });
    text = parsed.text as string;
    await uploadPdf(storagePath, buffer, "application/pdf");
  } else {
    text = buffer.toString("utf-8");
    await uploadPdf(storagePath, buffer, "text/plain");
  }

  const doc = await prisma.policyDocument.create({
    data: {
      name: name.trim(),
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      content: text,
      uploadedById: user.id,
    },
    include: { uploadedBy: { select: { displayName: true } } },
  });

  // Chunk and embed for RAG — runs in background, doesn't block response
  storeDocumentChunks(doc.id, text).catch((err) =>
    console.error(`[RAG] Failed to index document ${doc.id}:`, err)
  );

  return NextResponse.json({ data: doc }, { status: 201 });
}

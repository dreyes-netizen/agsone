
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { prisma } from "@/lib/prisma/client";
import { storeDocumentChunks, deleteDocumentChunks } from "@/lib/rag/search";

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.policyDocument.findMany({
    where: { isActive: true, content: { not: null } },
    select: { id: true, name: true, content: true },
  });

  const results: { name: string; status: string }[] = [];

  for (const doc of documents) {
    try {
      await deleteDocumentChunks(doc.id);
      await storeDocumentChunks(doc.id, doc.content!);
      results.push({ name: doc.name, status: "indexed" });
    } catch (err) {
      results.push({ name: doc.name, status: `failed: ${err instanceof Error ? err.message : "unknown"}` });
    }
  }

  return NextResponse.json({ data: results });
}

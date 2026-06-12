import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requireRole } from "@/lib/auth/verifyAuth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!requireRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "vacation sick leave days";

  // How many chunks per document?
  const { data: counts } = await supabase
    .from("document_chunks")
    .select("document_id", { count: "exact" });

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.document_id] = (countMap[row.document_id] ?? 0) + 1;
  }

  // Sample first 3 chunks from each document
  const { data: samples } = await supabase
    .from("document_chunks")
    .select("document_id, chunk_index, content")
    .order("chunk_index")
    .limit(6);

  // Run the actual search
  const { data: searchResults, error: searchError } = await supabase.rpc(
    "match_document_chunks",
    { query_text: query, match_count: 8 },
  );

  return NextResponse.json({
    chunkCounts: countMap,
    sampleChunks: (samples ?? []).map((s) => ({
      document_id: s.document_id,
      chunk_index: s.chunk_index,
      preview: (s.content as string).slice(0, 200),
    })),
    searchQuery: query,
    searchHits: searchResults?.length ?? 0,
    searchError: searchError?.message ?? null,
    searchResults: (searchResults ?? []).map((r: { document_name: string; content: string }) => ({
      document: r.document_name,
      preview: r.content.slice(0, 200),
    })),
  });
}

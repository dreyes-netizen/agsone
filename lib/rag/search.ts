import { createClient } from "@supabase/supabase-js";
import { chunkText } from "./chunker";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function storeDocumentChunks(documentId: string, text: string): Promise<void> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  const rows = chunks.map((content, i) => ({
    document_id: documentId,
    content,
    chunk_index: i,
  }));

  const { error } = await supabase.from("document_chunks").insert(rows);
  if (error) throw new Error(`Failed to store chunks: ${error.message}`);
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const { error } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_id", documentId);
  if (error) throw new Error(`Failed to delete chunks: ${error.message}`);
}

type ChunkResult = { content: string; document_name: string; uploaded_at: string; chunk_index: number; document_id: string };

// Common words to ignore when building ilike search terms
const STOP_WORDS = new Set([
  "how", "many", "much", "do", "did", "does", "i", "me", "my", "we", "our",
  "get", "have", "can", "what", "when", "who", "which", "where", "why", "is",
  "are", "was", "the", "a", "an", "in", "on", "at", "to", "for", "of", "and",
  "or", "if", "about", "with", "per", "be", "will", "not",
]);

async function getActiveDocs() {
  const { data } = await supabase
    .from("PolicyDocument")
    .select("id, name, uploadedAt")
    .eq("isActive", true);
  return data ?? [];
}

export async function searchRelevantChunks(query: string, matchCount = 8): Promise<string[]> {
  // 1. Full-text search (tsvector) — fast, handles stemming
  const { data: ftsData, error } = await supabase.rpc("match_document_chunks", {
    query_text: query,
    match_count: matchCount,
  });

  if (error) throw new Error(`Search failed: ${error.message}`);

  if (ftsData && ftsData.length > 0) {
    const ftsChunks = ftsData as ChunkResult[];

    // Build document name map from FTS results
    const docNameMap = new Map<string, string>();
    for (const r of ftsChunks) docNameMap.set(r.document_id, r.document_name);

    // Collect neighbor indices per document
    const neighborMap = new Map<string, Set<number>>();
    for (const r of ftsChunks) {
      if (!neighborMap.has(r.document_id)) neighborMap.set(r.document_id, new Set());
      const indices = neighborMap.get(r.document_id)!;
      if (r.chunk_index > 0) indices.add(r.chunk_index - 1);
      indices.add(r.chunk_index);
      indices.add(r.chunk_index + 1);
    }

    const seen = new Set<string>();
    const expanded: { content: string; document_id: string; chunk_index: number }[] = [];

    for (const r of ftsChunks) {
      const key = r.content.slice(0, 60);
      if (!seen.has(key)) { seen.add(key); expanded.push(r); }
    }

    for (const [docId, indices] of neighborMap) {
      const { data: neighbors } = await supabase
        .from("document_chunks")
        .select("content, document_id, chunk_index")
        .eq("document_id", docId)
        .in("chunk_index", [...indices].sort((a, b) => a - b))
        .order("chunk_index");

      for (const row of neighbors ?? []) {
        const key = (row.content as string).slice(0, 60);
        if (!seen.has(key)) {
          seen.add(key);
          expanded.push(row as { content: string; document_id: string; chunk_index: number });
        }
      }
    }

    expanded.sort((a, b) =>
      a.document_id.localeCompare(b.document_id) || a.chunk_index - b.chunk_index,
    );

    return expanded.slice(0, matchCount + 4).map((r) =>
      `[Source: ${docNameMap.get(r.document_id) ?? "Unknown"}]\n${r.content}`
    );
  }

  // 2. ilike fallback — catches abbreviations (VL, SL) and non-English terms
  const activeDocs = await getActiveDocs();
  const activeIds = activeDocs.map((d: { id: string }) => d.id);
  if (activeIds.length === 0) return [];

  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (terms.length > 0) {
    const seen = new Set<string>();
    const ilikeResults: { content: string; document_id: string; chunk_index: number }[] = [];

    for (const term of terms.slice(0, 4)) {
      const { data: ilikeData } = await supabase
        .from("document_chunks")
        .select("content, document_id, chunk_index")
        .in("document_id", activeIds)
        .ilike("content", `%${term}%`)
        .order("chunk_index")
        .limit(4);

      for (const row of ilikeData ?? []) {
        const key = (row.content as string).slice(0, 60);
        if (!seen.has(key)) {
          seen.add(key);
          ilikeResults.push(row as { content: string; document_id: string; chunk_index: number });
        }
      }

      if (ilikeResults.length >= matchCount) break;
    }

    if (ilikeResults.length > 0) {
      const docMap = Object.fromEntries(
        activeDocs.map((d: { id: string; name: string }) => [d.id, d]),
      );

      // Fetch adjacent chunks (prev + next) for each match to capture full context
      const neighborMap = new Map<string, Set<number>>();
      for (const r of ilikeResults) {
        if (!neighborMap.has(r.document_id)) neighborMap.set(r.document_id, new Set());
        const indices = neighborMap.get(r.document_id)!;
        if (r.chunk_index > 0) indices.add(r.chunk_index - 1);
        indices.add(r.chunk_index);
        indices.add(r.chunk_index + 1);
      }

      const expanded: { content: string; document_id: string; chunk_index: number }[] = [];
      const expandedSeen = new Set<string>();

      for (const [docId, indices] of neighborMap) {
        const { data: neighbors } = await supabase
          .from("document_chunks")
          .select("content, document_id, chunk_index")
          .eq("document_id", docId)
          .in("chunk_index", [...indices].sort((a, b) => a - b))
          .order("chunk_index");

        for (const row of neighbors ?? []) {
          const key = (row.content as string).slice(0, 60);
          if (!expandedSeen.has(key)) {
            expandedSeen.add(key);
            expanded.push(row as { content: string; document_id: string; chunk_index: number });
          }
        }
      }

      expanded.sort((a, b) =>
        a.document_id.localeCompare(b.document_id) || a.chunk_index - b.chunk_index,
      );

      return expanded.slice(0, matchCount + 4).map((r) =>
        `[Source: ${docMap[r.document_id]?.name ?? "Unknown"}]\n${r.content}`
      );
    }
  }

  // 3. Last resort: spread chunks across the whole document (not just first N)
  const total = await supabase
    .from("document_chunks")
    .select("chunk_index", { count: "exact", head: true })
    .in("document_id", activeIds);
  const totalCount = total.count ?? 0;
  const step = totalCount > matchCount ? Math.floor(totalCount / matchCount) : 1;

  const { data: spreadChunks } = await supabase
    .from("document_chunks")
    .select("content, document_id, chunk_index")
    .in("document_id", activeIds)
    .order("chunk_index")
    .limit(matchCount * step); // fetch enough to sample every Nth

  const sampled = (spreadChunks ?? []).filter((_, i) => i % Math.max(step, 1) === 0).slice(0, matchCount);

  const docMap = Object.fromEntries(
    activeDocs.map((d: { id: string; name: string }) => [d.id, d]),
  );
  return sampled.map((r: { content: string; document_id: string }) =>
    `[Source: ${docMap[r.document_id]?.name ?? "Unknown"}]\n${r.content}`
  );
}

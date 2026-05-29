// Matches table-of-contents lines: "Section title .............. 12"
const TOC_LINE = /^.{1,120}\.{3,}\s*\d{1,4}\s*$/;

function stripTocLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !TOC_LINE.test(line.trim()))
    .join("\n");
}

export function chunkText(text: string, maxChunkSize = 800, overlap = 150): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => stripTocLines(p).trim())
    .filter((p) => p.length > 30);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    // Oversized single paragraph — split by character with overlap
    if (para.length > maxChunkSize) {
      if (current) { chunks.push(current); current = ""; }
      let start = 0;
      while (start < para.length) {
        const end = Math.min(start + maxChunkSize, para.length);
        const slice = para.slice(start, end).trim();
        if (slice.length > 30) chunks.push(slice);
        if (end === para.length) break;
        start += maxChunkSize - overlap;
      }
      continue;
    }

    if (current.length + para.length + 2 <= maxChunkSize) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) {
        chunks.push(current);
        // Carry the last paragraph into the next chunk as context overlap
        const tail = current.split("\n\n").pop() ?? "";
        current = tail.length + para.length + 2 <= maxChunkSize
          ? `${tail}\n\n${para}`
          : para;
      } else {
        current = para;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

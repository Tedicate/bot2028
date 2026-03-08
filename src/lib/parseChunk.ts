export interface ParsedChunk {
  university: string;
  year: number | null;
  document_type: string;
  admission_type: string;
  content_type: string;
  content: string;
}

export function parseChunk(chunkText: string): ParsedChunk | null {
  const metaMatch = chunkText.match(/\[META\]([\s\S]*?)\[\/META\]/);
  if (!metaMatch) return null;

  const metaLines = metaMatch[1].trim().split("\n");
  const meta: Record<string, string> = {};
  metaLines.forEach((line) => {
    const [key, ...valueParts] = line.split(":");
    if (key && valueParts.length) {
      meta[key.trim()] = valueParts.join(":").trim();
    }
  });

  const content = chunkText.replace(/\[META\][\s\S]*?\[\/META\]/, "").trim();

  return {
    university: meta["university"] || "",
    year: parseInt(meta["year"]) || null,
    document_type: meta["document_type"] || "",
    admission_type: meta["admission_type"] || "",
    content_type: meta["content_type"] || "",
    content,
  };
}

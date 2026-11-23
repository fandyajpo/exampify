/**
 * Reading time (`CONTENT_MODEL.md` §4.6): `ceil(words / 200)`, minimum 1, computed on every
 * block write. Markdown syntax is stripped first so headings, links and code fences do not
 * inflate the count; only prose blocks carry `markdown`.
 */

export type ProseBlock = { payload: Record<string, unknown> };

export function readingMinutesFromBlocks(blocks: readonly ProseBlock[]): number {
  let words = 0;

  for (const block of blocks) {
    const markdown = block.payload.markdown;
    if (typeof markdown !== "string") continue;

    const text = markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_~-]+/g, " ");
    words += text.split(/\s+/).filter(Boolean).length;
  }

  return Math.max(1, Math.ceil(words / 200));
}

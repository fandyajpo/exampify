/**
 * Text-safe HTML for authored Markdown, used by payloads that promise HTML
 * (`API_CONTRACTS.md` §5.1 `stemHtml`) before the block pipeline in `lib/markdown` lands.
 *
 * Every character of the source is escaped first, so authored HTML, a stray `<script>` or an
 * unrendered TeX expression can never become live markup. Blank lines separate paragraphs,
 * a single newline is a line break — the same rule the rich editor already uses when it
 * saves Markdown. Emphasis, tables and maths stay literal text until the real renderer
 * exists; that is a known gap, not a silent one.
 */

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

/** Paragraphs of escaped text. Returns `""` for input that is only whitespace. */
export function markdownTextToHtml(source: string): string {
  const blocks = source
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block !== "");

  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

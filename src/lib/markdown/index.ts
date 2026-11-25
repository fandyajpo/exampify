/**
 * `lib/markdown` — parse, sanitise, render and KaTeX
 * ([PRODUCT_ARCHITECTURE.md](../../../docs/PRODUCT_ARCHITECTURE.md) §6,
 * [CONTENT_MODEL.md](../../../docs/CONTENT_MODEL.md) §8).
 *
 * The block pipeline is not implemented yet. What exists is `./text`: escaped,
 * paragraph-level rendering for payloads that must carry HTML before then.
 * TODO: export `renderMarkdown(source)`; keep sanitisation inside it, not at call sites.
 */
export { escapeHtml, markdownTextToHtml } from "./text";

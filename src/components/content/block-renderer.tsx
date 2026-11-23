import "katex/dist/katex.min.css";

import Image from "next/image";
import katex from "katex";

import { Markdown } from "@/components/content/markdown";
import { Callout } from "@/components/ui/callout";
import type { BlockPayload } from "@/lib/validation/blocks";

/**
 * Block renderer (`DESIGN_SYSTEM.md` §9.5, `CONTENT_MODEL.md` §5): one component per block
 * type, chosen by the validated discriminant. Presentational only — the caller supplies
 * blocks and any media it resolved.
 *
 * `question_section` and `related_material` need published link targets (Phase 3); until
 * there are any, they render nothing rather than an empty shell.
 */

export type ResolvedMedia = { url: string; alt: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VideoBlock({
  provider,
  providerId,
  title,
}: {
  provider: "youtube" | "vimeo";
  providerId: string;
  title: string;
}): React.JSX.Element {
  const src =
    provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(providerId)}`
      : `https://player.vimeo.com/video/${encodeURIComponent(providerId)}`;

  return (
    <figure className="overflow-hidden rounded-md border border-line bg-paper-raised">
      <div className="relative aspect-video">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
        />
      </div>
      <figcaption className="border-t border-line px-4 py-2 text-sm text-ink-3">{title}</figcaption>
    </figure>
  );
}

function BlockContent({
  block,
  media,
}: {
  block: BlockPayload;
  media: Record<string, ResolvedMedia>;
}): React.JSX.Element | null {
  switch (block.kind) {
    case "rich_text":
      return <Markdown>{block.payload.markdown}</Markdown>;

    case "heading": {
      const Tag = block.payload.level === 2 ? "h2" : "h3";
      return (
        <Tag
          id={block.payload.anchor}
          className={
            block.payload.level === 2
              ? "scroll-mt-24 font-display text-2xl font-semibold tracking-[-0.015em] text-ink"
              : "scroll-mt-24 font-display text-xl font-semibold tracking-[-0.01em] text-ink"
          }
        >
          {block.payload.text}
        </Tag>
      );
    }

    case "formula":
      return (
        <div className="overflow-x-auto py-2 text-ink">
          <span
            // KaTeX produces its own markup from the stored LaTeX; no author HTML is involved.
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(block.payload.latex, {
                displayMode: block.payload.displayMode,
                throwOnError: false,
                strict: false,
              }),
            }}
          />
        </div>
      );

    case "table":
      return (
        <figure className="max-w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {block.payload.header.map((cell, index) => (
                  <th
                    key={`${cell}-${index}`}
                    scope="col"
                    className="border-b border-line-strong px-3 py-2 font-semibold text-ink"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.payload.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${rowIndex}-${cellIndex}`}
                      className="border-b border-line px-3 py-2 align-top text-ink-2"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.payload.caption ? (
            <figcaption className="mt-2 text-sm text-ink-3">{block.payload.caption}</figcaption>
          ) : null}
        </figure>
      );

    case "callout":
      return (
        <Callout tone={block.payload.tone}>
          <Markdown>{block.payload.markdown}</Markdown>
        </Callout>
      );

    case "image": {
      const resolved = media[block.payload.mediaId];
      if (!resolved) return null;
      return (
        <figure className="max-w-full">
          <Image
            src={resolved.url}
            alt={resolved.alt}
            width={block.payload.width}
            height={block.payload.height}
            sizes="(max-width: 768px) 100vw, 720px"
            className="h-auto w-full rounded-md border border-line"
          />
          {block.payload.caption ? (
            <figcaption className="mt-2 max-w-[68ch] text-sm text-ink-3">
              {block.payload.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case "video":
      return (
        <VideoBlock
          provider={block.payload.provider}
          providerId={block.payload.providerId}
          title={block.payload.title}
        />
      );

    case "download": {
      const resolved = media[block.payload.mediaId];
      if (!resolved) return null;
      return (
        <a
          href={resolved.url}
          className="inline-flex min-h-11 max-w-[68ch] items-center gap-3 rounded-md border border-line-strong bg-paper-raised px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40"
          download
        >
          <span>{block.payload.label}</span>
          <span className="text-ink-3">{formatBytes(block.payload.byteSize)}</span>
        </a>
      );
    }

    case "question_section":
    case "related_material":
      return null;
  }
}

export function BlockRenderer({
  blocks,
  media = {},
}: {
  blocks: BlockPayload[];
  media?: Record<string, ResolvedMedia>;
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) => (
        <BlockContent key={index} block={block} media={media} />
      ))}
    </div>
  );
}

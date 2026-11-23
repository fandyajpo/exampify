import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown rendering for `rich_text` and `callout` bodies (`CONTENT_MODEL.md` §5). Raw HTML
 * is not rendered — `react-markdown` ignores it unless a raw plugin is added — so stored
 * Markdown cannot inject markup.
 *
 * Typography comes from `@tailwindcss/typography`-free utilities tuned to the design tokens;
 * the project intentionally does not add another plugin for a handful of elements.
 */
export function Markdown({ children }: { children: string }): React.JSX.Element {
  return (
    <div className="space-y-4 text-[1.0625rem] leading-[1.7] text-ink-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: (props) => (
            <h2
              className="mt-10 font-display text-2xl font-semibold tracking-[-0.015em] text-ink"
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="mt-8 font-display text-xl font-semibold tracking-[-0.01em] text-ink"
              {...props}
            />
          ),
          p: (props) => <p className="max-w-[68ch] text-pretty" {...props} />,
          strong: (props) => <strong className="font-semibold text-ink" {...props} />,
          em: (props) => <em className="italic" {...props} />,
          ul: (props) => <ul className="max-w-[68ch] list-disc space-y-1.5 pl-6" {...props} />,
          ol: (props) => <ol className="max-w-[68ch] list-decimal space-y-1.5 pl-6" {...props} />,
          li: (props) => <li className="pl-1" {...props} />,
          a: (props) => (
            <a
              className="text-cobalt underline-offset-[3px] hover:underline"
              rel="noopener"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="max-w-[68ch] border-l-2 border-line-strong pl-4 text-ink-2 italic"
              {...props}
            />
          ),
          code: (props) => (
            <code
              className="rounded-xs bg-paper-sunk px-1.5 py-0.5 font-mono text-[0.9em] text-ink"
              {...props}
            />
          ),
          pre: (props) => (
            <pre
              className="overflow-x-auto rounded-md border border-line bg-paper-sunk p-4 font-mono text-sm text-ink"
              {...props}
            />
          ),
          hr: () => <hr className="my-10 border-line" />,
          table: (props) => (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm" {...props} />
            </div>
          ),
          th: (props) => (
            <th
              className="border-b border-line-strong px-3 py-2 font-semibold text-ink"
              {...props}
            />
          ),
          td: (props) => <td className="border-b border-line px-3 py-2 align-top" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

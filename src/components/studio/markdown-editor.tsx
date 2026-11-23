"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

import { cn } from "@/lib/utils";

/**
 * The prose editor (`CONTENT_MODEL.md` §5.1): Tiptap for the editing experience, Markdown
 * for storage. Prose blocks keep GitHub-Flavored Markdown so diffs stay readable and the
 * server renders it through the sanitising pipeline — the editor never stores HTML.
 *
 * `immediatelyRender: false` keeps the server-rendered markup stable through hydration.
 */

const TOOLBAR: Array<{ label: string; title: string; run: (chain: Chain) => Chain }> = [
  { label: "B", title: "Bold", run: (chain) => chain.toggleBold() },
  { label: "I", title: "Italic", run: (chain) => chain.toggleItalic() },
  { label: "H2", title: "Heading 2", run: (chain) => chain.toggleHeading({ level: 2 }) },
  { label: "H3", title: "Heading 3", run: (chain) => chain.toggleHeading({ level: 3 }) },
  { label: "•", title: "Bullet list", run: (chain) => chain.toggleBulletList() },
  { label: "1.", title: "Numbered list", run: (chain) => chain.toggleOrderedList() },
  { label: "❝", title: "Quote", run: (chain) => chain.toggleBlockquote() },
];

type Chain = ReturnType<NonNullable<ReturnType<typeof useEditor>>["chain"]>;

export function MarkdownEditor({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (markdown: string) => void;
  label: string;
  className?: string;
}): React.JSX.Element {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      Markdown.configure({ html: false, tightLists: true, linkify: true, breaks: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose-editor min-h-40 px-3 py-2 text-base text-ink focus:outline-none",
        "aria-label": label,
      },
    },
    onUpdate: ({ editor: instance }) => {
      const storage = instance.storage as unknown as { markdown: { getMarkdown(): string } };
      onChange(storage.markdown.getMarkdown());
    },
  });

  if (!editor) {
    return <div className={cn("min-h-48 rounded-sm border border-line-strong bg-paper-raised", className)} />;
  }

  return (
    <div className={cn("rounded-sm border border-line-strong bg-paper-raised", className)}>
      <div role="toolbar" aria-label={`${label} formatting`} className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
        {TOOLBAR.map((tool) => (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            aria-label={tool.title}
            aria-pressed={false}
            onClick={() => tool.run(editor.chain().focus()).run()}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-sm px-2 text-sm font-medium text-ink-2 transition-colors hover:bg-paper hover:text-ink"
          >
            {tool.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

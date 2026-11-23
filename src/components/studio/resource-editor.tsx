"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { MarkdownEditor } from "@/components/studio/markdown-editor";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import type { BlockDto, GateResult } from "@/lib/validation/resources";

/**
 * The block editor (`API_CONTRACTS.md` §7.2, §12).
 *
 * Autosave runs 4 s after the last edit and carries the `updatedAt` the block was read or
 * last saved with. A `409` never overwrites: the block shows the conflict and offers
 * "Reload theirs" or "Overwrite", exactly the two choices §12 documents.
 *
 * `rich_text` and `callout` are edited as Markdown through Tiptap; every other kind is a
 * whole-payload JSON editor, because the payload contract is what the server validates.
 */

const AUTOSAVE_MS = 4_000;

const KIND_LABEL: Record<string, string> = {
  rich_text: "Text",
  heading: "Heading",
  image: "Image",
  formula: "Formula",
  table: "Table",
  callout: "Callout",
  video: "Video",
  download: "Download",
  question_section: "Question section",
  related_material: "Related material",
};

const DEFAULT_PAYLOAD: Record<string, Record<string, unknown>> = {
  rich_text: { v: 1, markdown: "Write the explanation here." },
  heading: { v: 1, level: 2, text: "New heading" },
  formula: { v: 1, latex: "E = mc^2", displayMode: true },
  table: { v: 1, header: ["Term", "Meaning"], rows: [["Cell", "The unit of life"]] },
  callout: { v: 1, tone: "tip", markdown: "A short tip." },
  video: { v: 1, provider: "youtube", providerId: "", title: "Video", durationSeconds: 60 },
  download: { v: 1, mediaId: "", label: "Download", byteSize: 1 },
  question_section: { v: 1, assessmentId: "" },
  related_material: { v: 1, resourceIds: [] },
  image: { v: 1, mediaId: "", width: 1200, height: 800 },
};

type BlockStatus = "clean" | "dirty" | "saving" | "saved" | "conflict" | "error";

type DraftBlock = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  text: string;
  updatedAt: string;
  status: BlockStatus;
  message?: string;
  serverUpdatedAt?: string;
};

function toDraft(block: BlockDto): DraftBlock {
  return {
    id: block.id,
    kind: block.kind,
    payload: block.payload,
    text: JSON.stringify(block.payload, null, 2),
    updatedAt: block.updatedAt,
    status: "clean",
  };
}

const STATUS_TEXT: Record<BlockStatus, string> = {
  clean: "",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  conflict: "Conflict",
  error: "Not saved",
};

export function ResourceEditor({
  resourceId,
  blocks: initial,
}: {
  resourceId: string;
  blocks: BlockDto[];
}): React.JSX.Element {
  const router = useRouter();
  const [blocks, setBlocks] = useState<DraftBlock[]>(initial.map(toDraft));
  const [addKind, setAddKind] = useState("rich_text");
  const [gate, setGate] = useState<GateResult | null>(null);
  const [validating, setValidating] = useState(false);

  const drafts = useRef<Map<string, DraftBlock>>(new Map(initial.map((block) => [block.id, toDraft(block)])));
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  const update = useCallback((id: string, patch: Partial<DraftBlock>) => {
    setBlocks((current) =>
      current.map((block) => {
        if (block.id !== id) return block;
        const next = { ...block, ...patch };
        drafts.current.set(id, next);
        return next;
      }),
    );
  }, []);

  const save = useCallback(
    async (id: string, expectedUpdatedAt?: string) => {
      const draft = drafts.current.get(id);
      if (!draft) return;

      update(id, { status: "saving", message: "" });

      let payload = draft.payload;
      if (draft.kind !== "rich_text" && draft.kind !== "callout") {
        try {
          payload = JSON.parse(draft.text) as Record<string, unknown>;
        } catch {
          update(id, { status: "error", message: "That payload is not valid JSON." });
          return;
        }
      }

      try {
        const response = await fetch(`/api/v1/studio/blocks/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            payload,
            expectedUpdatedAt: expectedUpdatedAt ?? draft.updatedAt,
          }),
        });

        if (response.status === 409) {
          const body = (await response.json()) as {
            error?: { currentUpdatedAt?: string };
          };
          update(id, {
            status: "conflict",
            message: "",
            ...(body.error?.currentUpdatedAt ? { serverUpdatedAt: body.error.currentUpdatedAt } : {}),
          });
          return;
        }

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { message?: string; details?: { message: string }[] } }
            | null;
          update(id, {
            status: "error",
            message: body?.error?.details?.[0]?.message ?? body?.error?.message ?? "Could not save this block.",
          });
          return;
        }

        const body = (await response.json()) as { data: BlockDto };
        update(id, {
          status: "saved",
          payload: body.data.payload,
          text: JSON.stringify(body.data.payload, null, 2),
          updatedAt: body.data.updatedAt,
          message: "",
        });
      } catch {
        update(id, { status: "error", message: "Network error. Your changes are still here." });
      }
    },
    [update],
  );

  const schedule = useCallback(
    (id: string) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          void save(id);
        }, AUTOSAVE_MS),
      );
    },
    [save],
  );

  const editPayload = useCallback(
    (id: string, payload: Record<string, unknown>) => {
      update(id, { payload, status: "dirty", message: "" });
      schedule(id);
    },
    [schedule, update],
  );

  const describeBlockError = (draft: DraftBlock): string | null =>
    draft.status === "error" ? (draft.message ?? "Could not save this block.") : null;

  async function addBlock(): Promise<void> {
    const response = await fetch(`/api/v1/studio/resources/${resourceId}/blocks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: addKind, payload: DEFAULT_PAYLOAD[addKind] }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { data: BlockDto };
    drafts.current.set(body.data.id, toDraft(body.data));
    setBlocks((current) => [...current, toDraft(body.data)]);
    router.refresh();
  }

  async function deleteBlock(id: string): Promise<void> {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    const response = await fetch(`/api/v1/studio/blocks/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    drafts.current.delete(id);
    setBlocks((current) => current.filter((block) => block.id !== id));
    router.refresh();
  }

  async function move(index: number, delta: -1 | 1): Promise<void> {
    const next = [...blocks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setBlocks(next);
    await fetch(`/api/v1/studio/resources/${resourceId}/blocks/reorder`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((block) => block.id) }),
    });
    router.refresh();
  }

  async function reloadBlock(id: string): Promise<void> {
    const response = await fetch(`/api/v1/studio/resources/${resourceId}`);
    if (!response.ok) return;
    const body = (await response.json()) as { data: { blocks: BlockDto[] } };
    const fresh = body.data.blocks.find((block) => block.id === id);
    if (!fresh) return;
    drafts.current.set(id, toDraft(fresh));
    setBlocks((current) => current.map((block) => (block.id === id ? toDraft(fresh) : block)));
  }

  async function validate(): Promise<void> {
    setValidating(true);
    try {
      const response = await fetch(`/api/v1/studio/resources/${resourceId}/blocks/validate`, {
        method: "POST",
      });
      const body = (await response.json()) as { data?: GateResult; error?: { message: string } };
      if (body.data) setGate(body.data);
      else setGate({ passing: false, blocking: [{ path: "", code: "error", message: body.error?.message ?? "Could not validate." }], warnings: [] });
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">Blocks</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Block type"
            value={addKind}
            onChange={(event) => setAddKind(event.target.value)}
            className="h-9 w-auto"
          >
            {Object.keys(KIND_LABEL).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" size="sm" onClick={() => void addBlock()}>
            Add block
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={validating} onClick={() => void validate()}>
            {validating ? "Checking…" : "Check for publish"}
          </Button>
        </div>
      </div>

      {gate ? (
        <section
          aria-live="polite"
          className={
            gate.passing
              ? "rounded-sm border border-leaf/30 bg-mint/25 px-4 py-3 text-sm text-leaf"
              : "rounded-sm border border-coral/40 bg-blush/30 px-4 py-3 text-sm text-coral-ink"
          }
        >
          <p className="font-medium">
            {gate.passing ? "Ready to publish." : `${gate.blocking.length} problem${gate.blocking.length === 1 ? "" : "s"} blocking publication.`}
          </p>
          {gate.blocking.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {gate.blocking.map((item) => (
                <li key={`${item.path}-${item.code}`}>
                  <span className="font-mono text-xs">{item.path || "resource"}</span> — {item.message}
                </li>
              ))}
            </ul>
          ) : null}
          {gate.warnings.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              {gate.warnings.map((item) => (
                <li key={`${item.path}-${item.code}`}>{item.message}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {blocks.length === 0 ? (
        <p className="text-sm text-ink-3">No blocks yet. Add the first paragraph to start the lesson.</p>
      ) : null}

      <ol className="flex flex-col gap-4">
        {blocks.map((block, index) => (
          <li key={block.id} className="rounded-md border border-line bg-paper-raised p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm tabular-nums text-ink-3">{index + 1}</span>
              <span className="text-sm font-medium text-ink">{KIND_LABEL[block.kind] ?? block.kind}</span>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-3">
                <span aria-live="polite">{STATUS_TEXT[block.status]}</span>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label={`Move block ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => void move(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label={`Move block ${index + 1} down`}
                  disabled={index === blocks.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label={`Delete block ${index + 1}`}
                  onClick={() => void deleteBlock(block.id)}
                >
                  Delete
                </Button>
              </div>
            </div>

            <div className="mt-3">
              {block.kind === "rich_text" ? (
                <MarkdownEditor
                  label={`Block ${index + 1}`}
                  value={(block.payload as { markdown?: string }).markdown ?? ""}
                  onChange={(markdown) => editPayload(block.id, { ...block.payload, v: 1, markdown })}
                />
              ) : block.kind === "callout" ? (
                <div className="flex flex-col gap-2">
                  <Select
                    aria-label={`Block ${index + 1} tone`}
                    value={(block.payload as { tone?: string }).tone ?? "tip"}
                    onChange={(event) => editPayload(block.id, { ...block.payload, v: 1, tone: event.target.value })}
                    className="h-9 w-auto"
                  >
                    {["tip", "warning", "example", "examtip", "definition"].map((tone) => (
                      <option key={tone} value={tone}>
                        {tone}
                      </option>
                    ))}
                  </Select>
                  <MarkdownEditor
                    label={`Block ${index + 1}`}
                    value={(block.payload as { markdown?: string }).markdown ?? ""}
                    onChange={(markdown) => editPayload(block.id, { ...block.payload, v: 1, markdown })}
                  />
                </div>
              ) : (
                <Textarea
                  aria-label={`Block ${index + 1} payload`}
                  className="font-mono text-sm"
                  rows={6}
                  value={block.text}
                  onChange={(event) => {
                    const text = event.target.value;
                    update(block.id, { text, status: "dirty" });
                    schedule(block.id);
                  }}
                />
              )}
            </div>

            {describeBlockError(block) ? (
              <p role="alert" className="mt-2 text-sm font-medium text-coral-ink">
                {describeBlockError(block)}
              </p>
            ) : null}

            {block.status === "conflict" ? (
              <div role="alert" className="mt-3 rounded-sm border border-coral/40 bg-blush/30 px-3 py-2 text-sm text-coral-ink">
                <p>Someone else changed this block while you were editing. Nothing was overwritten.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => void reloadBlock(block.id)}>
                    Reload theirs
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void save(block.id, block.serverUpdatedAt)}
                  >
                    Overwrite
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

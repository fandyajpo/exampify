/**
 * The learning-resource publish gates (`CONTENT_MODEL.md` §4.6) as a pure evaluation.
 *
 * The same function backs the `§7.2 validate` dry run and the `§7.5` publish transition, so
 * the studio can never show "passing" for content the publish would refuse. Everything the
 * checks need is passed in: this module reads no database and throws no HTTP errors.
 */

import katex from "katex";

import { parseBlock, type BlockPayload } from "@/lib/validation/blocks";
import type { GateDetail } from "@/lib/validation/resources";

/** Total payload warning and hard limit in bytes (§4.6 item 8). */
const WARN_BYTES = 64 * 1024;
const HARD_BYTES = 256 * 1024;

const MIN_PROSE_CHARS = 200;

export type GateBlockRow = { position: number; kind: string; payload: string };

export type GateAssessment = {
  status: string;
  topicId: string | null;
  subjectId: string;
};

export type GateResource = { status: string; subjectId: string };

export type GateMedia = { status: string; altText: string };

export type ResourceGateInput = {
  resourceId: string;
  resourceTopicId: string;
  resourceSubjectId: string;
  blocks: readonly GateBlockRow[];
  /** Linked assessments by id (the `question_section` targets). */
  assessments: Readonly<Record<string, GateAssessment>>;
  /** Candidate `related_material` targets by id. */
  resources: Readonly<Record<string, GateResource>>;
  media: Readonly<Record<string, GateMedia>>;
};

export type ResourceGateResult = { blocking: GateDetail[]; warnings: GateDetail[] };

/** Heading text → anchor, the same slug shape the renderer's table of contents expects. */
export function headingAnchor(block: Extract<BlockPayload, { kind: "heading" }>): string {
  const explicit = block.payload.anchor;
  if (explicit) return explicit;
  return block.payload.text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Does the KaTeX parser accept this TeX? `throwOnError` is what turns a warning into a test. */
export function formulaParses(latex: string): boolean {
  try {
    katex.renderToString(latex, { throwOnError: true, displayMode: false, strict: false });
    return true;
  } catch {
    return false;
  }
}

function isExampleLike(block: BlockPayload): boolean {
  return (
    block.kind === "table" ||
    block.kind === "image" ||
    block.kind === "formula" ||
    (block.kind === "callout" && (block.payload.tone === "example" || block.payload.tone === "examtip"))
  );
}

/**
 * Evaluate every §4.6 rule. Blocking entries stop a publish; warnings are the editorial
 * shape and never do.
 */
export function evaluateResourceGates(input: ResourceGateInput): ResourceGateResult {
  const blocking: GateDetail[] = [];
  const warnings: GateDetail[] = [];
  const parsed: BlockPayload[] = [];

  let bytes = 0;
  for (const [index, row] of input.blocks.entries()) {
    bytes += new TextEncoder().encode(row.payload).length;
    const block = parseBlock(row.kind, row.payload);
    if (!block) {
      blocking.push({
        path: `blocks.${index}`,
        code: "invalid_block",
        message: `Block ${index + 1} has a payload that does not match “${row.kind}”.`,
      });
      continue;
    }
    parsed.push(block);
  }

  if (bytes > HARD_BYTES) {
    blocking.push({
      path: "blocks",
      code: "payload_too_large",
      message: "This resource is over the 256 kB block limit. Split it into two resources.",
    });
  } else if (bytes > WARN_BYTES) {
    warnings.push({
      path: "blocks",
      code: "payload_large",
      message: "This resource is over 64 kB. Consider splitting it into smaller lessons.",
    });
  }

  const prose = parsed.filter((block) => block.kind === "rich_text");
  const proseChars = prose.reduce((total, block) => total + block.payload.markdown.trim().length, 0);
  if (prose.length === 0 || proseChars < MIN_PROSE_CHARS) {
    blocking.push({
      path: "blocks",
      code: "no_prose",
      message: `A resource needs at least one text block with ${MIN_PROSE_CHARS} characters of prose to publish.`,
    });
  }

  const first = parsed[0];
  if (first?.kind === "heading" && first.payload.level === 3) {
    blocking.push({
      path: "blocks.0",
      code: "opens_on_subheading",
      message: "A page cannot open on a level-3 heading. Start with prose or a level-2 heading.",
    });
  }

  const anchors = new Set<string>();
  for (const [index, block] of parsed.entries()) {
    if (block.kind === "image") {
      const asset = input.media[block.payload.mediaId];
      if (!asset || asset.status !== "ready") {
        blocking.push({
          path: `blocks.${index}.mediaId`,
          code: "media_not_ready",
          message: "This image has no ready upload. Re-upload it before publishing.",
        });
      } else if (!asset.altText.trim()) {
        blocking.push({
          path: `blocks.${index}.mediaId`,
          code: "alt_text_required",
          message: "Every image needs alt text before this resource can publish.",
        });
      }
    }

    if (block.kind === "formula" && !formulaParses(block.payload.latex)) {
      blocking.push({
        path: `blocks.${index}.latex`,
        code: "invalid_formula",
        message: "This formula does not parse. Fix the TeX before publishing.",
      });
    }

    if (block.kind === "question_section") {
      const assessment = input.assessments[block.payload.assessmentId];
      if (!assessment) {
        blocking.push({
          path: `blocks.${index}.assessmentId`,
          code: "assessment_missing",
          message: "This question section references an assessment that no longer exists.",
        });
      } else if (assessment.status !== "published") {
        blocking.push({
          path: `blocks.${index}.assessmentId`,
          code: "assessment_not_published",
          message: "Publish the linked assessment before publishing this resource.",
        });
      } else if (
        assessment.topicId !== null
          ? assessment.topicId !== input.resourceTopicId
          : assessment.subjectId !== input.resourceSubjectId
      ) {
        blocking.push({
          path: `blocks.${index}.assessmentId`,
          code: "assessment_out_of_scope",
          message: "The linked assessment belongs to another topic or subject.",
        });
      }
    }

    if (block.kind === "related_material") {
      for (const [relatedIndex, id] of block.payload.resourceIds.entries()) {
        if (id === input.resourceId) {
          blocking.push({
            path: `blocks.${index}.resourceIds.${relatedIndex}`,
            code: "self_reference",
            message: "A resource cannot recommend itself.",
          });
          continue;
        }
        const target = input.resources[id];
        if (!target || target.status !== "published" || target.subjectId !== input.resourceSubjectId) {
          blocking.push({
            path: `blocks.${index}.resourceIds.${relatedIndex}`,
            code: "related_not_publishable",
            message: "Related material must be a published resource in the same subject.",
          });
        }
      }
    }

    if (block.kind === "heading") {
      const anchor = headingAnchor(block);
      if (anchors.has(anchor)) {
        blocking.push({
          path: `blocks.${index}.text`,
          code: "duplicate_anchor",
          message: "Two headings produce the same anchor. Make this heading distinct.",
        });
      }
      anchors.add(anchor);
    }
  }

  // Editorial shape: warnings, never gates (§4.6, "Editorial shape").
  if (!parsed.some(isExampleLike)) {
    warnings.push({
      path: "blocks",
      code: "no_worked_example",
      message: "Consider a worked example, table, image or formula — teaching content reads better with one.",
    });
  }

  const last = parsed.at(-1);
  if (
    last?.kind === "heading" &&
    /next steps?|what next|further reading/i.test(last.payload.text)
  ) {
    warnings.push({
      path: `blocks.${parsed.length - 1}`,
      code: "manual_next_steps",
      message: "Navigation is generated; a “next steps” section is usually redundant.",
    });
  }

  return { blocking, warnings };
}

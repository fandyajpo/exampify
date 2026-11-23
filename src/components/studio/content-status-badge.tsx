/**
 * Content status badge (`DESIGN_SYSTEM.md` §9.3, `CONTENT_MODEL.md` §3).
 *
 * One mapping from the stored status to a badge tone and a human label, so every studio
 * screen describes `in_review` the same way.
 */
import { Badge } from "@/components/ui/badge";
import type { ContentStatus } from "@/lib/validation/taxonomy";

const STATUSES: Record<
  ContentStatus,
  { tone: "draft" | "review" | "published" | "archived"; label: string }
> = {
  draft: { tone: "draft", label: "Draft" },
  in_review: { tone: "review", label: "In review" },
  published: { tone: "published", label: "Published" },
  archived: { tone: "archived", label: "Archived" },
};

export function ContentStatusBadge({ status }: { status: ContentStatus }): React.JSX.Element {
  const { tone, label } = STATUSES[status];
  return <Badge tone={tone}>{label}</Badge>;
}

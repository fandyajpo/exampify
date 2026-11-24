"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/studio/error-message";
import type {
  ResourceAssessmentCandidateDto,
  ResourceAssessmentLinkDto,
} from "@/lib/validation/resources";

/**
 * Practice linking for a resource (`API_CONTRACTS.md` §7.2, `CONTENT_MODEL.md` §4.6).
 *
 * `format` is derived, never stored: linking any assessment turns the resource into
 * `lesson_with_practice`, unlinking the last one turns it back into `study_material`. That is
 * why this panel only ever calls the link endpoints and refreshes — the badge is the server's
 * answer, not a field the author edits.
 */

const PLACEMENTS = [
  { value: "end", label: "At the end" },
  { value: "inline", label: "Inline" },
  { value: "optional", label: "Optional" },
] as const;

type Placement = (typeof PLACEMENTS)[number]["value"];

export function AssessmentLinks({
  resourceId,
  linked,
  available,
}: {
  resourceId: string;
  linked: ResourceAssessmentLinkDto[];
  available: ResourceAssessmentCandidateDto[];
}): React.JSX.Element {
  const router = useRouter();
  const [candidate, setCandidate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "saved" | "error"; message: string } | null>(null);

  async function link(assessmentId: string, placement: Placement): Promise<void> {
    setBusy(assessmentId);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/studio/resources/${resourceId}/assessments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId, placement }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({ tone: "error", message: apiErrorMessage(body, "Could not link that assessment.") });
        return;
      }
      setNotice({ tone: "saved", message: "Assessment linked." });
      setCandidate("");
      router.refresh();
    } catch {
      setNotice({ tone: "error", message: "Network error. Nothing changed." });
    } finally {
      setBusy(null);
    }
  }

  async function unlink(assessmentId: string): Promise<void> {
    setBusy(assessmentId);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/v1/studio/resources/${resourceId}/assessments/${assessmentId}`,
        { method: "DELETE" },
      );
      if (!response.ok && response.status !== 404) {
        const body = await response.json().catch(() => null);
        setNotice({ tone: "error", message: apiErrorMessage(body, "Could not unlink that assessment.") });
        return;
      }
      setNotice({ tone: "saved", message: "Assessment unlinked." });
      router.refresh();
    } catch {
      setNotice({ tone: "error", message: "Network error. Nothing changed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="resource-practice-heading"
      className="rounded-md border border-line bg-paper-raised p-5 shadow-sm"
    >
      <h2
        id="resource-practice-heading"
        className="font-display text-xl font-semibold tracking-[-0.015em]"
      >
        Practice
      </h2>
      <p className="mt-1 max-w-[62ch] text-sm text-ink-3">
        Linking an assessment gives this resource the lesson format. Unlinking the last one
        returns it to study material; nothing else about the resource changes.
      </p>

      <p aria-live="polite" className="mt-3 text-sm">
        {notice ? (
          <span
            role={notice.tone === "error" ? "alert" : "status"}
            className={notice.tone === "error" ? "font-medium text-coral-ink" : "text-leaf"}
          >
            {notice.message}
          </span>
        ) : null}
      </p>

      {linked.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">No practice linked yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
          {linked.map((assessment) => (
            <li key={assessment.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {assessment.title}
                </span>
                <span className="block text-xs text-ink-3">
                  {assessment.mode} · {assessment.slug}
                </span>
              </span>
              <Badge tone={assessment.status === "published" ? "published" : "draft"}>
                {assessment.status.replace(/_/g, " ")}
              </Badge>
              <label className="sr-only" htmlFor={`placement-${assessment.id}`}>
                Placement for {assessment.title}
              </label>
              <Select
                id={`placement-${assessment.id}`}
                value={assessment.placement}
                disabled={busy === assessment.id}
                className="h-9 w-auto"
                onChange={(event) => void link(assessment.id, event.target.value as Placement)}
              >
                {PLACEMENTS.map((placement) => (
                  <option key={placement.value} value={placement.value}>
                    {placement.label}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy === assessment.id}
                onClick={() => void unlink(assessment.id)}
              >
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="assessment-to-link" className="text-sm font-medium text-ink">
            Link an assessment
          </label>
          <Select
            id="assessment-to-link"
            value={candidate}
            disabled={available.length === 0}
            className="mt-1 h-9"
            onChange={(event) => setCandidate(event.target.value)}
          >
            <option value="">
              {available.length === 0 ? "Nothing left to link in this topic" : "Choose one"}
            </option>
            {available.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title} ({assessment.status.replace(/_/g, " ")})
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!candidate || busy !== null}
          onClick={() => void link(candidate, "end")}
        >
          Link
        </Button>
      </div>
    </section>
  );
}

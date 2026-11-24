"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/input";
import { mediaUploadProblem, purposeForMime } from "@/lib/content/media";
import { apiErrorMessage } from "@/lib/studio/error-message";
import type { MediaUploadTicket } from "@/lib/validation/media";

/**
 * Media upload (`API_CONTRACTS.md` §7.6, `FR-CMS-14`).
 *
 * Bytes never pass through a route handler: ask for a signed `PUT`, send the file straight to
 * the bucket with the headers that URL was signed for, then confirm so the server checks the
 * size and magic bytes before the asset becomes usable.
 *
 * The purpose comes from the file's own MIME type, so the author never picks an allow-list;
 * the same client-side rule the server runs catches a wrong extension or an oversized file
 * before it touches the bucket.
 */

type State =
  | { status: "idle" }
  | { status: "uploading"; message: string }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

export function MediaUploader(): React.JSX.Element {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  async function upload(file: File): Promise<void> {
    const purpose = purposeForMime(file.type);
    if (!purpose) {
      setState({
        status: "error",
        message: `That file type (${file.type || "unknown"}) is not accepted. Use PNG, JPEG, WebP, AVIF, SVG, PDF, DOCX or PPTX.`,
      });
      return;
    }

    const problem = mediaUploadProblem({
      filename: file.name,
      mimeType: file.type,
      byteSize: file.size,
      purpose,
    });
    if (problem) {
      setState({ status: "error", message: problem.message });
      return;
    }

    setState({ status: "uploading", message: "Requesting a signed upload…" });

    try {
      const ticketResponse = await fetch("/api/v1/studio/media/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          byteSize: file.size,
          purpose,
        }),
      });
      const ticketBody = (await ticketResponse.json().catch(() => null)) as
        | { data?: MediaUploadTicket }
        | null;
      if (!ticketResponse.ok || !ticketBody?.data) {
        setState({
          status: "error",
          message: apiErrorMessage(ticketBody, "Could not start the upload."),
        });
        return;
      }

      const ticket = ticketBody.data;
      setState({ status: "uploading", message: "Uploading the file…" });

      const put = await fetch(ticket.uploadUrl, {
        method: ticket.method,
        headers: ticket.headers,
        body: file,
      });
      if (!put.ok) {
        setState({
          status: "error",
          message: `Storage refused the upload (${put.status}). Try again, or check the bucket's CORS rules.`,
        });
        return;
      }

      setState({ status: "uploading", message: "Checking the file…" });
      const confirmResponse = await fetch(`/api/v1/studio/media/${ticket.mediaId}/confirm`, {
        method: "POST",
      });
      const confirmBody = await confirmResponse.json().catch(() => null);
      if (!confirmResponse.ok) {
        setState({
          status: "error",
          message: apiErrorMessage(confirmBody, "The file uploaded but could not be confirmed."),
        });
        return;
      }

      setState({
        status: "done",
        message: `${file.name} is ready. Add its alt text below before an image can be published.`,
      });
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setState({ status: "error", message: "Network error during the upload. Nothing was saved." });
    }
  }

  const uploading = state.status === "uploading";

  return (
    <section
      aria-labelledby="media-upload-heading"
      className="rounded-md border border-line bg-paper-raised p-5 shadow-sm"
    >
      <h2 id="media-upload-heading" className="font-display text-lg font-semibold tracking-[-0.01em]">
        Upload an asset
      </h2>
      <p className="mt-1 max-w-[62ch] text-sm text-ink-3">
        Images up to 8 MB, documents up to 25 MB. The file goes straight to storage; this page
        only receives its metadata.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <FormField
            id="media-file"
            label="File"
            hint="PNG, JPEG, WebP, AVIF, SVG, PDF, DOCX or PPTX."
          >
            {(control) => (
              <input
                {...control}
                ref={inputRef}
                type="file"
                name="file"
                accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml,application/pdf,.docx,.pptx,.zip"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
                className="w-full cursor-pointer rounded-sm border border-line-strong bg-paper-raised px-3 py-2 text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-xs file:border-0 file:bg-paper-sunk file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink aria-[invalid=true]:border-coral disabled:cursor-not-allowed"
              />
            )}
          </FormField>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Choose a file"}
        </Button>
      </div>

      <p aria-live="polite" className="mt-3 text-sm">
        {state.status === "uploading" ? <span className="text-ink-2">{state.message}</span> : null}
        {state.status === "done" ? <span className="text-leaf">{state.message}</span> : null}
        {state.status === "error" ? (
          <span role="alert" className="font-medium text-coral-ink">
            {state.message}
          </span>
        ) : null}
      </p>
    </section>
  );
}

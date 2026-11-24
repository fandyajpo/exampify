/**
 * Studio asset library (`INFORMATION_ARCHITECTURE.md` §4.3, `API_CONTRACTS.md` §7.6): what has
 * been uploaded, its alt text and its state. Upload, alt-text editing and delete live in the
 * two client components; this page only reads and composes.
 */
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { MediaLibrary } from "@/components/studio/media-library";
import { MediaUploader } from "@/components/studio/media-uploader";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { listMedia } from "@/lib/services/media-admin";
import { searchParam, type SearchParams } from "@/lib/search-params";
import type { MediaListQuery } from "@/lib/validation/media";

const PAGE_SIZE = 24;

const PURPOSES = [
  { value: "", label: "Images and documents" },
  { value: "image", label: "Images" },
  { value: "document", label: "Documents" },
] as const;

const STATUSES = [
  { value: "", label: "Everything but deleted" },
  { value: "ready", label: "Ready" },
  { value: "pending", label: "Pending upload" },
  { value: "deleted", label: "Deleted" },
] as const;

export const metadata = { title: "Media" };

function mediaHref({
  q,
  purpose,
  status,
  cursor,
}: {
  q: string;
  purpose: string;
  status: string;
  cursor?: string;
}): string {
  const search = new URLSearchParams();
  if (q) search.set("q", q);
  if (purpose) search.set("purpose", purpose);
  if (status) search.set("status", status);
  if (cursor) search.set("cursor", cursor);
  const query = search.toString();
  return query ? `/studio/media?${query}` : "/studio/media";
}

export default async function StudioMediaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = searchParam(params, "q");
  const rawPurpose = searchParam(params, "purpose");
  const rawStatus = searchParam(params, "status");
  const cursor = searchParam(params, "cursor");

  const purpose = rawPurpose === "image" || rawPurpose === "document" ? rawPurpose : undefined;
  const status =
    rawStatus === "ready" || rawStatus === "pending" || rawStatus === "deleted"
      ? rawStatus
      : undefined;

  const query: MediaListQuery = {
    limit: PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(purpose ? { purpose } : {}),
    ...(status ? { status } : {}),
    ...(cursor ? { cursor } : {}),
  };
  const page = await listMedia(query);
  const filtered = Boolean(q || purpose || status);

  return (
    <>
      <header className="max-w-[62ch]">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Content</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em]">Media</h1>
        <p className="mt-3 text-ink-2">
          Every uploaded image and document. Alt text is what a screen reader reads, and it is
          required before an image can be published.
        </p>
      </header>

      <div className="mt-8">
        <MediaUploader />
      </div>

      <form
        method="get"
        action="/studio/media"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-md border border-line bg-paper-raised p-4 shadow-sm"
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="media-filter-q" className="text-sm font-medium text-ink">
            Search alt text
          </label>
          <Input
            id="media-filter-q"
            name="q"
            defaultValue={q}
            maxLength={120}
            placeholder="Search the alt text"
            className="mt-1 h-9"
          />
        </div>
        <div>
          <label htmlFor="media-filter-purpose" className="text-sm font-medium text-ink">
            Purpose
          </label>
          <Select
            id="media-filter-purpose"
            name="purpose"
            defaultValue={purpose ?? ""}
            className="mt-1 h-9 w-auto"
          >
            {PURPOSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="media-filter-status" className="text-sm font-medium text-ink">
            Status
          </label>
          <Select
            id="media-filter-status"
            name="status"
            defaultValue={status ?? ""}
            className="mt-1 h-9 w-auto"
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        {filtered ? (
          <Link
            href="/studio/media"
            className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {page.data.length === 0 && !filtered ? (
        <EmptyState
          className="mt-8"
          title="No assets yet"
          description="Upload a diagram or a worksheet above and it will be available to every resource block."
        />
      ) : (
        <MediaLibrary items={page.data} />
      )}

      {cursor || page.nextCursor ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4 text-sm">
          {cursor ? (
            <Link
              href={mediaHref({ q, purpose: purpose ?? "", status: status ?? "" })}
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              ← First page
            </Link>
          ) : (
            <span />
          )}
          {page.nextCursor ? (
            <Link
              href={mediaHref({
                q,
                purpose: purpose ?? "",
                status: status ?? "",
                cursor: page.nextCursor,
              })}
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              Next page →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

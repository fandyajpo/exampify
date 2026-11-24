"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/studio/error-message";
import type { MediaDto } from "@/lib/validation/media";

/**
 * The library picker a block uses to point at an existing asset (`API_CONTRACTS.md` §7.2,
 * §7.6): it only offers `ready` assets of the purpose the block needs, and it shows the alt
 * text so the author sees why publication might be blocked before they publish.
 */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPicker({
  purpose,
  selected,
  onSelect,
}: {
  purpose: "image" | "document";
  selected: MediaDto | null;
  onSelect: (asset: MediaDto) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MediaDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams({ purpose, status: "ready", limit: "12" });
      if (query.trim()) search.set("q", query.trim());

      const response = await fetch(`/api/v1/studio/media?${search.toString()}`);
      const body = (await response.json().catch(() => null)) as
        | { data?: MediaDto[] }
        | null;
      if (!response.ok || !body?.data) {
        setError(apiErrorMessage(body, "Could not read the media library."));
        return;
      }
      setItems(body.data);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(): void {
    const next = !open;
    setOpen(next);
    if (next) void load();
  }

  const isImage = purpose === "image";

  return (
    <div className="flex flex-col gap-3">
      {selected ? (
        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-paper px-3 py-2">
          {selected.url && isImage ? (
            <Image
              src={selected.url}
              alt={selected.altText}
              width={48}
              height={48}
              unoptimized
              className="size-12 rounded-xs border border-line object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {selected.altText || (isImage ? "Image without alt text" : selected.mimeType)}
            </p>
            <p className="text-xs text-ink-3">
              {selected.mimeType} · {formatBytes(selected.byteSize)}
            </p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={toggle}>
            {open ? "Close library" : isImage ? "Change image" : "Change file"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-dashed border-line-strong bg-paper px-3 py-3">
          <p className="text-sm text-ink-3">
            {isImage ? "No image chosen yet." : "No file chosen yet."}
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={toggle}>
            {open ? "Close library" : isImage ? "Choose image" : "Choose file"}
          </Button>
        </div>
      )}

      {selected && isImage && selected.altText.trim() === "" ? (
        <p className="text-sm font-medium text-coral-ink">
          This image has no alt text, so the resource cannot be published.{" "}
          <Link href="/studio/media" className="underline underline-offset-4">
            Add it in the media library
          </Link>
          .
        </p>
      ) : null}

      {open ? (
        <div className="rounded-md border border-line bg-paper-raised p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <label htmlFor={`media-search-${purpose}`} className="text-sm font-medium text-ink">
                Search alt text
              </label>
              <Input
                id={`media-search-${purpose}`}
                value={query}
                maxLength={120}
                disabled={loading}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void load();
                  }
                }}
                className="mt-1 h-9"
              />
            </div>
            <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={() => void load()}>
              {loading ? "Searching…" : "Search"}
            </Button>
          </div>

          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-coral-ink">
              {error}
            </p>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <p className="mt-3 text-sm text-ink-3">
              No {isImage ? "images" : "documents"} yet.{" "}
              <Link href="/studio/media" className="underline underline-offset-4">
                Upload one in the media library
              </Link>
              .
            </p>
          ) : null}

          {items.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(asset);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-sm border border-line bg-paper-raised px-3 py-2 text-left transition-colors duration-120 hover:border-ink/40 hover:bg-paper"
                  >
                    {asset.url && isImage ? (
                      <Image
                        src={asset.url}
                        alt={asset.altText}
                        width={40}
                        height={40}
                        unoptimized
                        className="size-10 shrink-0 rounded-xs border border-line object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {asset.altText || "No alt text"}
                      </span>
                      <span className="block text-xs text-ink-3">
                        {asset.mimeType} · {formatBytes(asset.byteSize)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

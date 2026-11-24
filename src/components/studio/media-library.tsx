"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/studio/error-message";
import type { MediaDto } from "@/lib/validation/media";

/**
 * The asset library list (`INFORMATION_ARCHITECTURE.md` §4.3, `API_CONTRACTS.md` §7.6).
 *
 * Only two things are editable: the alt text, which publication requires, and the soft delete,
 * which the server refuses while content still points at the asset. Everything else — bytes,
 * type, key — is fixed once the object is confirmed.
 */

const STATUS = {
  pending: { tone: "draft", label: "Pending upload" },
  ready: { tone: "published", label: "Ready" },
  deleted: { tone: "archived", label: "Deleted" },
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Notice = { id: string; tone: "saved" | "error"; message: string };

export function MediaLibrary({ items }: { items: MediaDto[] }): React.JSX.Element {
  const router = useRouter();
  const [altText, setAltText] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.altText])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function saveAltText(asset: MediaDto): Promise<void> {
    setBusy(asset.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/studio/media/${asset.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ altText: altText[asset.id] ?? "" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice({
          id: asset.id,
          tone: "error",
          message: apiErrorMessage(body, "Could not save the alt text."),
        });
        return;
      }
      setNotice({ id: asset.id, tone: "saved", message: "Alt text saved." });
      router.refresh();
    } catch {
      setNotice({ id: asset.id, tone: "error", message: "Network error. Nothing was saved." });
    } finally {
      setBusy(null);
    }
  }

  async function remove(asset: MediaDto): Promise<void> {
    const confirmed = window.confirm(
      `Delete “${asset.altText || asset.mimeType}”? Content that still points at it will block the delete.`,
    );
    if (!confirmed) return;

    setBusy(asset.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/studio/media/${asset.id}`, { method: "DELETE" });
      if (response.status === 409) {
        const body = await response.json().catch(() => null);
        setNotice({
          id: asset.id,
          tone: "error",
          message: apiErrorMessage(body, "This asset is still used by content."),
        });
        return;
      }
      if (!response.ok && response.status !== 404) {
        setNotice({ id: asset.id, tone: "error", message: "Could not delete this asset." });
        return;
      }
      setNotice({ id: asset.id, tone: "saved", message: "Asset deleted." });
      router.refresh();
    } catch {
      setNotice({ id: asset.id, tone: "error", message: "Network error. Nothing was deleted." });
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-6 text-sm text-ink-3">
        Nothing matches these filters. Upload a file above to add the first asset.
      </p>
    );
  }

  return (
    <ul className="mt-6 flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-paper-raised shadow-sm">
      {items.map((asset, index) => {
        const status = STATUS[asset.status];
        const isImage = asset.mimeType.startsWith("image/");
        const altId = `media-alt-${asset.id}`;

        return (
          <li key={asset.id} className="flex flex-col gap-4 p-4 sm:flex-row">
            <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-paper-sunk">
              {asset.url && isImage ? (
                <Image
                  src={asset.url}
                  alt={asset.altText}
                  width={96}
                  height={96}
                  unoptimized
                  className="size-full object-cover"
                />
              ) : (
                <span className="px-2 text-center font-mono text-[11px] uppercase text-ink-3">
                  {asset.mimeType.split("/").pop()}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={status.tone}>{status.label}</Badge>
                <span className="text-xs text-ink-3">{asset.mimeType}</span>
                <span className="text-xs text-ink-3">{formatBytes(asset.byteSize)}</span>
                {asset.width && asset.height ? (
                  <span className="text-xs text-ink-3">
                    {asset.width} × {asset.height}
                  </span>
                ) : null}
                <span className="text-xs text-ink-3">
                  {new Date(asset.createdAt).toLocaleDateString()}
                </span>
                {asset.status === "ready" && asset.altText.trim() === "" ? (
                  <Badge tone="review">Needs alt text</Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-64 flex-1">
                  <label htmlFor={altId} className="text-sm font-medium text-ink">
                    Alt text
                  </label>
                  <Input
                    id={altId}
                    value={altText[asset.id] ?? ""}
                    maxLength={240}
                    placeholder="Describe what the image shows"
                    disabled={busy === asset.id || asset.status === "deleted"}
                    onChange={(event) =>
                      setAltText((current) => ({ ...current, [asset.id]: event.target.value }))
                    }
                    className="mt-1 h-9"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy === asset.id || asset.status === "deleted"}
                  onClick={() => void saveAltText(asset)}
                >
                  Save alt text
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy === asset.id || asset.status === "deleted"}
                  onClick={() => void remove(asset)}
                  aria-label={`Delete asset ${index + 1}`}
                >
                  Delete
                </Button>
              </div>

              {notice?.id === asset.id ? (
                <p
                  aria-live="polite"
                  className={
                    notice.tone === "error"
                      ? "text-sm font-medium text-coral-ink"
                      : "text-sm text-leaf"
                  }
                >
                  {notice.message}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

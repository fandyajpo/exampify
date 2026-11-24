/**
 * Studio audit log (`INFORMATION_ARCHITECTURE.md` §4.3, `API_CONTRACTS.md` §7.7): the
 * append-only trail of who changed what and when.
 *
 * The scope follows `SEC §6`: an `admin` reads every actor's rows, an `author` or
 * `reviewer` only their own. Rows carry field names and ids, never values, so the details
 * column is safe to show as-is.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { getActor } from "@/lib/auth/actor";
import { formatUtcDateTime } from "@/lib/format/datetime";
import { can } from "@/lib/rbac";
import { searchParam, type SearchParams } from "@/lib/search-params";
import { listAuditLogs } from "@/lib/services/audit-admin";
import { AUDIT_ENTITY_TYPES } from "@/lib/validation/audit";

const PAGE_SIZE = 50;

export const metadata = { title: "Audit" };

const ENTITY_LABELS: Record<(typeof AUDIT_ENTITY_TYPES)[number], string> = {
  curriculum: "Curricula",
  level: "Levels",
  subject: "Subjects",
  chapter: "Chapters",
  topic: "Topics",
  resource: "Resources",
  media: "Media",
};

/** The pills differ only in their active state, so both class lists live here once. */
function pillClass(active: boolean): string {
  const base = "inline-flex h-9 items-center rounded-sm border px-3";
  return active
    ? `${base} border-line-strong bg-paper-raised font-medium text-ink`
    : `${base} border-line text-ink-2 transition-colors hover:text-ink`;
}

const FILTERS = [
  { value: "", label: "All" },
  ...AUDIT_ENTITY_TYPES.map((type) => ({
    value: type,
    label: ENTITY_LABELS[type],
  })),
];

function isEntityType(
  value: string,
): value is (typeof AUDIT_ENTITY_TYPES)[number] {
  return (AUDIT_ENTITY_TYPES as readonly string[]).includes(value);
}

function auditHref({
  entityType,
  cursor,
}: {
  entityType: string;
  cursor?: string;
}): string {
  const search = new URLSearchParams();
  if (entityType) search.set("entityType", entityType);
  if (cursor) search.set("cursor", cursor);
  const query = search.toString();
  return query ? `/studio/audit?${query}` : "/studio/audit";
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function describeMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return "—";
  return entries
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join(" · ");
}

export default async function StudioAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const actor = await getActor();
  if (!actor) notFound();
  if (!can(actor, "audit:read:all") && !can(actor, "audit:read:own"))
    notFound();

  const params = await searchParams;
  const rawEntityType = searchParam(params, "entityType");
  const entityType = isEntityType(rawEntityType) ? rawEntityType : "";
  const cursor = searchParam(params, "cursor");

  const { data: entries, nextCursor } = await listAuditLogs(actor, {
    limit: PAGE_SIZE,
    ...(entityType ? { entityType } : {}),
    ...(cursor ? { cursor } : {}),
  });

  const readsEverything = can(actor, "audit:read:all");

  return (
    <>
      <header className="max-w-[62ch]">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
          Studio
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em]">
          Audit log
        </h1>
        <p className="mt-3 text-ink-2">
          {readsEverything
            ? "Every recorded change, newest first. Times are UTC."
            : "Your recorded changes, newest first. Times are UTC."}
        </p>
      </header>

      <nav
        aria-label="Filter by entity"
        className="mt-6 flex flex-wrap items-center gap-2 text-sm"
      >
        {FILTERS.map((filter) => {
          const active = entityType === filter.value;
          return (
            <Link
              key={filter.value || "all"}
              href={auditHref({ entityType: filter.value })}
              aria-current={active ? "page" : undefined}
              className={pillClass(active)}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {entries.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="Nothing recorded here yet"
          description={
            entityType
              ? "No change of this kind has been made. Clear the filter to see the whole trail."
              : "A create, edit, transition or media change writes a row here as part of the same transaction."
          }
        />
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-md border border-line bg-paper-raised p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-ink">
                    {entry.action}
                  </span>
                  <span className="capitalize text-ink-2">
                    {entry.entityType}
                  </span>
                  <time
                    dateTime={entry.createdAt}
                    className="ml-auto text-xs tabular-nums text-ink-3"
                  >
                    {formatUtcDateTime(entry.createdAt)}
                  </time>
                </div>
                <p className="mt-2 text-xs text-ink-2">
                  {describeMetadata(entry.metadata)}
                </p>
                <p className="mt-2 text-xs text-ink-3">
                  {entry.actorId ? (
                    <span className="font-mono">
                      {entry.actorId.slice(0, 8)}
                    </span>
                  ) : (
                    "system"
                  )}
                  {entry.entityId ? (
                    <span className="font-mono">
                      {" "}
                      · {entry.entityId.slice(0, 8)}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>

          <div className="table-shell mt-6 hidden md:block">
            <table className="data-table">
              <caption className="sr-only">
                Audit entries with actor, action, entity and details
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="font-medium">
                    When
                  </th>
                  <th scope="col" className="font-medium">
                    Actor
                  </th>
                  <th scope="col" className="font-medium">
                    Action
                  </th>
                  <th scope="col" className="font-medium">
                    Entity
                  </th>
                  <th scope="col" className="font-medium">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap tabular-nums text-ink-2">
                      <time dateTime={entry.createdAt}>
                        {formatUtcDateTime(entry.createdAt)}
                      </time>
                    </td>
                    <td className="whitespace-nowrap">
                      {entry.actorId ? (
                        <span
                          className="font-mono text-xs text-ink-2"
                          title={entry.actorId}
                        >
                          {entry.actorId.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-ink-3">system</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="font-mono text-xs text-ink">
                        {entry.action}
                      </span>
                    </td>
                    <td className="text-ink-2">
                      <span className="capitalize">{entry.entityType}</span>
                      {entry.entityId ? (
                        <span
                          className="ml-1 font-mono text-xs text-ink-3"
                          title={entry.entityId}
                        >
                          {entry.entityId.slice(0, 8)}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-xs text-ink-2">
                      {describeMetadata(entry.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {cursor || nextCursor ? (
        <nav
          aria-label="Pagination"
          className="mt-6 flex items-center justify-between gap-4 text-sm"
        >
          {cursor ? (
            <Link
              href={auditHref({ entityType })}
              className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            >
              ← First page
            </Link>
          ) : (
            <span />
          )}
          {nextCursor ? (
            <Link
              href={auditHref({ entityType, cursor: nextCursor })}
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

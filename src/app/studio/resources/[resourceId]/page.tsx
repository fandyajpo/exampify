/**
 * Studio resource editor (`INFORMATION_ARCHITECTURE.md` §4.3, `API_CONTRACTS.md` §7.2): the
 * resource's metadata, its block editor and the publish dry run. Autosave lives in the
 * block editor; this page only reads and composes.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { Disclosure } from "@/components/motion/disclosure";
import { ContentStatusBadge } from "@/components/studio/content-status-badge";
import { ResourceEditor } from "@/components/studio/resource-editor";
import { ResourceForm } from "@/components/studio/resource-form";
import { TransitionControls } from "@/components/studio/transition-controls";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/lib/auth/actor";
import { duplicateResourceAction } from "@/lib/studio/actions";
import { getResourceAdmin } from "@/lib/services/resources-admin";

export const metadata = { title: "Resource" };

export default async function StudioResourcePage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}): Promise<React.JSX.Element> {
  const { resourceId } = await params;
  const [resource, actor] = await Promise.all([getResourceAdmin(resourceId), requireActor()]);
  if (!resource) notFound();

  return (
    <>
      <Link
        href={`/studio/topics/${resource.topicId}`}
        className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        ← Topic
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{resource.title}</h1>
        <ContentStatusBadge status={resource.status} />
        <span className="text-sm text-ink-3">{resource.slug}</span>
        <span className="text-sm text-ink-3">{resource.readingMinutes} min read</span>
        <span className="text-sm text-ink-3">{resource.format.replace(/_/g, " ")}</span>
      </header>
      {resource.subtitle ? <p className="mt-2 max-w-[62ch] text-ink-2">{resource.subtitle}</p> : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <TransitionControls
          entity="resources"
          id={resource.id}
          status={resource.status}
          role={actor.role}
        />
        <Link
          href={`/studio/resources/${resource.id}/preview`}
          className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          Staff preview →
        </Link>
        <form action={duplicateResourceAction}>
          <input type="hidden" name="id" value={resource.id} />
          <Button type="submit" variant="secondary" size="sm">
            Duplicate
          </Button>
        </form>
      </div>

      <div className="mt-8">
        <ResourceEditor resourceId={resource.id} blocks={resource.blocks} />
      </div>

      <Disclosure label="Edit metadata" className="mt-10">
        <ResourceForm resource={resource} />
      </Disclosure>
    </>
  );
}

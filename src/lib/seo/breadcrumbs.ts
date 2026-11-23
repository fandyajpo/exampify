import { url } from "@/lib/urls";

/**
 * Breadcrumb trails (`INFORMATION_ARCHITECTURE.md` §6), derived from the resolved taxonomy
 * rather than the URL string: `Home / Curriculum / Level / Subject / Chapter / Topic`.
 *
 * The visible `<Breadcrumbs>` component and the `BreadcrumbList` JSON-LD are both fed from
 * one trail, so they cannot drift — the spec's "mirrors it exactly" is structural here.
 * A resource page stops at its topic: the resource title is the `h1`, not a seventh crumb.
 */
export type Crumb = { name: string; path: string };

type TrailInput = {
  curriculum?: { slug: string; name: string };
  level?: { slug: string; name: string };
  subject?: { slug: string; name: string };
  chapter?: { slug: string; title: string };
  topic?: { slug: string; title: string };
};

export function breadcrumbTrail(input: TrailInput): Crumb[] {
  const trail: Crumb[] = [{ name: "Home", path: "/" }];
  const { curriculum, level, subject, chapter, topic } = input;

  if (!curriculum) return trail;
  trail.push({ name: curriculum.name, path: url.curriculum(curriculum.slug) });

  if (!level) return trail;
  trail.push({ name: level.name, path: url.level(curriculum.slug, level.slug) });

  if (!subject) return trail;
  trail.push({
    name: subject.name,
    path: url.subject(curriculum.slug, level.slug, subject.slug),
  });

  if (!chapter) return trail;
  trail.push({
    name: chapter.title,
    path: url.chapter(curriculum.slug, level.slug, subject.slug, chapter.slug),
  });

  if (!topic) return trail;
  trail.push({
    name: topic.title,
    path: url.topic(curriculum.slug, level.slug, subject.slug, chapter.slug, topic.slug),
  });

  return trail;
}

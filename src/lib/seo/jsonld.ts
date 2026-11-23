import { absoluteUrl } from "@/lib/seo/metadata";
import type { Crumb } from "@/lib/seo/breadcrumbs";

/**
 * JSON-LD builders (`SEO_AND_CONTENT_STRATEGY.md` §3.4). Every node is assembled here, from
 * resolved entities, and emitted as one graph per page — no page hand-writes schema.
 *
 * The rule the builders enforce by omission: nothing the page does not visibly support.
 * There is no `aggregateRating`, no `offers`, no `CourseInstance` (the product has no
 * schedule or price), and `timeRequired` only ever comes from real `reading_minutes`.
 */

const CONTEXT = "https://schema.org";

const ORGANIZATION_ID = `${absoluteUrl("/")}#organization`;

function organization(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Exampify",
    url: absoluteUrl("/"),
  };
}

/** `BreadcrumbList` mirroring the visible breadcrumb, position starting at 1. */
export function breadcrumbList(trail: Crumb[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

type CourseInput = {
  name: string;
  description: string;
  educationalLevel: string;
  path: string;
};

/** Subject page: `Course` with provider and language, and deliberately no schedule/price. */
export function course(input: CourseInput): Record<string, unknown> {
  return {
    "@type": "Course",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    educationalLevel: input.educationalLevel,
    inLanguage: "en",
    provider: { "@id": ORGANIZATION_ID },
  };
}

type LearningResourceInput = {
  name: string;
  description: string;
  /** `article` for study material, `lesson` when the resource carries practice. */
  learningResourceType: "article" | "lesson";
  educationalLevel: string;
  /** The topic the resource teaches. */
  teaches: string;
  /** The subject page the resource belongs to. */
  isPartOf: { name: string; path: string };
  readingMinutes: number;
  path: string;
};

/** Study material / lesson page. */
export function learningResource(input: LearningResourceInput): Record<string, unknown> {
  return {
    "@type": "LearningResource",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    learningResourceType: input.learningResourceType,
    educationalLevel: input.educationalLevel,
    teaches: input.teaches,
    inLanguage: "en",
    timeRequired: `PT${Math.max(1, Math.round(input.readingMinutes))}M`,
    isPartOf: {
      "@type": "Course",
      name: input.isPartOf.name,
      url: absoluteUrl(input.isPartOf.path),
    },
  };
}

/** One `<script type="application/ld+json">` per page, combining its nodes into a graph. */
export function pageGraph(nodes: Array<Record<string, unknown>>): Record<string, unknown> {
  return { "@context": CONTEXT, "@graph": [organization(), ...nodes] };
}

/** Homepage graph: organization + website + the site's search action (`SEO` §3.4). */
export function siteGraph(): Record<string, unknown> {
  return pageGraph([
    {
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      name: "Exampify",
      url: absoluteUrl("/"),
      publisher: { "@id": ORGANIZATION_ID },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ]);
}

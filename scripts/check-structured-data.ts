/**
 * Structured-data check (`SEO_AND_CONTENT_STRATEGY.md` §3.4 and §9 acceptance criteria).
 *
 * Fetches the rendered hierarchy pages, extracts each page's single JSON-LD graph, and
 * asserts: the graph types a page must carry, a `BreadcrumbList` whose positions and URLs
 * mirror the visible breadcrumb, the required `Course` / `LearningResource` fields, and the
 * absence of fields the product cannot support (ratings, prices, schedule).
 *
 * Runs against a live server, because the point is to validate what search engines receive:
 *   bun run seo:check                     # http://localhost:3100
 *   CHECK_BASE_URL=https://example.com bun run seo:check
 */
import { z } from "zod";

const BASE = (process.env.CHECK_BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");

const listItemSchema = z.object({
  "@type": z.literal("ListItem"),
  position: z.number().int().positive(),
  name: z.string().min(1),
  item: z.string().url(),
});

const breadcrumbSchema = z.object({
  "@type": z.literal("BreadcrumbList"),
  itemListElement: z.array(listItemSchema).min(2),
});

const courseSchema = z.object({
  "@type": z.literal("Course"),
  name: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url(),
  educationalLevel: z.string().min(1),
  inLanguage: z.literal("en"),
  provider: z.object({ "@id": z.string().url() }),
});

const learningResourceSchema = z.object({
  "@type": z.literal("LearningResource"),
  name: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url(),
  learningResourceType: z.enum(["article", "lesson"]),
  educationalLevel: z.string().min(1),
  teaches: z.string().min(1),
  inLanguage: z.literal("en"),
  timeRequired: z.string().regex(/^PT\d+M$/, "timeRequired must be an ISO-8601 PT{n}M duration"),
  isPartOf: z.object({ "@type": z.literal("Course"), name: z.string().min(1), url: z.string().url() }),
});

const websiteSchema = z.object({
  "@type": z.literal("WebSite"),
  name: z.string().min(1),
  url: z.string().url(),
  potentialAction: z.object({ "@type": z.literal("SearchAction") }),
});

type PageCase = {
  path: string;
  /** Breadcrumb length; `null` for pages with no breadcrumb (the homepage). */
  crumbs: number | null;
  types: string[];
};

const CASES: PageCase[] = [
  { path: "/", crumbs: null, types: ["Organization", "WebSite"] },
  { path: "/cambridge-international", crumbs: 2, types: ["BreadcrumbList"] },
  { path: "/cambridge-international/igcse", crumbs: 3, types: ["BreadcrumbList"] },
  { path: "/cambridge-international/igcse/biology", crumbs: 4, types: ["BreadcrumbList", "Course"] },
  {
    path: "/cambridge-international/igcse/biology/chapters/cells-and-transport",
    crumbs: 5,
    types: ["BreadcrumbList"],
  },
  {
    path: "/cambridge-international/igcse/biology/cells-and-transport/cell-structure",
    crumbs: 6,
    types: ["BreadcrumbList"],
  },
  {
    path: "/cambridge-international/igcse/biology/cells-and-transport/cell-structure/learn/study-notes",
    crumbs: 6,
    types: ["BreadcrumbList", "LearningResource"],
  },
];

const FORBIDDEN_KEYS = ["aggregateRating", "offers", "price", "priceCurrency", "CourseInstance"];

type Issue = string;

function collectTypes(nodes: Array<Record<string, unknown>>): Map<string, Record<string, unknown>> {
  const byType = new Map<string, Record<string, unknown>>();
  for (const node of nodes) {
    const type = node["@type"];
    if (typeof type === "string") byType.set(type, node);
  }
  return byType;
}

async function checkPage(testCase: PageCase): Promise<Issue[]> {
  const issues: Issue[] = [];
  const response = await fetch(`${BASE}${testCase.path}`);
  if (!response.ok) return [`${testCase.path}: HTTP ${response.status}`];

  const html = await response.text();
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  // Canonical URLs come from NEXT_PUBLIC_SITE_URL, not from the request host, so the page
  // under test can legitimately be served on a different port than its canonical origin.
  const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!canonicalMatch) return [`${testCase.path}: no canonical link to compare against`];
  const canonical = canonicalMatch[1]!;
  const origin = new URL(canonical).origin;

  if (scripts.length !== 1) {
    return [`${testCase.path}: expected exactly one JSON-LD graph, found ${scripts.length}`];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(scripts[0]![1]!);
  } catch (error) {
    return [`${testCase.path}: JSON-LD is not valid JSON (${(error as Error).message})`];
  }

  const graph = (parsed as { "@graph"?: Array<Record<string, unknown>> })["@graph"];
  if (!Array.isArray(graph)) return [`${testCase.path}: JSON-LD has no @graph array`];

  if ((parsed as { "@context"?: string })["@context"] !== "https://schema.org") {
    issues.push(`${testCase.path}: @context must be https://schema.org`);
  }

  const serialized = JSON.stringify(graph);
  for (const key of FORBIDDEN_KEYS) {
    if (serialized.includes(`"${key}"`)) {
      issues.push(`${testCase.path}: ${key} is not supported by the product`);
    }
  }

  const byType = collectTypes(graph);

  for (const type of testCase.types) {
    if (!byType.has(type)) issues.push(`${testCase.path}: missing ${type}`);
  }

  if (testCase.path === "/") {
    const site = websiteSchema.safeParse(byType.get("WebSite"));
    if (!site.success) issues.push(`${testCase.path}: WebSite ${site.error.issues[0]?.message}`);
  }

  if (testCase.crumbs !== null) {
    const result = breadcrumbSchema.safeParse(byType.get("BreadcrumbList"));
    if (!result.success) {
      issues.push(`${testCase.path}: BreadcrumbList ${result.error.issues[0]?.message}`);
    } else {
      const items = result.data.itemListElement;
      if (items.length !== testCase.crumbs) {
        issues.push(`${testCase.path}: expected ${testCase.crumbs} crumbs, found ${items.length}`);
      }
      items.forEach((item, index) => {
        if (item.position !== index + 1) {
          issues.push(`${testCase.path}: crumb ${index + 1} has position ${item.position}`);
        }
      });
      if (items.at(-1)?.item !== canonical && !testCase.path.includes("/learn/")) {
        issues.push(`${testCase.path}: last crumb ${items.at(-1)?.item} does not match the canonical ${canonical}`);
      }
      if (testCase.path.includes("/learn/")) {
        const topicUrl = canonical.split("/learn/")[0]!;
        if (items.at(-1)?.item !== topicUrl) {
          issues.push(`${testCase.path}: resource breadcrumb must end at ${topicUrl}`);
        }
      }
      // Canonicals are emitted without a trailing slash (SEO §3.2), including the homepage.
      if (items[0]?.item !== origin) issues.push(`${testCase.path}: first crumb must be the homepage origin`);
    }
  }

  if (testCase.types.includes("Course")) {
    const result = courseSchema.safeParse(byType.get("Course"));
    if (!result.success) {
      const issue = result.error.issues[0];
      issues.push(`${testCase.path}: Course ${issue?.path.join(".")} ${issue?.message}`);
    } else if (result.data.url !== canonical) {
      issues.push(`${testCase.path}: Course url ${result.data.url} does not match the canonical ${canonical}`);
    }
  }

  if (testCase.types.includes("LearningResource")) {
    const result = learningResourceSchema.safeParse(byType.get("LearningResource"));
    if (!result.success) {
      const issue = result.error.issues[0];
      issues.push(`${testCase.path}: LearningResource ${issue?.path.join(".")} ${issue?.message}`);
    } else if (result.data.url !== canonical) {
      issues.push(`${testCase.path}: LearningResource url does not match the canonical ${canonical}`);
    }
  }

  return issues;
}

const allIssues: Issue[] = [];
for (const testCase of CASES) {
  const issues = await checkPage(testCase);
  allIssues.push(...issues);
  console.log(`${issues.length === 0 ? "ok  " : "FAIL"} ${testCase.path}`);
}

if (allIssues.length > 0) {
  console.error(`\n${allIssues.length} structured-data problem(s):`);
  for (const issue of allIssues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(`\nstructured data ok: ${CASES.length} pages`);

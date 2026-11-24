/**
 * `/design` — the primitive gallery (`MVP_ROADMAP.md` §4.2, `DESIGN_SYSTEM.md` §12).
 *
 * Development-only and `noindex`: it exists so every primitive can be reviewed in one
 * place against the tokens, not shipped as a public page. In a production build the route
 * is a 404, so it can never be crawled or linked by accident.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge, FormatBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Design primitives",
  robots: { index: false, follow: false },
};

export default function DesignPage(): React.JSX.Element {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-[1000px] flex-1 px-[var(--gutter)] py-12">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">Design primitives</h1>
        <p className="mt-3 max-w-[60ch] text-ink-2">
          Every primitive Phase 1 ships, rendered against the real tokens. Development-only.
        </p>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="sunbeam">Sunbeam</Button>
            <Button disabled>Disabled</Button>
            <ButtonLink href="/subjects" variant="secondary" size="sm">
              Link button
            </ButtonLink>
          </div>
        </Section>

        <Section title="Badges and formats">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="draft">Draft</Badge>
            <Badge tone="review">In review</Badge>
            <Badge tone="published">Published</Badge>
            <Badge tone="archived">Archived</Badge>
            <Badge tone="easy">Easy</Badge>
            <Badge tone="medium">Medium</Badge>
            <Badge tone="hard">Hard</Badge>
            <Badge tone="very-hard">Very hard</Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FormatBadge format="study" />
            <FormatBadge format="lesson" />
            <FormatBadge format="test" />
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <p className="font-display text-lg font-semibold">Card</p>
              <p className="mt-1 text-sm text-ink-2">
                Paper-raised surface, hairline edge, soft elevation.
              </p>
            </Card>
            <Card className="bg-paper-sunk shadow-none">
              <p className="font-display text-lg font-semibold">Inset</p>
              <p className="mt-1 text-sm text-ink-2">
                A nested surface is a paper-sunk inset, never another card.
              </p>
            </Card>
          </div>
        </Section>

        <Section title="Callouts">
          <div className="space-y-4">
            <Callout tone="tip">Keep the worked example above the questions.</Callout>
            <Callout tone="warning">Do not round until the final line of the calculation.</Callout>
            <Callout tone="example">2H₂ + O₂ → 2H₂O, so four moles of hydrogen need two of oxygen.</Callout>
            <Callout tone="examtip">Show the unit in every answer; it carries a mark.</Callout>
            <Callout tone="definition">Osmosis is the net movement of water across a membrane.</Callout>
          </div>
        </Section>

        <Section title="Form fields">
          <div className="grid max-w-[520px] gap-6">
            <FormField id="design-email" label="Email" hint="We use this only for sign-in and account mail." required>
              {(field) => <Input {...field} type="email" name="email" placeholder="you@example.com" />}
            </FormField>
            <FormField id="design-error" label="Username" error="Use at least three characters.">
              {(field) => <Input {...field} name="username" defaultValue="ab" />}
            </FormField>
            <FormField id="design-notes" label="Notes" hint="Optional.">
              {(field) => <Textarea {...field} name="notes" />}
            </FormField>
          </div>
        </Section>

        <Section title="Progress">
          <div className="max-w-[520px] space-y-5">
            <ProgressBar value={64} label="Topic mastery: 64%" />
            <ProgressBar value={100} max={100} label="Practice test complete" />
          </div>
        </Section>

        <Section title="Skeleton">
          <div className="max-w-[520px] space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </Section>

        <Section title="Empty state">
          <EmptyState
            title="No practice attempts yet"
            description="Finish a practice test and your accuracy will appear here."
            action={<Button>Start a practice test</Button>}
            secondary={
              <ButtonLink href="/subjects" variant="secondary">
                Browse subjects
              </ButtonLink>
            }
          />
        </Section>

        <Section title="Tabs">
          <Tabs
            items={[
              { id: "overview", label: "Overview", content: <p className="text-ink-2">The topic summary and objectives.</p> },
              { id: "material", label: "Study material", content: <p className="text-ink-2">Resources in reading order.</p> },
              { id: "practice", label: "Practice", content: <p className="text-ink-2">Questions for this topic.</p> },
            ]}
          />
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="mt-14 border-t border-line pt-8">
      <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

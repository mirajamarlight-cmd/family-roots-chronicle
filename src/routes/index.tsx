import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, TreeDeciduous } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import {
  HOME_HERO,
  HOME_SECTIONS,
  SCHOLARLY_TITLES,
  SITE_PURPOSE,
} from "@/content/home";
import { useFamilyGraph } from "@/hooks/useFamily";
import { SITE_NAME, YONIS_PORTRAIT_PATH } from "@/lib/brand";
import { canonicalRootId } from "@/lib/family";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${HOME_HERO.title} — ${SITE_NAME}` },
      { name: "description", content: SITE_PURPOSE },
      { property: "og:title", content: `${HOME_HERO.title} — ${SITE_NAME}` },
      { property: "og:description", content: HOME_HERO.subtitle },
      { property: "og:image", content: YONIS_PORTRAIT_PATH },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: graph } = useFamilyGraph();
  const yonisId = graph ? canonicalRootId(graph) : null;

  return (
    <AppShell>
      <article className="mx-auto max-w-3xl">
        <header className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
          <img
            src={YONIS_PORTRAIT_PATH}
            alt={`Portrait of ${HOME_HERO.title}`}
            className="size-32 shrink-0 rounded-full border border-border object-cover leaf-shadow sm:size-40"
          />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {HOME_HERO.title}
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{HOME_HERO.subtitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{HOME_HERO.recordNote}</p>
          </div>
        </header>

        <ul className="mt-6 flex flex-wrap justify-center gap-1.5 sm:justify-start" aria-label="Scholarly titles">
          {SCHOLARLY_TITLES.map((title) => (
            <li
              key={title}
              className="rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              {title}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/tree" search={yonisId ? { person: yonisId } : undefined}>
              <TreeDeciduous aria-hidden />
              Explore the family tree
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/search">
              <Search aria-hidden />
              Search relatives
            </Link>
          </Button>
        </div>

        <div className="mt-10 space-y-8">
          {HOME_SECTIONS.map((section) => (
            <section key={section.id}>
              <h2 className="font-display text-xl font-semibold tracking-tight">{section.title}</h2>
              <p className="mt-2 text-[15px] leading-7 text-foreground/90">{section.body}</p>
            </section>
          ))}
        </div>

        <ContentCard className="mt-10 border-primary/20 bg-primary/5">
          <h2 className="font-display text-xl font-semibold tracking-tight">Why this website exists</h2>
          <p className="mt-2 text-[15px] leading-7 text-foreground/90">{SITE_PURPOSE}</p>
          <Button asChild className="mt-5">
            <Link to="/tree" search={yonisId ? { person: yonisId } : undefined}>
              <TreeDeciduous aria-hidden />
              Open the family tree
            </Link>
          </Button>
        </ContentCard>
      </article>
    </AppShell>
  );
}

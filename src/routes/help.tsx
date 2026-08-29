import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  GitCompare,
  Heart,
  Search,
  Settings,
  Sparkles,
  TreeDeciduous,
  UserRound,
} from "lucide-react";
import type { ComponentType } from "react";

import { AppShell } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: `How to use the website — ${SITE_NAME}` },
      {
        name: "description",
        content: "A quick, friendly guide to exploring and contributing to the Feqi Yonis family tree.",
      },
    ],
  }),
  component: HelpPage,
});

const JOURNEY = [
  {
    title: "Explore the tree",
    description: "Start with Yonis, follow a branch, and open any relative to learn more.",
    icon: TreeDeciduous,
    to: "/tree",
    action: "Open the tree",
    color: "bg-primary/10 text-primary",
    tips: [
      "Tap a person to open their family details.",
      "Use the branch and generation filters when the tree feels crowded.",
      "On a phone, drag to move and pinch to zoom.",
    ],
  },
  {
    title: "Find a relative",
    description: "Search by name and use the family path to tell people with the same name apart.",
    icon: Search,
    to: "/search",
    action: "Try a search",
    color: "bg-sky-500/10 text-sky-700",
    tips: [
      "A first name is usually enough to begin.",
      "Parent names and the ancestry path help identify the right person.",
      "Select a result to jump straight to them on the tree.",
    ],
  },
  {
    title: "Discover a relationship",
    description: "Choose two relatives and see the documented family path connecting them.",
    icon: GitCompare,
    to: "/relationship",
    action: "Connect two people",
    color: "bg-violet-500/10 text-violet-700",
    tips: [
      "Pick the first person, then the second.",
      "Swap them at any time to read the relationship the other way around.",
      "Results follow recorded parent–child links, not guesses.",
    ],
  },
  {
    title: "Add yourself",
    description: "Create an account, find your record—or add a new one—and send it for review.",
    icon: UserRound,
    to: "/join",
    action: "Start joining",
    color: "bg-amber-500/10 text-amber-700",
    tips: [
      "Already registered? Choose Sign in. New here? Choose Create account.",
      "Search carefully before registering a new person.",
      "After approval, Profile appears in the header for viewing and updating your details.",
    ],
  },
  {
    title: "See the family grow",
    description: "Turn the family record into a quick picture with generations and record counts.",
    icon: BarChart3,
    to: "/statistics",
    action: "View statistics",
    color: "bg-rose-500/10 text-rose-700",
    tips: [
      "Counts come only from documented records.",
      "Use generation totals to understand the shape of the tree.",
      "Statistics update as approved records are added.",
    ],
  },
  {
    title: "Keep the record",
    description: "Record keepers review submissions and carefully maintain people and relationships.",
    icon: Settings,
    to: "/admin",
    action: "Open admin",
    color: "bg-slate-500/10 text-slate-700",
    tips: [
      "Only approved administrators can make direct changes.",
      "Review identity, family placement, and contact details before approving.",
      "Reject uncertain submissions and confirm the facts with the relative.",
    ],
  },
] as const;

function JourneyCard({
  step,
  title,
  description,
  icon: Icon,
  to,
  action,
  color,
  tips,
}: {
  step: number;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  to: (typeof JOURNEY)[number]["to"];
  action: string;
  color: string;
  tips: readonly string[];
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/85 p-5 leaf-shadow transition-transform duration-200 hover:-translate-y-1">
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-primary/5 transition-transform duration-300 group-hover:scale-125"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className={cn("flex size-11 items-center justify-center rounded-2xl", color)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="font-display text-sm font-semibold text-muted-foreground/60">
          {String(step).padStart(2, "0")}
        </span>
      </div>

      <h2 className="relative mt-4 font-display text-xl font-semibold tracking-tight">{title}</h2>
      <p className="relative mt-2 flex-1 text-sm leading-6 text-muted-foreground">{description}</p>

      <Accordion type="single" collapsible className="relative mt-3">
        <AccordionItem value="tips" className="border-none">
          <AccordionTrigger className="py-2 text-xs font-semibold text-primary hover:no-underline">
            Show me how
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2 border-l-2 border-primary/20 pl-3 text-xs leading-5 text-muted-foreground">
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button asChild variant="outline" className="relative mt-3 w-full rounded-xl">
        <Link to={to}>
          {action}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </Button>
    </article>
  );
}

function HelpPage() {
  return (
    <AppShell>
      <article className="mx-auto max-w-5xl">
        <header className="relative overflow-hidden rounded-3xl border border-primary/15 bg-primary/5 px-5 py-8 text-center leaf-shadow sm:px-10 sm:py-12">
          <Sparkles
            className="absolute left-[12%] top-7 size-5 text-primary/30"
            aria-hidden
          />
          <Heart
            className="absolute bottom-8 right-[10%] size-6 rotate-12 text-primary/20"
            aria-hidden
          />
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <TreeDeciduous className="size-7" aria-hidden />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Your three-minute tour
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Every name is part of a story
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Explore the family, discover how people connect, and help preserve your part of the
            record. Pick any card below—there is no required order.
          </p>
        </header>

        <div className="relative mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY.map((item, index) => (
            <JourneyCard key={item.title} step={index + 1} {...item} />
          ))}
        </div>

        <ContentCard className="mt-8 border-primary/20 bg-primary/5 text-center">
          <h2 className="font-display text-xl font-semibold">A family record grows carefully</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            You can browse without an account. New people and profile changes are reviewed before
            they appear, while contact details remain visible only to you and record keepers.
          </p>
          <Button asChild className="mt-5 rounded-xl">
            <Link to="/tree">
              <TreeDeciduous aria-hidden />
              Begin exploring
            </Link>
          </Button>
        </ContentCard>
      </article>
    </AppShell>
  );
}

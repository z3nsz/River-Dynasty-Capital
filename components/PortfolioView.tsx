"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LivePricesProvider } from "./LivePricesProvider";
import { SleeveToggle } from "./SleeveToggle";
import { MarketBadge } from "./MarketBadge";
import { HeadlineStats } from "./HeadlineStats";
import { GrowthChart } from "./GrowthChart";
import { HoldingsTable } from "./HoldingsTable";
import { RealizedTable } from "./RealizedTable";
import { Footer } from "./Footer";
import { useSleeveMetrics } from "@/hooks/useSleeveMetrics";
import type { SelectedSleeve, SleeveOption } from "@/lib/data";
import type { MarketStatus, PricesResponse, QuoteMap } from "@/lib/types";

export interface PortfolioViewProps {
  tagline: string;
  options: SleeveOption[];
  sleeves: Record<string, SelectedSleeve>;
  initialSlug: string;
  initialQuotes: QuoteMap;
  initialAsOf: string | null;
  initialMarket: MarketStatus;
  initialSource: PricesResponse["source"];
}

export function PortfolioView(props: PortfolioViewProps) {
  return (
    <LivePricesProvider
      initialQuotes={props.initialQuotes}
      initialAsOf={props.initialAsOf}
      initialMarket={props.initialMarket}
      initialSource={props.initialSource}
    >
      <Inner {...props} />
    </LivePricesProvider>
  );
}

function Inner({ tagline, options, sleeves, initialSlug }: PortfolioViewProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(
    sleeves[initialSlug] ? initialSlug : options[0]?.slug,
  );

  const select = useCallback(
    (next: string) => {
      if (!sleeves[next]) return;
      setSlug(next);
      const q = next === options[0]?.slug ? "" : `?sleeve=${next}`;
      router.replace(`/${q}`, { scroll: false });
    },
    [router, sleeves, options],
  );

  const sleeve = sleeves[slug];

  return (
    <div className="mx-auto w-full max-w-sheet px-4 sm:px-8">
      <Masthead
        tagline={tagline}
        options={options}
        selected={slug}
        onSelect={select}
      />
      {sleeve ? <SleeveBody sleeve={sleeve} /> : <EmptySleeve />}
      <Footer />
    </div>
  );
}

function Masthead({
  tagline,
  options,
  selected,
  onSelect,
}: {
  tagline: string;
  options: SleeveOption[];
  selected: string;
  onSelect: (s: string) => void;
}) {
  return (
    <header className="border-b border-ink pb-5 pt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            River Dynasty Capital
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted">{tagline}</p>
        </div>
        <SleeveToggle options={options} selected={selected} onSelect={onSelect} />
      </div>
      <div className="mt-4">
        <MarketBadge />
      </div>
    </header>
  );
}

function SleeveBody({ sleeve }: { sleeve: SelectedSleeve }) {
  const m = useSleeveMetrics(sleeve);
  return (
    <main className="py-8">
      <div className="mb-8">
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="font-display text-2xl">{m.meta.displayName}</h2>
          {m.meta.isCombined && (
            <span className="text-xs text-muted">both sleeves aggregated</span>
          )}
        </div>
        <HeadlineStats m={m} />
      </div>

      <div className="mb-10">
        <GrowthChart
          snapshots={sleeve.snapshots}
          live={{ portfolio: m.portfolioIndex, sp: m.spIndex }}
          portfolioName={m.meta.displayName}
        />
      </div>

      <HoldingsTable holdings={m.holdings} isCombined={m.meta.isCombined} />
      <RealizedTable closed={m.closed} isCombined={m.meta.isCombined} />
    </main>
  );
}

function EmptySleeve() {
  return (
    <main className="py-16">
      <p className="text-sm text-muted">
        This sleeve has no data. Add positions from the admin panel.
      </p>
    </main>
  );
}

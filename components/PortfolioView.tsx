"use client";

import { LivePricesProvider } from "./LivePricesProvider";
import { MarketBadge } from "./MarketBadge";
import { HeadlineStats } from "./HeadlineStats";
import { GrowthChart } from "./GrowthChart";
import { HoldingsTable } from "./HoldingsTable";
import { RealizedTable } from "./RealizedTable";
import { Footer } from "./Footer";
import { Logo } from "./Logo";
import { useSleeveMetrics } from "@/hooks/useSleeveMetrics";
import { longDate } from "@/lib/format";
import type { SelectedSleeve } from "@/lib/data";
import type { MarketStatus, PricesResponse, QuoteMap } from "@/lib/types";

export interface PortfolioViewProps {
  tagline: string;
  fund: SelectedSleeve;
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

function Inner({ tagline, fund }: PortfolioViewProps) {
  return (
    <div className="mx-auto w-full max-w-sheet px-4 sm:px-8">
      <header className="border-b border-ink pb-5 pt-10">
        <div className="flex items-center gap-3">
          <Logo size={40} className="shrink-0 rounded-[11px]" />
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            River Dynasty Capital
          </h1>
        </div>
        <p className="mt-2 max-w-prose text-sm text-muted">{tagline}</p>
        <div className="mt-4">
          <MarketBadge />
        </div>
      </header>
      <SleeveBody fund={fund} />
      <Footer />
    </div>
  );
}

function SleeveBody({ fund }: { fund: SelectedSleeve }) {
  const m = useSleeveMetrics(fund);
  return (
    <main className="py-8">
      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h2 className="font-display text-2xl">{m.meta.displayName}</h2>
          <span className="tnum text-xs text-muted">
            since {longDate(m.meta.inceptionDate)}
          </span>
        </div>
        <HeadlineStats m={m} />
      </div>

      <div className="mb-10">
        <GrowthChart
          snapshots={fund.snapshots}
          live={{ portfolio: m.portfolioIndex, sp: m.spIndex }}
          portfolioName={m.meta.displayName}
        />
      </div>

      <HoldingsTable holdings={m.holdings} />
      <RealizedTable closed={m.closed} />
    </main>
  );
}

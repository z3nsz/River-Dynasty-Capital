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
import { longDate, pct, signClass } from "@/lib/format";
import { BENCHMARK_LABEL } from "@/lib/config";
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
    <div className="site-shell mx-auto w-full max-w-sheet px-4 sm:px-8">
      <header className="site-header border-b border-ink pb-6 pt-8 sm:pt-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <Logo size={44} className="shrink-0 rounded-[13px] shadow-sm" />
            <div>
              <p className="eyebrow mb-1">Investment office · Est. 2020</p>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                River Dynasty Capital
              </h1>
            </div>
          </div>
          <div className="pt-1">
            <MarketBadge />
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-muted">{tagline}</p>
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
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-2xl">{m.meta.displayName}</h2>
          <span className="tnum text-xs text-muted">
            since {longDate(m.meta.inceptionDate)}
          </span>
          {m.dayChangePct != null && (
            <span className="tnum text-sm">
              <span className={signClass(m.dayChangePct, { neutral: "text-muted" })}>
                {pct(m.dayChangePct / 100, 2)}
              </span>{" "}
              <span className="text-muted">today</span>
              {m.benchmarkDayChangePct != null && (
                <span className="text-muted">
                  {" "}
                  · {BENCHMARK_LABEL}{" "}
                  <span className={signClass(m.benchmarkDayChangePct, { neutral: "text-muted" })}>
                    {pct(m.benchmarkDayChangePct / 100, 2)}
                  </span>
                </span>
              )}
            </span>
          )}
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

import { loadPortfolio, selectFund, loadQuotes } from "@/lib/data";
import { getMarketStatus } from "@/lib/market";
import { hasPriceApi } from "@/lib/config";
import { PortfolioView } from "@/components/PortfolioView";
import { NotConfigured } from "@/components/NotConfigured";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// Private: reachable only through the login gate in middleware.ts.
export const metadata: Metadata = {
  title: "Portfolio — River Dynasty Capital",
  robots: { index: false, follow: false },
};

const TAGLINE =
  "A personal investment track record — performance versus the S&P 500, holding by holding, with the thesis behind each position.";

export default async function PortfolioPage() {
  const data = await loadPortfolio();
  if (!data.configured) return <NotConfigured />;

  const fund = selectFund(data);
  if (!fund) return <NotConfigured />;

  const { quotes, asOf } = await loadQuotes();

  return (
    <PortfolioView
      tagline={TAGLINE}
      fund={fund}
      initialQuotes={quotes}
      initialAsOf={asOf}
      initialMarket={getMarketStatus()}
      initialSource={hasPriceApi() ? "cache" : "manual"}
    />
  );
}

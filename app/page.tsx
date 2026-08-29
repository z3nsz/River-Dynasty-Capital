import { loadPortfolio, selectFund, loadQuotes } from "@/lib/data";
import { getMarketStatus } from "@/lib/market";
import { hasPriceApi } from "@/lib/config";
import { PortfolioView } from "@/components/PortfolioView";
import { NotConfigured } from "@/components/NotConfigured";

export const dynamic = "force-dynamic";

const TAGLINE =
  "A personal investment track record — performance versus the S&P 500, holding by holding, with the thesis behind each position.";

export default async function HomePage() {
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

import { loadPortfolio, sleeveOptions, selectSleeve, loadQuotes } from "@/lib/data";
import { getMarketStatus } from "@/lib/market";
import { hasPriceApi, COMBINED_SLUG } from "@/lib/config";
import { PortfolioView } from "@/components/PortfolioView";
import { NotConfigured } from "@/components/NotConfigured";
import type { SelectedSleeve } from "@/lib/data";

export const dynamic = "force-dynamic";

const TAGLINE =
  "A personal investment track record — performance versus the S&P 500, holding by holding, with the thesis behind each position.";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sleeve?: string }>;
}) {
  const params = await searchParams;
  const data = await loadPortfolio();

  if (!data.configured) {
    return <NotConfigured />;
  }

  const { quotes, asOf } = await loadQuotes();
  const options = sleeveOptions(data.sleeves);

  const sleeves: Record<string, SelectedSleeve> = {};
  for (const opt of options) {
    const sel = selectSleeve(opt.slug, data);
    if (sel) sleeves[opt.slug] = sel;
  }

  const requested = params.sleeve && sleeves[params.sleeve] ? params.sleeve : COMBINED_SLUG;
  const initialSlug = sleeves[requested] ? requested : options[0]?.slug ?? COMBINED_SLUG;

  return (
    <PortfolioView
      tagline={TAGLINE}
      options={options}
      sleeves={sleeves}
      initialSlug={initialSlug}
      initialQuotes={quotes}
      initialAsOf={asOf}
      initialMarket={getMarketStatus()}
      initialSource={hasPriceApi() ? "cache" : "manual"}
    />
  );
}

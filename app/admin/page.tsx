import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminGuard";
import { loadPortfolio } from "@/lib/data";
import { readPriceCache } from "@/lib/prices";
import { hasServiceClient } from "@/lib/supabase/server";
import { hasPriceApi } from "@/lib/config";
import { getMarketStatus } from "@/lib/market";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login?next=/admin");

  if (!hasServiceClient()) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-sm">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="mt-4 text-loss">
          Supabase service role is not configured. Set{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>.env.local</code>.
        </p>
      </div>
    );
  }

  const data = await loadPortfolio();
  const cache = await readPriceCache().catch(() => ({ quotes: {}, asOf: null }));

  return (
    <AdminDashboard
      sleeves={data.sleeves}
      positions={data.positions}
      snapshots={data.snapshots}
      quotesAsOf={cache.asOf}
      hasPriceApi={hasPriceApi()}
      market={getMarketStatus()}
    />
  );
}

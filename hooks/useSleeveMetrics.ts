"use client";

import { useMemo } from "react";
import { useLivePrices } from "@/components/LivePricesProvider";
import { computeSleeveMetrics } from "@/lib/sleeveMetrics";
import type { SelectedSleeve } from "@/lib/data";
import type { SleeveMetrics } from "@/lib/sleeveMetrics";

/** Recomputes a sleeve's money-free metrics from the current live quote map. */
export function useSleeveMetrics(sleeve: SelectedSleeve): SleeveMetrics {
  const { quotes } = useLivePrices();
  return useMemo(
    () =>
      computeSleeveMetrics(
        sleeve.meta,
        sleeve.holdings,
        sleeve.closed,
        quotes,
        new Date(),
      ),
    [sleeve, quotes],
  );
}

import { useEffect } from "react";
import { fetchTokenAnalyticsTopMovers } from "../api/mapsApi";
import {
  MAPS_API_BASE_URL,
  MAPS_API_REQUEST_TIMEOUT_MS,
} from "../config/appConfig";
import {
  buildTokenNotFoundStatus,
  formatApiErrorMeta,
  isTokenNotFoundError,
} from "../api/apiErrors";

export default function useTokenTopMovers({
  selectedTokenSymbol,
  setIsTokenTopMoversLoading,
  setTokenAnalyticsTopMovers,
  setTokenAnalyticsTopMoversStatus,
}) {
  useEffect(() => {
    let isMounted = true;

    async function loadTokenAnalyticsTopMovers() {
      const tokenKey = String(selectedTokenSymbol || "").trim();
      if (!tokenKey) {
        setTokenAnalyticsTopMoversStatus("");
        setIsTokenTopMoversLoading(false);
        return;
      }

      setIsTokenTopMoversLoading(true);
      setTokenAnalyticsTopMoversStatus(`Loading ${tokenKey} top movers...`);

      try {
        const horizons = ["24h", "7d", "30d"];
        const results = await Promise.all(
          horizons.map((horizon) => {
            const daysMap = { "24h": 1, "7d": 7, "30d": 30 };
            return fetchTokenAnalyticsTopMovers(
              MAPS_API_BASE_URL,
              MAPS_API_REQUEST_TIMEOUT_MS,
              tokenKey,
              daysMap[horizon] || 7,
              10,
              false,
            );
          }),
        );

        if (!isMounted) return;

        const normalizedByHorizon = {};
        horizons.forEach((horizon, horizonIndex) => {
          const result = results[horizonIndex] || { items: [] };
          const normalizedItems = (
            Array.isArray(result.items) ? result.items : []
          )
            .map((item) => {
              const parsedLatestBalance = Number(
                item?.latestBalance ?? item?.latest_balance ?? 0,
              );
              const parsedPreviousBalance = Number(
                item?.previousBalance ?? item?.previous_balance ?? 0,
              );
              const parsedDeltaBalance = Number(
                item?.deltaBalance ?? item?.delta_balance ?? 0,
              );
              const parsedDeltaPct = Number(
                item?.deltaPct ?? item?.delta_pct ?? 0,
              );
              const latestBalance = Number.isFinite(parsedLatestBalance)
                ? parsedLatestBalance
                : 0;
              const previousBalance = Number.isFinite(parsedPreviousBalance)
                ? parsedPreviousBalance
                : latestBalance - parsedDeltaBalance;
              const deltaBalance = Number.isFinite(parsedDeltaBalance)
                ? parsedDeltaBalance
                : 0;
              const deltaPct = Number.isFinite(parsedDeltaPct)
                ? parsedDeltaPct
                : null;

              return {
                address: String(item?.address || "").trim(),
                deltaBalance,
                deltaPct,
                latestBalance,
                previousBalance,
                label: String(item?.label || item?.name || "").trim(),
              };
            })
            .filter((item) => item.address);

          normalizedByHorizon[horizon] = normalizedItems;
        });

        setTokenAnalyticsTopMovers((current) => ({
          ...current,
          [tokenKey]: normalizedByHorizon,
        }));
        setTokenAnalyticsTopMoversStatus("");
      } catch (error) {
        if (!isMounted) return;
        if (isTokenNotFoundError(error)) {
          setTokenAnalyticsTopMoversStatus(
            buildTokenNotFoundStatus(tokenKey, error),
          );
          return;
        }

        setTokenAnalyticsTopMoversStatus(
          `Top movers API unavailable for this token.${formatApiErrorMeta(error)}`,
        );
      } finally {
        if (isMounted) {
          setIsTokenTopMoversLoading(false);
        }
      }
    }

    loadTokenAnalyticsTopMovers();

    return () => {
      isMounted = false;
    };
  }, [
    selectedTokenSymbol,
    setIsTokenTopMoversLoading,
    setTokenAnalyticsTopMovers,
    setTokenAnalyticsTopMoversStatus,
  ]);
}

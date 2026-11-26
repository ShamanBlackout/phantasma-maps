import { useEffect } from "react";
import {
  fetchBackendTokenQuote,
  fetchCoinGeckoQuote,
  fetchExplorerTokenQuote,
} from "../api/tokenPrices";
import { TOKEN_INFO } from "../data/mockData";
import {
  MAPS_API_BASE_URL,
  PHANTASMA_EXPLORER_TOKEN_API_URL,
  SOUL_PRICE_API_URL,
  SOUL_PRICE_BASE_POLL_INTERVAL_MS,
  SOUL_PRICE_MAX_BACKOFF_MS,
} from "../config/appConfig";

export default function useSoulPricePolling({
  setLiveTokenInfo,
  setPriceLastUpdatedAt,
}) {
  useEffect(() => {
    let isActive = true;
    let timeoutId;
    let hasSuccessfulQuote = false;
    let nextPollDelayMs = 5000;

    function scheduleNextPoll(delayMs) {
      if (!isActive) return;
      const jitterMs = Math.floor(Math.random() * 3000);
      timeoutId = window.setTimeout(fetchSoulPrice, delayMs + jitterMs);
    }

    async function fetchSoulPrice() {
      try {
        const backendResult = await fetchBackendTokenQuote(
          TOKEN_INFO.name,
          MAPS_API_BASE_URL,
        ).catch(() => ({ ok: false, status: 0 }));
        const primaryResult = backendResult.ok
          ? backendResult
          : await fetchCoinGeckoQuote(SOUL_PRICE_API_URL);
        const explorerResult = primaryResult.ok
          ? null
          : await fetchExplorerTokenQuote(TOKEN_INFO.name, {
              explorerUrl: PHANTASMA_EXPLORER_TOKEN_API_URL,
            });

        const winner = primaryResult.ok ? primaryResult : explorerResult;

        if (!winner?.ok || !winner.quote) {
          const retryAfterMs = primaryResult?.retryAfterMs || 0;
          const hitRateLimit = primaryResult?.status === 429;

          if (hitRateLimit) {
            nextPollDelayMs =
              retryAfterMs ||
              Math.min(nextPollDelayMs * 2, SOUL_PRICE_MAX_BACKOFF_MS);
          } else {
            const bootstrapRetryFloorMs = 30000;
            const retryFloorMs = hasSuccessfulQuote
              ? SOUL_PRICE_BASE_POLL_INTERVAL_MS
              : bootstrapRetryFloorMs;
            nextPollDelayMs = Math.min(
              Math.max(nextPollDelayMs * 2, retryFloorMs),
              SOUL_PRICE_MAX_BACKOFF_MS,
            );
          }

          scheduleNextPoll(nextPollDelayMs);
          return;
        }

        if (!isActive) {
          nextPollDelayMs = Math.max(
            SOUL_PRICE_BASE_POLL_INTERVAL_MS,
            nextPollDelayMs,
          );
          scheduleNextPoll(nextPollDelayMs);
          return;
        }

        setLiveTokenInfo((current) => ({
          ...current,
          price: winner.quote.price,
          priceChange24h: winner.quote.priceChange24h,
        }));
        hasSuccessfulQuote = true;
        setPriceLastUpdatedAt(Date.now());
        nextPollDelayMs = SOUL_PRICE_BASE_POLL_INTERVAL_MS;
        scheduleNextPoll(nextPollDelayMs);
      } catch {
        // Keep last successful price if the API is unreachable.
        const bootstrapRetryFloorMs = 30000;
        const retryFloorMs = hasSuccessfulQuote
          ? SOUL_PRICE_BASE_POLL_INTERVAL_MS
          : bootstrapRetryFloorMs;
        nextPollDelayMs = Math.min(
          Math.max(nextPollDelayMs * 2, retryFloorMs),
          SOUL_PRICE_MAX_BACKOFF_MS,
        );
        scheduleNextPoll(nextPollDelayMs);
      }
    }

    fetchSoulPrice();

    return () => {
      isActive = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [setLiveTokenInfo, setPriceLastUpdatedAt]);
}

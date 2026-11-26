import { useEffect } from "react";
import { TOKEN_INFO } from "../data/mockData";
import {
  MAPS_API_BASE_URL,
  SOUL_PRICE_BASE_POLL_INTERVAL_MS,
  TRACKED_TOKEN_PRICE_BOOTSTRAP_RETRY_MS,
  TRACKED_TOKEN_PRICE_OPTIONS,
} from "../config/appConfig";
import { fetchTrackedTokenQuote } from "../api/tokenPrices";

export default function useTrackedTokenPrice({
  selectedTokenSymbol,
  setPriceLastUpdatedAt,
  setTrackedTokenQuotes,
}) {
  useEffect(() => {
    const normalizedTokenSymbol = String(selectedTokenSymbol || "")
      .trim()
      .toUpperCase();
    if (!normalizedTokenSymbol || normalizedTokenSymbol === TOKEN_INFO.name) {
      return undefined;
    }

    let isActive = true;
    let timeoutId;
    let hasSuccessfulQuote = false;
    let retryDelayMs = TRACKED_TOKEN_PRICE_BOOTSTRAP_RETRY_MS;

    async function fetchTrackedTokenPrice() {
      let delayMs = SOUL_PRICE_BASE_POLL_INTERVAL_MS;
      try {
        const result = await fetchTrackedTokenQuote(normalizedTokenSymbol, {
          ...TRACKED_TOKEN_PRICE_OPTIONS,
          apiBaseUrl: MAPS_API_BASE_URL,
        });
        if (isActive && result.ok && result.quote) {
          setTrackedTokenQuotes((current) => {
            const previous = current[normalizedTokenSymbol];
            const quote =
              result.quote.priceChange24h === null &&
              Number.isFinite(previous?.priceChange24h)
                ? { ...result.quote, priceChange24h: previous.priceChange24h }
                : result.quote;
            return { ...current, [normalizedTokenSymbol]: quote };
          });
          setPriceLastUpdatedAt(Date.now());
          hasSuccessfulQuote = true;
          retryDelayMs = TRACKED_TOKEN_PRICE_BOOTSTRAP_RETRY_MS;
        } else if (!hasSuccessfulQuote) {
          // Until a first quote lands, retry quickly instead of waiting a full poll interval.
          delayMs = Math.max(retryDelayMs, result?.retryAfterMs || 0);
          retryDelayMs = Math.min(
            retryDelayMs * 2,
            SOUL_PRICE_BASE_POLL_INTERVAL_MS,
          );
        }
      } catch {
        if (!hasSuccessfulQuote) delayMs = retryDelayMs;
      } finally {
        if (isActive) {
          timeoutId = window.setTimeout(fetchTrackedTokenPrice, delayMs);
        }
      }
    }

    fetchTrackedTokenPrice();

    return () => {
      isActive = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [selectedTokenSymbol, setPriceLastUpdatedAt, setTrackedTokenQuotes]);
}

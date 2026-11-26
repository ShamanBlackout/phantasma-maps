import { useEffect } from "react";
import { fetchJsonWithTimeout } from "../api/http";
import { createTokensEndpoint as buildTokensEndpoint } from "../api/mapsApi";
import {
  MAPS_API_BASE_URL,
  MAPS_API_REQUEST_TIMEOUT_MS,
} from "../config/appConfig";
import { buildApiErrorRecord, formatApiErrorMeta } from "../api/apiErrors";

export default function useAvailableTokens({
  selectedTokenSymbol,
  setApiTokenSymbols,
  setLastApiError,
  setSelectedTokenSymbol,
  setTokenSelectorStatus,
}) {
  useEffect(() => {
    let isMounted = true;

    async function fetchAvailableTokens() {
      const result = await fetchJsonWithTimeout(
        buildTokensEndpoint(MAPS_API_BASE_URL),
        {},
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!isMounted) return;

      if (!result.ok) {
        setLastApiError(
          buildApiErrorRecord(
            result,
            "token-list",
            "API token list request failed",
          ),
        );
        setTokenSelectorStatus(
          result.status === 0
            ? `API token list unavailable${formatApiErrorMeta(result)}`
            : `API token list request failed (${result.status})${formatApiErrorMeta(result)}`,
        );
        setApiTokenSymbols([]);
        return;
      }

      const apiItems = Array.isArray(result.payload?.items)
        ? result.payload.items
        : [];
      const nextTokens = [
        ...new Set(
          apiItems
            .map((token) =>
              String(token || "")
                .trim()
                .toUpperCase(),
            )
            .filter(Boolean),
        ),
      ];

      if (!nextTokens.length) {
        setApiTokenSymbols([]);
        setTokenSelectorStatus("No API tokens available");
        return;
      }

      setApiTokenSymbols(nextTokens);

      if (!nextTokens.includes(selectedTokenSymbol)) {
        setSelectedTokenSymbol(nextTokens[0]);
      }

      setTokenSelectorStatus(`Showing ${nextTokens.length} tracked tokens`);
    }

    fetchAvailableTokens().catch((error) => {
      if (!isMounted) return;
      setLastApiError(
        buildApiErrorRecord(error, "token-list", "API token list unavailable"),
      );
      setApiTokenSymbols([]);
      setTokenSelectorStatus("API token list unavailable");
    });

    return () => {
      isMounted = false;
    };
  }, [
    selectedTokenSymbol,
    setApiTokenSymbols,
    setLastApiError,
    setSelectedTokenSymbol,
    setTokenSelectorStatus,
  ]);
}

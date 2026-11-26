import { useEffect } from "react";
import { fetchJsonWithTimeout } from "../api/http";
import {
  createTokenInfoEndpoint as buildTokenInfoEndpoint,
} from "../api/mapsApi";
import {
  MAPS_API_BASE_URL,
  MAPS_API_REQUEST_TIMEOUT_MS,
  TOKEN_METADATA_POLL_INTERVAL_MS,
} from "../config/appConfig";
import { buildApiErrorRecord, isTokenNotFoundError } from "../api/apiErrors";
import { TOKEN_INFO } from "../data/mockData";

export default function useTokenMetadataPolling({
  selectedTokenSymbol,
  setApiTokenInfo,
  setLastApiError,
  setPriceLastUpdatedAt,
}) {
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    async function fetchTokenInfo() {
      const result = await fetchJsonWithTimeout(
        buildTokenInfoEndpoint(MAPS_API_BASE_URL, selectedTokenSymbol),
        {},
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!isMounted) return;

      if (!result.ok) {
        if (isTokenNotFoundError(result)) {
          setLastApiError(
            buildApiErrorRecord(
              result,
              "token-metadata",
              "Requested token metadata is not available in the database",
            ),
          );
        }
        setApiTokenInfo(null);
        return;
      }

      const payload = result.payload;
      const metadataMaxSupplyRaw =
        payload?.maxSupplyNormalized ?? payload?.max_supply_normalized;
      const hasMetadataMaxSupply =
        metadataMaxSupplyRaw !== undefined && metadataMaxSupplyRaw !== null;
      const parsedMetadataMaxSupply = Number(metadataMaxSupplyRaw);
      const parsedCurrentSupply = Number(
        payload?.currentSupplyNormalized ?? payload?.current_supply_normalized,
      );
      const parsedMetadataPrice = Number(
        payload?.priceUsd ?? payload?.price_usd ?? payload?.price,
      );
      const parsedHolderCount = Number(
        payload?.holderCount ?? payload?.holder_count,
      );
      const parsedMetadataPriceChange24h = Number(
        payload?.priceChange24h ??
          payload?.price_change_24h ??
          payload?.percentChange24h,
      );

      setApiTokenInfo({
        fullName: String(payload?.name || "").trim(),
        totalSupply: Number.isFinite(parsedCurrentSupply)
          ? parsedCurrentSupply
          : null,
        currentSupply: Number.isFinite(parsedCurrentSupply)
          ? parsedCurrentSupply
          : 0,
        maxSupply: Number.isFinite(parsedMetadataMaxSupply)
          ? parsedMetadataMaxSupply
          : null,
        hasMetadataMaxSupply,
        decimals: Number(payload?.decimals ?? 0) || 0,
        chain: String(payload?.chain || TOKEN_INFO.chain || "").trim(),
        globalHolderCount: Number.isFinite(parsedHolderCount)
          ? Math.max(0, Math.floor(parsedHolderCount))
          : null,
        price: Number.isFinite(parsedMetadataPrice)
          ? parsedMetadataPrice
          : null,
        priceChange24h: Number.isFinite(parsedMetadataPriceChange24h)
          ? parsedMetadataPriceChange24h
          : null,
      });

      if (Number.isFinite(parsedMetadataPrice)) {
        setPriceLastUpdatedAt(Date.now());
      }

      timeoutId = window.setTimeout(
        fetchTokenInfo,
        TOKEN_METADATA_POLL_INTERVAL_MS,
      );
    }

    fetchTokenInfo().catch(() => {
      if (!isMounted) return;
      setApiTokenInfo(null);
      timeoutId = window.setTimeout(
        fetchTokenInfo,
        TOKEN_METADATA_POLL_INTERVAL_MS,
      );
    });

    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    selectedTokenSymbol,
    setApiTokenInfo,
    setLastApiError,
    setPriceLastUpdatedAt,
  ]);
}

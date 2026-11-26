import { useMemo } from "react";
import { TOKEN_INFO } from "../data/mockData";

export default function useActiveTokenInfo({
  apiTokenInfo,
  isUsingMockApiFallback,
  liveTokenInfo,
  selectedMockTokenData,
  selectedTokenSymbol,
  trackedTokenQuotes,
  trackedTokenSupply,
}) {
  return useMemo(() => {
    const fallbackTokenInfo = selectedMockTokenData?.tokenInfo;

    // Prefer API-sourced token metadata, then mock fallback, then defaults.
    const resolvedFullName =
      apiTokenInfo?.fullName ||
      (isUsingMockApiFallback ? fallbackTokenInfo?.fullName : null) ||
      `${selectedTokenSymbol} Token`;

    const resolvedChain = apiTokenInfo?.chain || TOKEN_INFO.chain;

    const hasMetadataMaxSupply = Boolean(apiTokenInfo?.hasMetadataMaxSupply);

    const resolvedCurrentSupply =
      (Number.isFinite(apiTokenInfo?.currentSupply)
        ? apiTokenInfo.currentSupply
        : null) ??
      ((trackedTokenSupply > 0 ? trackedTokenSupply : 0) ||
        (isUsingMockApiFallback
          ? (fallbackTokenInfo?.totalSupply ??
            (selectedTokenSymbol === TOKEN_INFO.name
              ? TOKEN_INFO.totalSupply
              : 0))
          : 0));

    const resolvedTotalSupply = resolvedCurrentSupply;
    const resolvedMaxSupply = hasMetadataMaxSupply
      ? Number.isFinite(apiTokenInfo?.maxSupply)
        ? apiTokenInfo.maxSupply
        : 0
      : null;

    const trackedTokenQuote = trackedTokenQuotes[selectedTokenSymbol] || null;
    const resolvedPrice =
      selectedTokenSymbol !== TOKEN_INFO.name &&
      Number.isFinite(trackedTokenQuote?.price)
        ? trackedTokenQuote.price
        : Number.isFinite(apiTokenInfo?.price)
          ? apiTokenInfo.price
          : selectedTokenSymbol === TOKEN_INFO.name
            ? liveTokenInfo.price
            : isUsingMockApiFallback
              ? (fallbackTokenInfo?.price ?? null)
              : null;

    const resolvedPriceChange24h =
      selectedTokenSymbol !== TOKEN_INFO.name &&
      Number.isFinite(trackedTokenQuote?.priceChange24h)
        ? trackedTokenQuote.priceChange24h
        : Number.isFinite(apiTokenInfo?.priceChange24h)
          ? apiTokenInfo.priceChange24h
          : selectedTokenSymbol === TOKEN_INFO.name
            ? liveTokenInfo.priceChange24h
            : isUsingMockApiFallback
              ? (fallbackTokenInfo?.priceChange24h ?? null)
              : null;

    return {
      name: selectedTokenSymbol,
      fullName: resolvedFullName,
      chain: resolvedChain,
      totalSupply: resolvedTotalSupply,
      currentSupply: resolvedCurrentSupply,
      maxSupply: resolvedMaxSupply,
      hasMetadataMaxSupply,
      globalHolderCount: Number.isFinite(apiTokenInfo?.globalHolderCount)
        ? apiTokenInfo.globalHolderCount
        : null,
      price: resolvedPrice,
      priceChange24h: resolvedPriceChange24h,
    };
  }, [
    apiTokenInfo,
    isUsingMockApiFallback,
    selectedMockTokenData,
    selectedTokenSymbol,
    trackedTokenSupply,
    trackedTokenQuotes,
    liveTokenInfo.price,
    liveTokenInfo.priceChange24h,
  ]);
}

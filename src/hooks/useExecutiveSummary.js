import { useMemo } from "react";

export default function useExecutiveSummary({
  currentSupplyBase,
  hasTraceDbPathsGraph,
  renderedGraphLinks,
  renderedGraphNodes,
}) {
  return useMemo(() => {
    const summaryPool = Array.isArray(renderedGraphNodes)
      ? renderedGraphNodes
      : [];
    const visibleWallets = renderedGraphNodes.length;
    const visibleConnections = renderedGraphLinks.length;
    const getNodeSharePct = (holder) => {
      const pctFromNode = Number(holder?.pct);
      if (Number.isFinite(pctFromNode) && pctFromNode >= 0) {
        return pctFromNode;
      }

      if (currentSupplyBase > 0) {
        return (Number(holder?.value || 0) / currentSupplyBase) * 100;
      }

      return 0;
    };
    const topWallet = summaryPool.length
      ? summaryPool.reduce((best, holder) =>
          getNodeSharePct(holder) > getNodeSharePct(best) ? holder : best,
        )
      : null;
    const topWalletShare = topWallet
      ? Math.min(100, Math.max(0, getNodeSharePct(topWallet)))
      : 0;
    const concentrationTop10 = Math.min(
      100,
      Math.max(
        0,
        summaryPool
          .slice()
          .sort((a, b) => getNodeSharePct(b) - getNodeSharePct(a))
          .slice(0, 10)
          .reduce((sum, holder) => sum + getNodeSharePct(holder), 0),
      ),
    );

    return {
      isFocusedPath: Boolean(hasTraceDbPathsGraph),
      visibleWallets,
      visibleConnections,
      topWalletLabel: topWallet?.shortAddr || topWallet?.label || "N/A",
      topWalletShare,
      concentrationTop10,
    };
  }, [
    currentSupplyBase,
    hasTraceDbPathsGraph,
    renderedGraphLinks.length,
    renderedGraphNodes,
  ]);
}

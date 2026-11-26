import { useMemo } from "react";
import { normalizeAmount } from "../graph/graphData";
import { fmtTokenAmount } from "../lib/format";

export default function useMapRecoveryState({
  activeHolderTypeFilter,
  activeTokenInfo,
  connectionMinAmount,
  filteredNodes,
  handleClearConnections,
  handleRetryGraphLoad,
  hasMapError,
  isConnectionsView,
  isMapLoading,
  searchQuery,
  setActiveHolderTypeFilter,
  setSearchQuery,
}) {
  return useMemo(() => {
    if (isMapLoading || filteredNodes.length > 0) {
      return null;
    }

    const canClearSearch = Boolean(searchQuery);
    const canClearLegend = Boolean(activeHolderTypeFilter);
    const canClearConnections = Boolean(isConnectionsView);

    if (hasMapError) {
      return {
        title: "Live data is temporarily unavailable",
        copy: "The graph request failed or timed out. Retry the request or reset filters to continue with a stable view.",
        actions: [
          {
            key: "retry",
            label: "Retry",
            onClick: handleRetryGraphLoad,
          },
          {
            key: "reset",
            label: "Reset View",
            onClick: handleClearConnections,
          },
        ],
      };
    }

    if (isConnectionsView) {
      const connectionThreshold = normalizeAmount(connectionMinAmount);
      return {
        title:
          connectionThreshold > 0
            ? "No connections meet the minimum amount"
            : "No connected wallets for this address",
        copy:
          connectionThreshold > 0
            ? `Lower the minimum amount below ${fmtTokenAmount(connectionThreshold)} ${activeTokenInfo.name} or clear it to show all connections.`
            : "Try another root wallet or return to token overview to continue exploring holder distribution.",
        actions: [
          {
            key: "clear-connections",
            label: "Back to Token Overview",
            onClick: handleClearConnections,
          },
          {
            key: "retry-connections",
            label: "Retry Connections",
            onClick: handleRetryGraphLoad,
          },
        ],
      };
    }

    if (canClearSearch || canClearLegend || canClearConnections) {
      return {
        title: "No wallets match current filters",
        copy: "Clear one or more filters to recover the graph and continue analysis.",
        actions: [
          canClearSearch
            ? {
                key: "clear-search",
                label: "Clear Search",
                onClick: () => setSearchQuery(""),
              }
            : null,
          canClearLegend
            ? {
                key: "clear-legend",
                label: "Clear Legend Filter",
                onClick: () => setActiveHolderTypeFilter(""),
              }
            : null,
          {
            key: "reset-all",
            label: "Reset View",
            onClick: handleClearConnections,
          },
        ].filter(Boolean),
      };
    }

    return {
      title: "No graph data available",
      copy: "The selected token did not return a renderable graph yet. Retry or switch tokens.",
      actions: [
        {
          key: "retry-empty",
          label: "Retry",
          onClick: handleRetryGraphLoad,
        },
      ],
    };
  }, [
    activeHolderTypeFilter,
    filteredNodes.length,
    handleClearConnections,
    hasMapError,
    isConnectionsView,
    isMapLoading,
    searchQuery,
    connectionMinAmount,
    activeTokenInfo.name,
    handleRetryGraphLoad,
    setActiveHolderTypeFilter,
    setSearchQuery,
  ]);
}

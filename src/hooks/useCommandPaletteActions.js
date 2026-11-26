import { useMemo } from "react";

export default function useCommandPaletteActions({
  bubbleMapActionsRef,
  clearActiveContext,
  exportVisibleGraphPreset,
  handleClearConnections,
  handleRetryGraphLoad,
  isFocusMode,
  setActiveHolderTypeFilter,
  setConnectionMinAmount,
  setConnectionsGraphContext,
  setIsCompareModeOpen,
  setIsConnectionsView,
  setIsDiagnosticsOpen,
  setIsFocusMode,
  setIsTraceToolOpen,
  setSearchedRootAddress,
}) {
  return useMemo(() => [
      {
        id: "search-focus",
        label: "Focus search input",
        shortcut: "/",
        run: () => document.getElementById("header-search-input")?.focus(),
      },
      {
        id: "fit",
        label: "Fit graph to view",
        shortcut: "G",
        run: () => bubbleMapActionsRef.current?.fitToView?.(),
      },
      {
        id: "focus",
        label: isFocusMode ? "Disable Focus Mode" : "Enable Focus Mode",
        shortcut: "F",
        run: () => setIsFocusMode((current) => !current),
      },
      {
        id: "clear-context",
        label: "Clear active context",
        shortcut: "Esc",
        run: clearActiveContext,
      },
      {
        id: "connections-clear",
        label: "Clear connections mode",
        run: handleClearConnections,
      },
      {
        id: "legend-clear",
        label: "Clear legend filter",
        run: () => setActiveHolderTypeFilter(""),
      },
      {
        id: "retry",
        label: "Retry graph load",
        run: handleRetryGraphLoad,
      },
      {
        id: "diagnostics",
        label: "Open diagnostics details",
        run: () => setIsDiagnosticsOpen(true),
      },
      {
        id: "trace",
        label: "Open node-to-node trace tool",
        run: () => {
          setSearchedRootAddress("");
          setIsConnectionsView(false);
          setConnectionsGraphContext(null);
          setConnectionMinAmount("");
          setIsTraceToolOpen(true);
        },
      },
      {
        id: "compare",
        label: "Open token compare mode",
        run: () => setIsCompareModeOpen(true),
      },
      {
        id: "export-graph",
        label: "Export visible graph preset",
        run: exportVisibleGraphPreset,
      },
    ], [
    clearActiveContext,
    handleClearConnections,
    isFocusMode,
    setConnectionMinAmount,
    setConnectionsGraphContext,
    setIsFocusMode,
    setIsConnectionsView,
    setIsTraceToolOpen,
    setSearchedRootAddress,
    setActiveHolderTypeFilter,
    exportVisibleGraphPreset,
    bubbleMapActionsRef,
    handleRetryGraphLoad,
    setIsCompareModeOpen,
    setIsDiagnosticsOpen,
  ]);
}

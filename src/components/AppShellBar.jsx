export default function AppShellBar({
  activeLegendLabel,
  activeTutorialTarget,
  activeViewLabel,
  canEnhanceTopLevelGraph,
  commandButtonRef,
  commandPaletteButtonLabel,
  compareButtonRef,
  diagnosticsButtonRef,
  exportPresetsButtonRef,
  isGraphEnrichmentEnabled,
  isGraphEnrichmentLoading,
  isMobileViewport,
  isTraceToolOpen,
  renderedGraphLinks,
  renderedGraphNodes,
  savedViewsButtonRef,
  selectedTokenSymbol,
  setConnectionMinAmount,
  setConnectionsGraphContext,
  setIsCommandPaletteOpen,
  setIsCompareModeOpen,
  setIsConnectionsView,
  setIsDiagnosticsOpen,
  setIsExportPresetsOpen,
  setIsGraphEnrichmentEnabled,
  setIsSavedViewsOpen,
  setIsTraceToolOpen,
  setSearchedRootAddress,
  shellStatusLabel,
  traceToggleButtonRef,
}) {
  return (
    <div className="app-shell-bar" aria-live="polite">
      <div className="app-shell-bar-primary">
        <span
          className="app-shell-pill"
          title="Currently selected token symbol"
        >
          {selectedTokenSymbol}
        </span>
        <span className="app-shell-kicker" title="Current graph perspective">
          {activeViewLabel}
        </span>
        <span
          className="app-shell-copy"
          title="Latest map loading or data status"
        >
          {shellStatusLabel}
        </span>
      </div>
      <div className="app-shell-bar-secondary">
        <span
          className="app-shell-metric"
          title="How many wallets and links are currently visible in the graph"
        >
          <span className="app-shell-metric-label">Visible</span>
          <strong>
            {renderedGraphNodes.length.toLocaleString()} wallets /{" "}
            {renderedGraphLinks.length.toLocaleString()} links
          </strong>
        </span>
        <span
          className="app-shell-metric"
          title="Current legend filter scope used to display wallet tiers"
        >
          <span className="app-shell-metric-label">Legend</span>
          <strong>{activeLegendLabel}</strong>
        </span>
        <button
          type="button"
          ref={commandButtonRef}
          className={`app-shell-action-btn ${activeTutorialTarget === "command" ? "tutorial-highlight" : ""}`}
          onClick={() => setIsCommandPaletteOpen(true)}
          aria-label={
            isMobileViewport ? "Open actions menu" : "Open command palette"
          }
          title={
            isMobileViewport
              ? "Open actions menu"
              : "Open command palette (Ctrl+K)"
          }
        >
          {commandPaletteButtonLabel}
        </button>
        <button
          type="button"
          ref={savedViewsButtonRef}
          className={`app-shell-action-btn ${activeTutorialTarget === "views" ? "tutorial-highlight" : ""}`}
          onClick={() => setIsSavedViewsOpen((open) => !open)}
          aria-label="Open saved views"
          title="Save or load a named graph view"
        >
          Views
        </button>
        <button
          type="button"
          ref={traceToggleButtonRef}
          className={`app-shell-action-btn ${activeTutorialTarget === "trace" ? "tutorial-highlight" : ""}`}
          onClick={() =>
            setIsTraceToolOpen((open) => {
              const willOpen = !open;
              if (willOpen) {
                setSearchedRootAddress("");
                setIsConnectionsView(false);
                setConnectionsGraphContext(null);
                setConnectionMinAmount("");
              }
              return willOpen;
            })
          }
          aria-expanded={isTraceToolOpen}
          aria-controls="map-trace-tool"
          aria-label={
            isTraceToolOpen ? "Hide trace path tool" : "Open trace path tool"
          }
          title={
            isTraceToolOpen ? "Hide trace path tool" : "Open trace path tool"
          }
        >
          {isTraceToolOpen ? "Hide Trace" : "Trace Path"}
        </button>
        {canEnhanceTopLevelGraph ? (
          <button
            type="button"
            className={`app-shell-action-btn app-shell-action-btn-secondary ${isGraphEnrichmentEnabled ? "is-active" : ""}`}
            onClick={() => {
              if (isGraphEnrichmentEnabled || isGraphEnrichmentLoading) {
                return;
              }
              setIsGraphEnrichmentEnabled(true);
            }}
            disabled={isGraphEnrichmentEnabled || isGraphEnrichmentLoading}
            aria-label={
              isGraphEnrichmentLoading
                ? "Enhancing graph with top holder network"
                : isGraphEnrichmentEnabled
                  ? "Graph enrichment enabled"
                  : "Enhance graph with top holder network"
            }
            title={
              isGraphEnrichmentLoading
                ? "Enhancing graph with top holder network"
                : isGraphEnrichmentEnabled
                  ? "Graph enrichment enabled"
                  : "Load top holder network enrichment"
            }
          >
            {isGraphEnrichmentLoading
              ? "Enhancing..."
              : isGraphEnrichmentEnabled
                ? "Enhanced"
                : "Enhance Graph"}
          </button>
        ) : null}
        <button
          type="button"
          ref={compareButtonRef}
          className={`app-shell-action-btn ${activeTutorialTarget === "compare" ? "tutorial-highlight" : ""}`}
          onClick={() => setIsCompareModeOpen((open) => !open)}
          aria-label="Open compare mode"
          title="Compare this token snapshot with another token"
        >
          Compare
        </button>
        <button
          type="button"
          ref={exportPresetsButtonRef}
          className="app-shell-action-btn"
          onClick={() => setIsExportPresetsOpen((open) => !open)}
          aria-label="Open export presets"
          title="Export common reporting presets"
        >
          Exports
        </button>
        <button
          type="button"
          ref={diagnosticsButtonRef}
          className={`app-shell-action-btn ${activeTutorialTarget === "diagnostics" ? "tutorial-highlight" : ""}`}
          onClick={() => setIsDiagnosticsOpen((open) => !open)}
          aria-label="Open diagnostics panel"
          title="Show source and sync diagnostics details"
        >
          Diagnostics
        </button>
      </div>
    </div>
  );
}

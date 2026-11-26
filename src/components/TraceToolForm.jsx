import { TRACE_PATH_COLOR_PALETTE } from "../config/appConfig";

export default function TraceToolForm({
  activeTraceStatus,
  buildTraceOptionLabel,
  effectiveStatsCollapsed,
  handleShowAllTraceDbPaths,
  handleShowTraceDbPath,
  handleTraceToolSubmit,
  isMobileViewport,
  isTraceDbPathsLoading,
  isTracePaletteDocked,
  isTraceSearchReady,
  primaryTraceDbPathNodePath,
  selectedTraceDbPathKey,
  setIsTraceToolOpen,
  setSelectedTraceDbPathKey,
  setTraceFromNodeId,
  setTraceFromQuery,
  setTraceStopMode,
  setTraceToNodeId,
  setTraceToQuery,
  traceComputation,
  traceDbPathHighlights,
  traceDbPaths,
  traceFromNodeId,
  traceFromOptions,
  traceFromQuery,
  traceListedDbPaths,
  traceStopMode,
  traceToNodeId,
  traceToolPanelRef,
  traceToOptions,
  traceToQuery,
}) {
  return (
    <form
      ref={traceToolPanelRef}
      id="map-trace-tool"
      className="map-trace-tool"
      role="group"
      aria-label="Trace path tool"
      onSubmit={handleTraceToolSubmit}
      style={{
        left: isTracePaletteDocked ? "12px" : undefined,
        right: isTracePaletteDocked
          ? "12px"
          : effectiveStatsCollapsed
            ? "80px"
            : "304px",
        top: isTracePaletteDocked ? "108px" : "268px",
        width: isTracePaletteDocked ? "auto" : undefined,
        maxWidth: isTracePaletteDocked ? "none" : undefined,
        maxHeight: isTracePaletteDocked
          ? "calc(100vh - 132px)"
          : undefined,
      }}
    >
      <div className="map-trace-tool-header">
        <div className="map-trace-tool-header-title">
          <strong>Trace path tool</strong>
        </div>
        <div className="map-trace-tool-header-actions">
          <button
            type="button"
            className="map-trace-submit map-trace-path-action"
            onClick={() => setIsTraceToolOpen(false)}
          >
            Hide
          </button>
        </div>
      </div>
      <div className="map-trace-tool-body">
        <label>
          <span>From wallet</span>
          <input
            type="text"
            className="map-trace-search"
            value={traceFromQuery}
            onChange={(event) => {
              setTraceFromQuery(event.target.value);
              setSelectedTraceDbPathKey("");
              setTraceFromNodeId("");
            }}
            placeholder="Search current map or paste full address"
            aria-label="Search source wallet"
          />
          <select
            className="map-trace-select"
            size={isMobileViewport ? 4 : 6}
            value={traceFromNodeId}
            onChange={(event) => {
              setSelectedTraceDbPathKey("");
              setTraceFromNodeId(event.target.value);
            }}
            aria-label="Select source wallet"
          >
            <option value="">Select</option>
            {traceFromOptions.length ? (
              traceFromOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {buildTraceOptionLabel(node)}
                </option>
              ))
            ) : (
              <option value="" disabled>
                Wallet not found in the current map
              </option>
            )}
          </select>
        </label>
        <label>
          <span>Path stop mode</span>
          <select
            className="map-trace-select map-trace-mode-select"
            value={traceStopMode}
            onChange={(event) => {
              setSelectedTraceDbPathKey("");
              setTraceStopMode(event.target.value);
            }}
            aria-label="Trace path stop mode"
          >
            <option value="terminal">
              Stop at hub/high inbound/high outbound
            </option>
            <option value="through">
              Allow passing through terminals
            </option>
          </select>
          <div className="map-trace-option-note">
            Optional: choose whether paths terminate at labeled
            hubs/high-flow wallets.
          </div>
        </label>
        <label>
          <span>To wallet</span>
          <input
            type="text"
            className="map-trace-search"
            value={traceToQuery}
            onChange={(event) => {
              setTraceToQuery(event.target.value);
              setSelectedTraceDbPathKey("");
              setTraceToNodeId("");
            }}
            placeholder="Search current map or paste full address"
            aria-label="Search destination wallet"
          />
          <select
            className="map-trace-select"
            size={isMobileViewport ? 4 : 6}
            value={traceToNodeId}
            onChange={(event) => {
              setSelectedTraceDbPathKey("");
              setTraceToNodeId(event.target.value);
            }}
            aria-label="Select destination wallet"
          >
            <option value="">Select</option>
            {traceToOptions.length ? (
              traceToOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {buildTraceOptionLabel(node)}
                </option>
              ))
            ) : (
              <option value="" disabled>
                Wallet not found in the current map
              </option>
            )}
          </select>
        </label>
        <div className="map-trace-actions">
          {traceDbPathHighlights.length > 1 ? (
            <button
              type="button"
              className="map-trace-submit map-trace-path-action"
              onClick={handleShowAllTraceDbPaths}
              disabled={!selectedTraceDbPathKey}
            >
              Show All Paths
            </button>
          ) : null}
          <button
            type="submit"
            className="map-trace-submit"
            disabled={!isTraceSearchReady || isTraceDbPathsLoading}
          >
            {isTraceDbPathsLoading ? "Searching..." : "Search Paths"}
          </button>
          {traceDbPaths.length ? (
            <button
              type="button"
              className="map-trace-submit map-trace-path-action"
              onClick={() =>
                handleShowTraceDbPath(primaryTraceDbPathNodePath)
              }
            >
              {selectedTraceDbPathKey ? "Showing Path" : "Show Path"}
            </button>
          ) : null}
        </div>
        <div className="map-trace-status" aria-live="polite">
          {Number.isFinite(traceComputation.relevanceScore) ? (
            <span className="map-trace-score-badge">
              Relevance {traceComputation.relevanceScore}/100
            </span>
          ) : null}
          {isTraceDbPathsLoading ? (
            <span className="map-trace-score-badge">
              Searching DB paths...
            </span>
          ) : null}
          {activeTraceStatus}
        </div>
        {traceListedDbPaths.length ? (
          <>
            <div
              className="map-trace-path-list"
              aria-label="Database trace paths"
            >
              {traceListedDbPaths.map((item, index) => {
                const nodePath = Array.isArray(item?.nodePath)
                  ? item.nodePath
                  : [];
                const pathKey = nodePath.join("->");
                const pathColor =
                  TRACE_PATH_COLOR_PALETTE[
                    index % TRACE_PATH_COLOR_PALETTE.length
                  ];
                return (
                  <div
                    key={`${pathKey}-${index}`}
                    className="map-trace-path-item"
                    style={{ borderLeft: `3px solid ${pathColor}` }}
                  >
                    <strong>
                      <button
                        type="button"
                        className="map-trace-path-swatch-button"
                        onClick={() =>
                          handleShowTraceDbPath(nodePath)
                        }
                        aria-label={`Highlight path ${index + 1}`}
                        title={`Highlight path ${index + 1}`}
                      >
                        <span
                          className="map-trace-path-swatch"
                          style={{ backgroundColor: pathColor }}
                          aria-hidden="true"
                        />
                      </button>
                      Path {index + 1} · {Number(item?.hopCount) || 0}{" "}
                      hop(s)
                    </strong>
                    <span>{nodePath.join(" → ")}</span>
                    <button
                      type="button"
                      className="map-trace-submit map-trace-path-action"
                      onClick={() => handleShowTraceDbPath(nodePath)}
                    >
                      {selectedTraceDbPathKey === pathKey
                        ? "Showing Path"
                        : "Show Path"}
                    </button>
                  </div>
                );
              })}
            </div>
            {traceDbPaths.length > traceListedDbPaths.length ? (
              <div className="map-trace-option-note">
                Showing {traceListedDbPaths.length.toLocaleString()}{" "}
                of {traceDbPaths.length.toLocaleString()} paths.
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </form>
  );
}

import { TRACE_PATH_COLOR_PALETTE } from "../config/appConfig";

export default function TraceLegend({
  handleShowAllTraceDbPaths,
  handleShowTraceDbPath,
  handleTraceLegendPointerDown,
  isTraceLegendMinimized,
  isTracePaletteDocked,
  selectedTraceDbPathKey,
  setIsTraceLegendMinimized,
  traceDbPaths,
  traceLegendPanelRef,
  traceLegendPosition,
  traceRenderableDbPaths,
}) {
  return (
    <div
      ref={traceLegendPanelRef}
      className={`map-trace-legend ${isTraceLegendMinimized ? "is-minimized" : ""}`}
      aria-label="Trace path legend"
      style={{
        left: isTracePaletteDocked
          ? "12px"
          : `${traceLegendPosition.left}px`,
        right: isTracePaletteDocked ? "12px" : undefined,
        top: isTracePaletteDocked
          ? "108px"
          : `${traceLegendPosition.top}px`,
        width: isTracePaletteDocked ? "auto" : undefined,
        maxWidth: isTracePaletteDocked ? "none" : undefined,
      }}
    >
      <div
        className="map-trace-legend-header"
        onPointerDown={handleTraceLegendPointerDown}
      >
        <strong>
          Trace paths ({traceRenderableDbPaths.length}
          {traceDbPaths.length > traceRenderableDbPaths.length
            ? ` of ${traceDbPaths.length}`
            : ""}
          )
        </strong>
        <div className="map-trace-legend-header-actions">
          <button
            type="button"
            className="map-trace-toggle"
            onClick={() =>
              setIsTraceLegendMinimized((collapsed) => !collapsed)
            }
            aria-label={
              isTraceLegendMinimized
                ? "Expand trace paths palette"
                : "Minimize trace paths palette"
            }
            title={
              isTraceLegendMinimized
                ? "Expand palette"
                : "Minimize palette"
            }
          >
            {isTraceLegendMinimized ? "+" : "–"}
          </button>
          {traceRenderableDbPaths.length > 1 ? (
            <button
              type="button"
              className="map-trace-submit map-trace-path-action"
              onClick={handleShowAllTraceDbPaths}
              disabled={!selectedTraceDbPathKey}
            >
              Show All
            </button>
          ) : null}
        </div>
      </div>
      {!isTraceLegendMinimized ? (
        <div className="map-trace-legend-list">
          {traceRenderableDbPaths.slice(0, 8).map((item, index) => {
            const nodePath = Array.isArray(item?.nodePath)
              ? item.nodePath
              : [];
            const pathKey = nodePath.join("->");
            const pathColor =
              TRACE_PATH_COLOR_PALETTE[
                index % TRACE_PATH_COLOR_PALETTE.length
              ];
            return (
              <button
                key={`legend-${pathKey}-${index}`}
                type="button"
                className="map-trace-legend-item"
                onClick={() => handleShowTraceDbPath(nodePath)}
              >
                <span
                  className="map-trace-path-swatch"
                  style={{ backgroundColor: pathColor }}
                  aria-hidden="true"
                />
                <span>
                  Path {index + 1} · {Number(item?.hopCount) || 0}{" "}
                  hop(s)
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

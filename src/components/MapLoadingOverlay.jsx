export default function MapLoadingOverlay({
  clampedMapLoadingProgress,
  isMapLoaderExiting,
  loadingThemeStyle,
  mapLoadingAriaStatus,
  mapLoadingEvidenceDetail,
  mapLoadingStageDetail,
}) {
  return (
    <div
      className={`map-loading-overlay ${isMapLoaderExiting ? "is-exiting" : ""}`}
      style={loadingThemeStyle}
      aria-live="off"
    >
      <div className="visually-hidden" role="status" aria-atomic="true">
        {mapLoadingAriaStatus}
      </div>
      <div className="map-loading-center">
        <svg
          className="map-loading-ring"
          viewBox="0 0 56 56"
          aria-hidden="true"
        >
          <circle
            className="map-loading-ring-track"
            cx="28"
            cy="28"
            r="23"
            fill="none"
            strokeWidth="2"
          />
          <circle
            className="map-loading-ring-fill"
            cx="28"
            cy="28"
            r="23"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              strokeDashoffset: `${144.51 - (144.51 * clampedMapLoadingProgress) / 100}`,
            }}
          />
          <circle
            className="map-loading-ring-sweep"
            cx="28"
            cy="28"
            r="23"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text
            className="map-loading-ring-pct"
            x="28"
            y="28"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {clampedMapLoadingProgress}%
          </text>
        </svg>
        <div key={mapLoadingStageDetail} className="map-loading-stage">
          {mapLoadingStageDetail}
        </div>
        <div className="map-loading-evidence" aria-live="off">
          {mapLoadingEvidenceDetail}
        </div>
      </div>
    </div>
  );
}

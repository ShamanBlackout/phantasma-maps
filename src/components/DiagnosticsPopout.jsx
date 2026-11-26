export default function DiagnosticsPopout({
  diagnosticsDetails,
  diagnosticsPopoutRef,
  setIsDiagnosticsOpen,
}) {
  return (
    <div
      ref={diagnosticsPopoutRef}
      className="app-shell-popout app-shell-diagnostics-popout"
      role="dialog"
      aria-modal="false"
      aria-labelledby="diagnostics-heading"
    >
      <div className="app-shell-popout-head">
        <strong id="diagnostics-heading">Data Diagnostics</strong>
        <button
          type="button"
          aria-label="Close diagnostics"
          onClick={() => setIsDiagnosticsOpen(false)}
        >
          Close
        </button>
      </div>
      <div className="app-shell-diagnostics-list">
        <p>API health: {diagnosticsDetails.apiHealth}</p>
        <p>Source: {diagnosticsDetails.source}</p>
        <p>
          Sync lag:{" "}
          {Number.isFinite(diagnosticsDetails.syncLag)
            ? `${diagnosticsDetails.syncLag} blocks`
            : "Waiting"}
        </p>
        <p>Map status: {diagnosticsDetails.mapStatus}</p>
        <p>
          Last API error source: {diagnosticsDetails.lastApiErrorSource}
        </p>
        <p>Last API error code: {diagnosticsDetails.lastApiErrorCode}</p>
        <p>
          Last API error status: {diagnosticsDetails.lastApiErrorStatus}
        </p>
        <p>
          Last API requestId: {diagnosticsDetails.lastApiErrorRequestId}
        </p>
        <p>
          Last API error message: {diagnosticsDetails.lastApiErrorMessage}
        </p>
        <p>Last API error at: {diagnosticsDetails.lastApiErrorAt}</p>
        <p>Indexer update: {diagnosticsDetails.indexerUpdated}</p>
        <p>Market update: {diagnosticsDetails.marketUpdated}</p>
      </div>
    </div>
  );
}

export default function ExportPresetsPopout({
  exportFilteredTransactionsPreset,
  exportPresetsPopoutRef,
  exportTopHoldersPreset,
  exportVisibleGraphPreset,
  setIsExportPresetsOpen,
}) {
  return (
    <div
      ref={exportPresetsPopoutRef}
      className="app-shell-popout app-shell-export-popout"
      role="dialog"
      aria-modal="false"
      aria-labelledby="export-presets-heading"
    >
      <div className="app-shell-popout-head">
        <strong id="export-presets-heading">Export Presets</strong>
        <button
          type="button"
          aria-label="Close export presets"
          onClick={() => setIsExportPresetsOpen(false)}
        >
          Close
        </button>
      </div>
      <div className="app-shell-export-actions">
        <button type="button" onClick={exportVisibleGraphPreset}>
          Visible Graph JSON
        </button>
        <button type="button" onClick={exportTopHoldersPreset}>
          Top Holders CSV
        </button>
        <button type="button" onClick={exportFilteredTransactionsPreset}>
          Filtered Transactions CSV
        </button>
      </div>
    </div>
  );
}

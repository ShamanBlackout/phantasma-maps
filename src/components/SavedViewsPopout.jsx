export default function SavedViewsPopout({
  applySavedView,
  removeSavedView,
  saveCurrentView,
  savedViewName,
  savedViews,
  savedViewsPopoutRef,
  setIsSavedViewsOpen,
  setSavedViewName,
}) {
  return (
    <div
      ref={savedViewsPopoutRef}
      className="app-shell-popout app-shell-views-popout"
      role="dialog"
      aria-modal="false"
      aria-labelledby="saved-views-heading"
    >
      <div className="app-shell-popout-head">
        <strong id="saved-views-heading">Saved Views</strong>
        <button
          type="button"
          aria-label="Close saved views"
          onClick={() => setIsSavedViewsOpen(false)}
        >
          Close
        </button>
      </div>
      <div className="app-shell-views-create-row">
        <input
          type="text"
          value={savedViewName}
          onChange={(event) => setSavedViewName(event.target.value)}
          placeholder="Name this view"
        />
        <button type="button" onClick={saveCurrentView}>
          Save
        </button>
      </div>
      <div className="app-shell-views-list">
        {savedViews.length ? (
          savedViews.map((view) => (
            <div key={view.id} className="app-shell-view-row">
              <button type="button" onClick={() => applySavedView(view)}>
                {view.name}
              </button>
              <button
                type="button"
                onClick={() => removeSavedView(view.id)}
                className="app-shell-view-delete"
                aria-label="Delete saved view"
              >
                ✕
              </button>
            </div>
          ))
        ) : (
          <div className="app-shell-empty-copy">No saved views yet.</div>
        )}
      </div>
    </div>
  );
}

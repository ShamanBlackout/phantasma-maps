export default function CommandPalette({
  commandPaletteHeadingLabel,
  commandPaletteQuery,
  filteredCommandPaletteActions,
  isMobileViewport,
  setCommandPaletteQuery,
  setIsCommandPaletteOpen,
}) {
  return (
    <div
      className="command-palette-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-heading"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div
        className="command-palette"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="command-palette-heading" className="visually-hidden">
          {commandPaletteHeadingLabel}
        </h3>
        <input
          type="text"
          value={commandPaletteQuery}
          onChange={(event) => setCommandPaletteQuery(event.target.value)}
          placeholder={
            isMobileViewport ? "Search actions" : "Type a command"
          }
          aria-label={
            isMobileViewport ? "Search actions" : "Search commands"
          }
          autoFocus
        />
        <div className="command-palette-list">
          {filteredCommandPaletteActions.map((action) => (
            <button
              key={action.id}
              type="button"
              title={
                !isMobileViewport && action.shortcut
                  ? `Shortcut: ${action.shortcut}`
                  : undefined
              }
              onClick={() => {
                action.run();
                setIsCommandPaletteOpen(false);
                setCommandPaletteQuery("");
              }}
            >
              <span>{action.label}</span>
              {!isMobileViewport && action.shortcut ? (
                <span
                  className="command-palette-shortcut"
                  aria-hidden="true"
                >
                  {action.shortcut}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

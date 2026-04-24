import React, { useEffect, useRef, useState } from "react";

export default function Header({
  onSearch,
  searchInputValue,
  tokenInfo,
  blockSyncHeight,
  blockSyncTargetHeight,
  colorTheme,
  onThemeChange,
  graphEdgeLimit,
  graphNodeLimit,
  defaultGraphEdgeLimit,
  defaultGraphNodeLimit,
  onGraphSettingsApply,
  isGraphMaxModeEnabled,
  isConnectionsView,
  availableNodeCount,
  availableEdgeCount,
  renderedNodeCount,
  renderedEdgeCount,
  densityMode,
  onDensityModeChange,
  isFocusMode,
  onFocusModeChange,
  physicsMode,
  onPhysicsModeChange,
  labelDensityMode,
  onLabelDensityModeChange,
  onReplayTutorial,
  tutorialHighlightTarget,
}) {
  const themeOptions = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "ghost-blue", label: "Ghost Blue" },
    { value: "kcal-red", label: "Kcal Red" },
  ];
  const [input, setInput] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftEdgeLimit, setDraftEdgeLimit] = useState(String(graphEdgeLimit));
  const [draftNodeLimit, setDraftNodeLimit] = useState(String(graphNodeLimit));
  const settingsRef = useRef(null);
  const settingsTriggerRef = useRef(null);
  const [settingsPopoverStyle, setSettingsPopoverStyle] = useState({});
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(true);

  useEffect(() => {
    if (!isSettingsOpen) return;
    setDraftEdgeLimit(String(graphEdgeLimit));
    setDraftNodeLimit(String(graphNodeLimit));
  }, [graphEdgeLimit, graphNodeLimit, isSettingsOpen]);

  useEffect(() => {
    const normalizedSearchValue = String(searchInputValue || "");
    setInput(normalizedSearchValue);
  }, [searchInputValue]);

  useEffect(() => {
    if (!isSettingsOpen) return undefined;

    function updateSettingsPopoverPosition() {
      const triggerRect = settingsTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isMobileViewport = viewportWidth <= 768;

      if (isMobileViewport) {
        const mobileInset = 10;
        const maxHeight = Math.max(220, viewportHeight - mobileInset * 2);

        setSettingsPopoverStyle({
          left: `${mobileInset}px`,
          top: `${mobileInset}px`,
          width: `${Math.max(240, viewportWidth - mobileInset * 2)}px`,
          maxHeight: `${maxHeight}px`,
        });
        return;
      }

      const sideInset = 12;
      const topInset = 8;
      const bottomInset = 12;
      const desiredWidth = Math.min(320, viewportWidth - sideInset * 2);
      const left = Math.min(
        Math.max(sideInset, triggerRect.right - desiredWidth),
        Math.max(sideInset, viewportWidth - desiredWidth - sideInset),
      );
      const maxHeight = Math.min(
        560,
        Math.max(220, viewportHeight - topInset - bottomInset),
      );
      const topPreferred = triggerRect.bottom + 10;
      const top = Math.min(
        Math.max(topInset, topPreferred),
        Math.max(topInset, viewportHeight - maxHeight - bottomInset),
      );

      setSettingsPopoverStyle({
        left: `${left}px`,
        top: `${top}px`,
        width: `${desiredWidth}px`,
        maxHeight: `${maxHeight}px`,
      });
    }

    function handlePointerDown(event) {
      if (settingsRef.current?.contains(event.target)) return;
      setIsSettingsOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    }

    updateSettingsPopoverPosition();

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateSettingsPopoverPosition);
    window.addEventListener("scroll", updateSettingsPopoverPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateSettingsPopoverPosition);
      window.removeEventListener("scroll", updateSettingsPopoverPosition, true);
    };
  }, [isSettingsOpen]);

  function parsePositiveInteger(value, fallbackValue) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : fallbackValue;
  }

  function sanitizeNonNegativeIntegerInput(value) {
    return String(value ?? "").replace(/[^0-9]/g, "");
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSearch(input.trim());
  }

  function handleClear() {
    setInput("");
    onSearch("");
  }

  function handleSettingsSubmit(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onGraphSettingsApply?.({
      useMaxMode: false,
      edgeLimit: parsePositiveInteger(draftEdgeLimit, defaultGraphEdgeLimit),
      nodeLimit: parsePositiveInteger(draftNodeLimit, defaultGraphNodeLimit),
    });
    setIsSettingsOpen(false);
  }

  function handleSettingsReset() {
    setDraftEdgeLimit(String(defaultGraphEdgeLimit));
    setDraftNodeLimit(String(defaultGraphNodeLimit));
    onGraphSettingsApply?.({
      useMaxMode: false,
      edgeLimit: defaultGraphEdgeLimit,
      nodeLimit: defaultGraphNodeLimit,
    });
    setIsSettingsOpen(false);
  }

  function handleSettingsUseMax() {
    onGraphSettingsApply?.({ useMaxMode: true });
    setIsSettingsOpen(false);
  }

  const priceChange24h = Number(tokenInfo.priceChange24h) || 0;
  const hasPrice = Number.isFinite(tokenInfo.price);
  const priceUp = priceChange24h >= 0;
  const tokenDisplayName = String(tokenInfo.name || "Token").trim() || "Token";
  const hasBlockSyncHeight = Number.isFinite(blockSyncHeight);
  const hasBlockSyncTargetHeight = Number.isFinite(blockSyncTargetHeight);
  const blockSyncLabel = hasBlockSyncHeight
    ? hasBlockSyncTargetHeight
      ? `${Number(blockSyncHeight).toLocaleString()}/${Number(blockSyncTargetHeight).toLocaleString()}`
      : Number(blockSyncHeight).toLocaleString()
    : "Syncing...";
  const edgeDraftValue = Number(draftEdgeLimit);
  const nodeDraftValue = Number(draftNodeLimit);
  const isEdgeWarningVisible = edgeDraftValue > defaultGraphEdgeLimit;
  const isNodeWarningVisible = nodeDraftValue > defaultGraphNodeLimit;
  const normalizedAvailableNodeCount = Number(availableNodeCount || 0);
  const normalizedAvailableEdgeCount = Number(availableEdgeCount || 0);
  const normalizedRenderedNodeCount = Number(renderedNodeCount || 0);
  const normalizedRenderedEdgeCount = Number(renderedEdgeCount || 0);
  const canUseMaxGraph = isConnectionsView
    ? !(
        normalizedRenderedNodeCount < defaultGraphNodeLimit &&
        normalizedRenderedEdgeCount < defaultGraphEdgeLimit
      )
    : normalizedAvailableNodeCount > normalizedRenderedNodeCount ||
      normalizedAvailableEdgeCount > normalizedRenderedEdgeCount;
  const isSettingsFormValid =
    Number.isFinite(edgeDraftValue) &&
    edgeDraftValue > 0 &&
    Number.isFinite(nodeDraftValue) &&
    nodeDraftValue > 0;

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">
          <img
            className="header-logo-icon"
            src={`${process.env.PUBLIC_URL}/phantasmaMaps.png`}
            alt="PhantasmaMaps logo"
          />
          <span className="header-logo-text">
            Phantasma<span className="header-logo-accent">Maps</span>
          </span>
        </div>
        <div className="header-context">
          <span className="header-context-eyebrow">Wallet Graph Explorer</span>
          <span className="header-context-title">
            {tokenDisplayName} distribution map
          </span>
        </div>
      </div>

      <form
        className={`header-search ${tutorialHighlightTarget === "search" ? "tutorial-highlight" : ""}`}
        onSubmit={handleSubmit}
      >
        <span className="header-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="presentation">
            <path
              d="M10.5 4.75a5.75 5.75 0 1 0 0 11.5 5.75 5.75 0 0 0 0-11.5Zm0-1.5a7.25 7.25 0 1 1 4.5 12.94l4.4 4.41-1.06 1.06-4.4-4.4a7.25 7.25 0 0 1-3.44.87 7.25 7.25 0 0 1 0-14.5Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <input
          id="header-search-input"
          className="header-search-input"
          type="text"
          placeholder="Search address or holder name…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {input && (
          <button
            type="button"
            className="header-search-clear"
            onClick={handleClear}
          >
            ✕
          </button>
        )}
        {!input ? (
          <span className="header-search-shortcut" aria-hidden="true">
            /
          </span>
        ) : null}
        <button
          type="submit"
          className="header-search-btn"
          aria-label="Submit search"
        >
          <span className="header-search-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation">
              <path
                d="M10.5 4.75a5.75 5.75 0 1 0 0 11.5 5.75 5.75 0 0 0 0-11.5Zm0-1.5a7.25 7.25 0 1 1 4.5 12.94l4.4 4.41-1.06 1.06-4.4-4.4a7.25 7.25 0 0 1-3.44.87 7.25 7.25 0 0 1 0-14.5Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="header-search-btn-label">Search</span>
        </button>
      </form>

      <div className="header-settings" ref={settingsRef}>
        {isGraphMaxModeEnabled ? (
          <span
            className="header-settings-badge"
            title="Rendering the full selected token graph"
          >
            Max Active
          </span>
        ) : null}
        <button
          type="button"
          ref={settingsTriggerRef}
          className={`header-settings-trigger ${isSettingsOpen ? "is-active" : ""} ${tutorialHighlightTarget === "settings" ? "tutorial-highlight" : ""}`}
          onClick={() => setIsSettingsOpen((current) => !current)}
          aria-label="Open graph settings"
          aria-expanded={isSettingsOpen}
          title="Graph settings"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.08 7.08 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
              fill="currentColor"
            />
          </svg>
        </button>
        {isSettingsOpen ? (
          <form
            className="header-settings-popout"
            onSubmit={handleSettingsSubmit}
            style={settingsPopoverStyle}
          >
            <div className="header-settings-popout-head">
              <div>
                <strong>Display &amp; Map Settings</strong>
                <span>Manage view controls and graph rendering density.</span>
              </div>
            </div>
            <div className="header-settings-section">
              <strong className="header-settings-section-title">Display</strong>
              <div className="header-settings-display-grid">
                <label
                  className="header-theme"
                  title="Change overall accent color"
                >
                  <span className="header-theme-label">Theme</span>
                  <select
                    className="header-theme-select"
                    value={colorTheme}
                    onChange={(e) =>
                      onThemeChange && onThemeChange(e.target.value)
                    }
                  >
                    {themeOptions.map((themeOption) => (
                      <option key={themeOption.value} value={themeOption.value}>
                        {themeOption.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="header-theme" title="Change spacing density">
                  <span className="header-theme-label">Density</span>
                  <select
                    className="header-theme-select"
                    value={densityMode || "comfortable"}
                    onChange={(e) => onDensityModeChange?.(e.target.value)}
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </label>
                <label
                  className="header-theme"
                  title="Reduce visual noise by collapsing secondary UI"
                >
                  <span className="header-theme-label">Focus Mode</span>
                  <button
                    type="button"
                    className={`header-focus-toggle ${isFocusMode ? "is-active" : ""}`}
                    onClick={() => onFocusModeChange?.(!isFocusMode)}
                    aria-pressed={isFocusMode}
                    title="Collapse secondary UI for distraction-free graph analysis"
                  >
                    {isFocusMode ? "Enabled" : "Disabled"}
                  </button>
                </label>
                <label
                  className="header-theme"
                  title="Tune graph simulation performance"
                >
                  <span className="header-theme-label">Physics</span>
                  <select
                    className="header-theme-select"
                    value={physicsMode || "balanced"}
                    onChange={(e) => onPhysicsModeChange?.(e.target.value)}
                    aria-label="Physics"
                  >
                    <option value="fast">Fast</option>
                    <option value="balanced">Balanced</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </label>
                <label
                  className="header-theme"
                  title="Control how many node labels render on the graph"
                >
                  <span className="header-theme-label">Labels</span>
                  <select
                    className="header-theme-select"
                    value={labelDensityMode || "balanced"}
                    onChange={(e) => onLabelDensityModeChange?.(e.target.value)}
                    aria-label="Labels"
                  >
                    <option value="minimal">Minimal</option>
                    <option value="balanced">Balanced</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="header-settings-section header-settings-help-section">
              <strong className="header-settings-section-title">
                Guided Tour
              </strong>
              <span className="header-settings-help-copy">
                Replay the interactive walkthrough of features and controls.
              </span>
              <button
                type="button"
                className={`header-settings-help-button ${tutorialHighlightTarget === "settings" ? "tutorial-highlight" : ""}`}
                onClick={() => {
                  onReplayTutorial?.();
                  setIsSettingsOpen(false);
                }}
              >
                Replay Tutorial
              </button>
            </div>
            <div className="header-settings-stats" aria-live="polite">
              <div className="header-settings-stat">
                <span>Rendering nodes</span>
                <strong>
                  {Number(renderedNodeCount || 0).toLocaleString()}
                </strong>
              </div>
              <div className="header-settings-stat">
                <span>Rendering edges</span>
                <strong>
                  {Number(renderedEdgeCount || 0).toLocaleString()}
                </strong>
              </div>
            </div>
            <div className="header-settings-advanced-toggle-wrap">
              <button
                type="button"
                className={`header-settings-advanced-toggle ${isAdvancedSettingsOpen ? "is-open" : ""}`}
                onClick={() => setIsAdvancedSettingsOpen((current) => !current)}
                aria-expanded={isAdvancedSettingsOpen}
                title="Show or hide graph-density and max-mode controls"
              >
                {isAdvancedSettingsOpen
                  ? "Hide Advanced Graph Controls"
                  : "Show Advanced Graph Controls"}
              </button>
            </div>
            {isAdvancedSettingsOpen ? (
              <>
                <div className="header-settings-max-mode">
                  <div className="header-settings-max-copy">
                    <strong>Max graph</strong>
                    <span>
                      {isConnectionsView
                        ? `Current graph max: ${Number(availableNodeCount || 0).toLocaleString()} wallets and ${Number(availableEdgeCount || 0).toLocaleString()} connections.`
                        : `Overall max: ${Number(availableNodeCount || 0).toLocaleString()} wallets and ${Number(availableEdgeCount || 0).toLocaleString()} connections.`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSettingsUseMax}
                    disabled={isGraphMaxModeEnabled || !canUseMaxGraph}
                  >
                    {isGraphMaxModeEnabled ? "Max Enabled" : "Use Max"}
                  </button>
                </div>
                <label className="header-settings-field">
                  <span>Visible connections</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draftEdgeLimit}
                    onChange={(event) =>
                      setDraftEdgeLimit(
                        sanitizeNonNegativeIntegerInput(event.target.value),
                      )
                    }
                  />
                  <small>
                    Default: {defaultGraphEdgeLimit.toLocaleString()}
                  </small>
                  {isEdgeWarningVisible ? (
                    <p className="header-settings-warning">
                      Anything over the default may cause performance issues.
                    </p>
                  ) : null}
                </label>
                <label className="header-settings-field">
                  <span>Visible wallets</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draftNodeLimit}
                    onChange={(event) =>
                      setDraftNodeLimit(
                        sanitizeNonNegativeIntegerInput(event.target.value),
                      )
                    }
                  />
                  <small>
                    Default: {defaultGraphNodeLimit.toLocaleString()}
                  </small>
                  {isNodeWarningVisible ? (
                    <p className="header-settings-warning">
                      Anything over the default may cause performance issues.
                    </p>
                  ) : null}
                </label>
                <div className="header-settings-actions">
                  <button type="button" onClick={handleSettingsReset}>
                    Reset Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleSettingsSubmit}
                    disabled={!isSettingsFormValid}
                  >
                    Apply
                  </button>
                </div>
              </>
            ) : null}
          </form>
        ) : null}
      </div>

      <div className="header-meta">
        <div
          className="header-sync"
          title="API health, chain status, and market price"
        >
          <div className="header-status-metrics">
            <span
              className="header-status-chip header-status-chip-chain"
              title="Active chain network currently indexed by the app"
            >
              <span className="header-chain-dot" />
              <span className="header-status-chip-label">Chain</span>
              <strong className="header-status-chip-value">
                Phantasma Gen3
              </strong>
            </span>
            <span
              className="header-status-chip header-status-chip-block"
              title="Indexer block progress compared with latest observed chain head"
            >
              <span className="header-status-chip-label">Block Sync</span>
              <strong className="header-status-chip-value">
                {blockSyncLabel}
              </strong>
            </span>
            <span
              className="header-status-chip header-status-chip-market"
              title="Latest token market quote and 24h movement"
            >
              <span className="header-status-chip-label">
                {tokenDisplayName}
              </span>
              <strong className="header-status-chip-value">
                {hasPrice ? `$${tokenInfo.price.toFixed(5)}` : "N/A"}
              </strong>
              {hasPrice ? (
                <span
                  className={`header-price-change ${priceUp ? "up" : "down"}`}
                >
                  {priceUp ? "▲" : "▼"} {Math.abs(priceChange24h).toFixed(2)}%
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

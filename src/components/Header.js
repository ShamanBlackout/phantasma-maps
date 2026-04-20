import React, { useEffect, useRef, useState } from "react";

export default function Header({
  onSearch,
  tokenInfo,
  priceUpdatedAt,
  blockSyncHeight,
  blockSyncTargetHeight,
  blockSyncUpdatedAt,
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

  useEffect(() => {
    if (!isSettingsOpen) return;
    setDraftEdgeLimit(String(graphEdgeLimit));
    setDraftNodeLimit(String(graphNodeLimit));
  }, [graphEdgeLimit, graphNodeLimit, isSettingsOpen]);

  useEffect(() => {
    if (!isSettingsOpen) return undefined;

    function updateSettingsPopoverPosition() {
      const triggerRect = settingsTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const desiredWidth = Math.min(320, viewportWidth - 24);
      const left = Math.min(
        Math.max(12, triggerRect.right - desiredWidth),
        Math.max(12, viewportWidth - desiredWidth - 12),
      );
      const top = Math.min(triggerRect.bottom + 10, viewportHeight - 24);
      const maxHeight = Math.max(220, viewportHeight - top - 12);

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

  function formatUtcTime(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return "Waiting for API";
    return `${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
    })} UTC`;
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
  const priceUpdatedLabel = priceUpdatedAt
    ? formatUtcTime(priceUpdatedAt)
    : hasPrice
      ? "Syncing..."
      : "No market feed";
  const hasBlockSyncHeight = Number.isFinite(blockSyncHeight);
  const hasBlockSyncTargetHeight = Number.isFinite(blockSyncTargetHeight);
  const blockSyncLabel = hasBlockSyncHeight
    ? hasBlockSyncTargetHeight
      ? `${Number(blockSyncHeight).toLocaleString()}/${Number(blockSyncTargetHeight).toLocaleString()}`
      : Number(blockSyncHeight).toLocaleString()
    : "Syncing...";
  const blockSyncUpdatedLabel = blockSyncUpdatedAt
    ? formatUtcTime(blockSyncUpdatedAt)
    : "Waiting for API";
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

      <form className="header-search" onSubmit={handleSubmit}>
        <span className="header-search-icon">⌕</span>
        <input
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
        <button type="submit" className="header-search-btn">
          Search
        </button>
      </form>

      <div className="header-meta">
        <div
          className="header-sync"
          title="Backend sync progress versus the live chain height"
        >
          <span className="header-sync-heading">
            <span className="header-sync-label">Block Sync</span>
            <span className="header-sync-subtext">Gen3</span>
          </span>
          <span className="header-sync-value">{blockSyncLabel}</span>
          <span className="header-sync-updated">
            Updated {blockSyncUpdatedLabel}
          </span>
        </div>
        <label className="header-theme" title="Change overall accent color">
          <span className="header-theme-label">Theme</span>
          <select
            className="header-theme-select"
            value={colorTheme}
            onChange={(e) => onThemeChange && onThemeChange(e.target.value)}
          >
            {themeOptions.map((themeOption) => (
              <option key={themeOption.value} value={themeOption.value}>
                {themeOption.label}
              </option>
            ))}
          </select>
        </label>
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
            className={`header-settings-trigger ${isSettingsOpen ? "is-active" : ""}`}
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
                  <strong>Map Settings</strong>
                  <span>Adjust graph density before rendering.</span>
                </div>
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
                <small>Default: {defaultGraphEdgeLimit.toLocaleString()}</small>
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
                <small>Default: {defaultGraphNodeLimit.toLocaleString()}</small>
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
            </form>
          ) : null}
        </div>
        <div className="header-chain">
          <span className="header-chain-dot" />
          <span>Phantasma</span>
        </div>
        <div className="header-price">
          <span className="header-price-symbol">{tokenInfo.name}</span>
          <span className="header-price-value">
            {hasPrice ? `$${tokenInfo.price.toFixed(5)}` : "N/A"}
          </span>
          {hasPrice ? (
            <span className={`header-price-change ${priceUp ? "up" : "down"}`}>
              {priceUp ? "▲" : "▼"} {Math.abs(priceChange24h).toFixed(2)}%
            </span>
          ) : null}
          <span className="header-price-updated">
            Updated {priceUpdatedLabel}
          </span>
        </div>
      </div>
    </header>
  );
}

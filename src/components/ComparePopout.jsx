import { getSnapshotWalletCount } from "../graph/tokenSnapshots";

export default function ComparePopout({
  activeTokenInfo,
  availableTokenSymbols,
  comparePopoutRef,
  compareSnapshot,
  compareSnapshotStatus,
  compareTokenSymbol,
  currentSnapshotStatus,
  currentTokenSnapshot,
  selectedTokenSymbol,
  setCompareTokenSymbol,
  setIsCompareModeOpen,
}) {
  return (
    <div
      ref={comparePopoutRef}
      className="app-shell-popout app-shell-compare-popout"
      role="dialog"
      aria-modal="false"
      aria-labelledby="compare-heading"
    >
      <div className="app-shell-popout-head">
        <strong id="compare-heading">Compare Snapshot</strong>
        <button
          type="button"
          aria-label="Close compare snapshot"
          onClick={() => setIsCompareModeOpen(false)}
        >
          Close
        </button>
      </div>
      <label className="app-shell-compare-picker">
        <span>Compare against</span>
        <select
          value={compareTokenSymbol}
          onChange={(event) => setCompareTokenSymbol(event.target.value)}
        >
          <option value="">Select token</option>
          {availableTokenSymbols
            .filter((token) => token !== selectedTokenSymbol)
            .map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
        </select>
      </label>
      <div className="app-shell-compare-grid">
        <div>
          <div className="app-shell-compare-kicker">Current</div>
          <strong>
            {currentTokenSnapshot?.token || selectedTokenSymbol}
          </strong>
          {currentSnapshotStatus ? <p>{currentSnapshotStatus}</p> : null}
          <p>
            Wallets:{" "}
            {Number(
              activeTokenInfo?.globalHolderCount ??
                getSnapshotWalletCount(currentTokenSnapshot),
            ).toLocaleString()}
          </p>
          <p>
            Top 10: {Number(currentTokenSnapshot?.top10 || 0).toFixed(1)}%
          </p>
          <p>
            Top wallet: {currentTokenSnapshot?.topWalletLabel || "N/A"} (
            {Number(currentTokenSnapshot?.topWalletShare || 0).toFixed(2)}%)
          </p>
        </div>
        <div>
          <div className="app-shell-compare-kicker">Selected</div>
          <strong>{compareSnapshot?.token || "N/A"}</strong>
          {compareSnapshotStatus ? <p>{compareSnapshotStatus}</p> : null}
          <p>
            Wallets:{" "}
            {getSnapshotWalletCount(compareSnapshot).toLocaleString()}
          </p>
          <p>Top 10: {Number(compareSnapshot?.top10 || 0).toFixed(1)}%</p>
          <p>
            Top wallet: {compareSnapshot?.topWalletLabel || "N/A"} (
            {Number(compareSnapshot?.topWalletShare || 0).toFixed(2)}%)
          </p>
        </div>
      </div>
    </div>
  );
}

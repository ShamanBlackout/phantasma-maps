import { fmtSharePct, fmtTokenAmount } from "../lib/format";

export default function MobileInspectSheet({
  activeTokenInfo,
  currentSupplyBase,
  handleShowNodeConnections,
  resolvedSelectedNode,
  setIsMobileInspectOpen,
  setIsTransfersModalOpen,
}) {
  return (
    <div
      className="mobile-inspect-sheet"
      role="dialog"
      aria-modal="false"
      aria-labelledby="mobile-inspect-heading"
    >
      <div className="mobile-inspect-head">
        <strong id="mobile-inspect-heading">
          {resolvedSelectedNode.label}
        </strong>
        <button
          type="button"
          aria-label="Close mobile inspect panel"
          onClick={() => setIsMobileInspectOpen(false)}
        >
          Close
        </button>
      </div>
      <p>{resolvedSelectedNode.shortAddr}</p>
      <p>
        Share:{" "}
        {fmtSharePct(
          resolvedSelectedNode.value,
          currentSupplyBase,
          resolvedSelectedNode.pct,
        )}
      </p>
      <p>
        Amount: {fmtTokenAmount(resolvedSelectedNode.value)}{" "}
        {activeTokenInfo.name}
      </p>
      <div className="mobile-inspect-actions">
        <button
          type="button"
          onClick={() =>
            handleShowNodeConnections(resolvedSelectedNode.id)
          }
        >
          Show Connections
        </button>
        <button
          type="button"
          onClick={() => {
            setIsTransfersModalOpen(true);
            setIsMobileInspectOpen(false);
          }}
        >
          Transactions
        </button>
      </div>
    </div>
  );
}

import React, { useLayoutEffect, useRef } from "react";

function TransactionsModal({
  isOpen,
  selectedNode,
  closeTransfersModal,
  isSelectedNodeTransactionsLoading,
  selectedNodeApiTransactionsError,
  exportMenuRef,
  isExportMenuOpen,
  setIsExportMenuOpen,
  exportTransactions,
  resetAllTransactionFilters,
  dirFilterRef,
  counterpartyFilterRef,
  timeFilterRef,
  amountFilterRef,
  usdFilterRef,
  activeTransactionFilter,
  setActiveTransactionFilter,
  hasDirFilter,
  hasCounterpartyFilter,
  hasTimeFilter,
  hasAmountFilter,
  hasUsdFilter,
  transactionDirFilter,
  setTransactionDirFilter,
  transactionCounterpartyFilter,
  setTransactionCounterpartyFilter,
  transactionStartTime,
  setTransactionStartTime,
  transactionEndTime,
  setTransactionEndTime,
  transactionMinAmount,
  setTransactionMinAmount,
  transactionMaxAmount,
  setTransactionMaxAmount,
  transactionMinUsd,
  setTransactionMinUsd,
  transactionMaxUsd,
  setTransactionMaxUsd,
  transactionSortBy,
  transactionSortDirection,
  handleTransactionSortToggle,
  filteredTransactions,
  pagedTransactions,
  nodeById,
  setSelectedNode,
  handleCopyAddress,
  copiedAddress,
  explorerBase,
  fmtTokenAmount,
  fmtUsdAmount,
  handleCopyTransactionHash,
  copiedTxHash,
  txExplorerBase,
  transactionPageCount,
  setTransactionPage,
  transactionPage,
  totalTransactionCount,
}) {
  const backdropRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    const syncBackdropOffset = () => {
      const headerHeight =
        document.querySelector(".header")?.getBoundingClientRect().height || 0;
      const shellBarHeight =
        document.querySelector(".app-shell-bar")?.getBoundingClientRect()
          .height || 0;
      const topOffset = Math.max(84, Math.round(headerHeight + shellBarHeight));

      if (backdropRef.current) {
        backdropRef.current.style.setProperty(
          "--transfers-modal-top-offset",
          `${topOffset}px`,
        );
      }
    };

    syncBackdropOffset();
    window.addEventListener("resize", syncBackdropOffset);

    return () => {
      window.removeEventListener("resize", syncBackdropOffset);
    };
  }, [isOpen]);

  if (!isOpen || !selectedNode) return null;

  const activeFilterChips = [];
  if (hasDirFilter) {
    activeFilterChips.push({
      key: "dir",
      label: `Dir: ${transactionDirFilter}`,
      onClear: () => setTransactionDirFilter("all"),
    });
  }
  if (hasCounterpartyFilter) {
    activeFilterChips.push({
      key: "counterparty",
      label: `Counterparty: ${transactionCounterpartyFilter}`,
      onClear: () => setTransactionCounterpartyFilter(""),
    });
  }
  if (hasTimeFilter) {
    activeFilterChips.push({
      key: "time",
      label: "Time range active",
      onClear: () => {
        setTransactionStartTime("");
        setTransactionEndTime("");
      },
    });
  }
  if (hasAmountFilter) {
    activeFilterChips.push({
      key: "amount",
      label: "Amount range active",
      onClear: () => {
        setTransactionMinAmount("");
        setTransactionMaxAmount("");
      },
    });
  }
  if (hasUsdFilter) {
    activeFilterChips.push({
      key: "usd",
      label: "USD range active",
      onClear: () => {
        setTransactionMinUsd("");
        setTransactionMaxUsd("");
      },
    });
  }

  return (
    <div
      className="transfers-modal-backdrop"
      onClick={closeTransfersModal}
      ref={backdropRef}
    >
      <div
        className="transfers-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="transfers-modal-head">
          <div className="transfers-modal-head-top">
            <div className="transfers-modal-head-info">
              <div className="transfers-modal-head-title-row">
                <h3 className="transfers-modal-title">All Transactions</h3>
                <p className="transfers-modal-subtitle">
                  Wallet: {selectedNode.shortAddr}
                </p>
              </div>
              {isSelectedNodeTransactionsLoading ? (
                <span className="transfers-modal-status transfers-modal-status-loading">
                  Loading from API…
                </span>
              ) : null}
              {selectedNodeApiTransactionsError ? (
                <span className="transfers-modal-status transfers-modal-status-error">
                  {selectedNodeApiTransactionsError}
                </span>
              ) : null}
            </div>
            <div className="transfers-modal-head-actions">
              <div className="transactions-export" ref={exportMenuRef}>
                <button
                  type="button"
                  className="transactions-export-btn"
                  onClick={() => setIsExportMenuOpen((open) => !open)}
                >
                  Export
                </button>
                {isExportMenuOpen && (
                  <div className="transactions-export-menu">
                    <button
                      type="button"
                      className="transactions-export-item"
                      onClick={() => exportTransactions("json")}
                    >
                      Export JSON
                    </button>
                    <button
                      type="button"
                      className="transactions-export-item"
                      onClick={() => exportTransactions("excel")}
                    >
                      Export Excel
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="transactions-reset-all"
                onClick={resetAllTransactionFilters}
              >
                Reset All Filters
              </button>
              <button
                type="button"
                className="transfers-modal-close"
                onClick={closeTransfersModal}
                aria-label="Close transfers modal"
              >
                ×
              </button>
            </div>
          </div>
        </div>
        <div className="transfers-table-wrap">
          {activeFilterChips.length ? (
            <div className="transactions-active-filters" role="status">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="transactions-active-filter-chip"
                  onClick={chip.onClear}
                  title="Click to clear filter"
                >
                  {chip.label} ×
                </button>
              ))}
            </div>
          ) : null}
          <div className="transfers-table-scroll">
            <table className="transfers-table">
              <thead>
                <tr>
                  <th className="transactions-th-filterable" ref={dirFilterRef}>
                    <div className="transactions-th-content">
                      <span>Dir</span>
                      <button
                        type="button"
                        className={`transactions-th-filter-btn ${activeTransactionFilter === "dir" ? "is-active" : ""} ${hasDirFilter ? "has-value" : ""}`}
                        onClick={() =>
                          setActiveTransactionFilter((current) =>
                            current === "dir" ? null : "dir",
                          )
                        }
                        aria-label="Filter direction column"
                        title="Filter direction"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path
                            d="M2 3h12l-4.5 5v4l-3-1.8V8z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                    {activeTransactionFilter === "dir" && (
                      <div className="transactions-th-popover transactions-th-popover-dir">
                        <button
                          type="button"
                          className={`transactions-filter-chip ${transactionDirFilter === "all" ? "is-active" : ""}`}
                          onClick={() => setTransactionDirFilter("all")}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className={`transactions-filter-chip ${transactionDirFilter === "from" ? "is-active" : ""}`}
                          onClick={() => setTransactionDirFilter("from")}
                        >
                          From
                        </button>
                        <button
                          type="button"
                          className={`transactions-filter-chip ${transactionDirFilter === "to" ? "is-active" : ""}`}
                          onClick={() => setTransactionDirFilter("to")}
                        >
                          To
                        </button>
                      </div>
                    )}
                  </th>
                  <th
                    className="transactions-th-filterable"
                    ref={counterpartyFilterRef}
                  >
                    <div className="transactions-th-content">
                      <span>Counterparty</span>
                      <button
                        type="button"
                        className={`transactions-th-filter-btn ${activeTransactionFilter === "counterparty" ? "is-active" : ""} ${hasCounterpartyFilter ? "has-value" : ""}`}
                        onClick={() =>
                          setActiveTransactionFilter((current) =>
                            current === "counterparty" ? null : "counterparty",
                          )
                        }
                        aria-label="Filter counterparty column"
                        title="Filter counterparty"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path
                            d="M2 3h12l-4.5 5v4l-3-1.8V8z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                    {activeTransactionFilter === "counterparty" && (
                      <div className="transactions-th-popover transactions-th-popover-counterparty">
                        <label className="transactions-filter-field">
                          <span>Address or Name</span>
                          <input
                            type="text"
                            value={transactionCounterpartyFilter}
                            onChange={(event) =>
                              setTransactionCounterpartyFilter(
                                event.target.value,
                              )
                            }
                            placeholder="Search by address or name"
                          />
                        </label>
                        <button
                          type="button"
                          className="transactions-filter-reset"
                          onClick={() => setTransactionCounterpartyFilter("")}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </th>
                  <th
                    className="transactions-th-filterable"
                    ref={timeFilterRef}
                  >
                    <div className="transactions-th-content">
                      <span>Time</span>
                      <button
                        type="button"
                        className={`transactions-th-sort-btn ${transactionSortBy === "time" ? "is-active" : ""}`}
                        onClick={() => handleTransactionSortToggle("time")}
                        aria-label={`Sort time ${transactionSortBy === "time" && transactionSortDirection === "asc" ? "descending" : "ascending"}`}
                        title={`Sort time ${transactionSortBy === "time" && transactionSortDirection === "asc" ? "descending" : "ascending"}`}
                      >
                        {transactionSortBy === "time"
                          ? transactionSortDirection === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </button>
                      <button
                        type="button"
                        className={`transactions-th-filter-btn ${activeTransactionFilter === "time" ? "is-active" : ""} ${hasTimeFilter ? "has-value" : ""}`}
                        onClick={() =>
                          setActiveTransactionFilter((current) =>
                            current === "time" ? null : "time",
                          )
                        }
                        aria-label="Filter time column"
                        title="Filter time"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path
                            d="M2 3h12l-4.5 5v4l-3-1.8V8z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                    {activeTransactionFilter === "time" && (
                      <div className="transactions-th-popover">
                        <label className="transactions-filter-field">
                          <span>Begin Time (UTC)</span>
                          <input
                            type="datetime-local"
                            value={transactionStartTime}
                            onChange={(event) =>
                              setTransactionStartTime(event.target.value)
                            }
                          />
                        </label>
                        <label className="transactions-filter-field">
                          <span>End Time (UTC)</span>
                          <input
                            type="datetime-local"
                            value={transactionEndTime}
                            onChange={(event) =>
                              setTransactionEndTime(event.target.value)
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="transactions-filter-reset"
                          onClick={() => {
                            setTransactionStartTime("");
                            setTransactionEndTime("");
                          }}
                        >
                          Reset Time
                        </button>
                      </div>
                    )}
                  </th>
                  <th>Token</th>
                  <th
                    className="transactions-th-filterable"
                    ref={amountFilterRef}
                  >
                    <div className="transactions-th-content">
                      <span>Amount</span>
                      <button
                        type="button"
                        className={`transactions-th-sort-btn ${transactionSortBy === "amount" ? "is-active" : ""}`}
                        onClick={() => handleTransactionSortToggle("amount")}
                        aria-label={`Sort amount ${transactionSortBy === "amount" && transactionSortDirection === "asc" ? "descending" : "ascending"}`}
                        title={`Sort amount ${transactionSortBy === "amount" && transactionSortDirection === "asc" ? "descending" : "ascending"}`}
                      >
                        {transactionSortBy === "amount"
                          ? transactionSortDirection === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </button>
                      <button
                        type="button"
                        className={`transactions-th-filter-btn ${activeTransactionFilter === "amount" ? "is-active" : ""} ${hasAmountFilter ? "has-value" : ""}`}
                        onClick={() =>
                          setActiveTransactionFilter((current) =>
                            current === "amount" ? null : "amount",
                          )
                        }
                        aria-label="Filter amount column"
                        title="Filter amount"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path
                            d="M2 3h12l-4.5 5v4l-3-1.8V8z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                    {activeTransactionFilter === "amount" && (
                      <div className="transactions-th-popover transactions-th-popover-amount">
                        <label className="transactions-filter-field transactions-filter-field-amount">
                          <span>Min Amount</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={transactionMinAmount}
                            onChange={(event) =>
                              setTransactionMinAmount(event.target.value)
                            }
                            placeholder="0"
                          />
                        </label>
                        <label className="transactions-filter-field transactions-filter-field-amount">
                          <span>Max Amount</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={transactionMaxAmount}
                            onChange={(event) =>
                              setTransactionMaxAmount(event.target.value)
                            }
                            placeholder="No limit"
                          />
                        </label>
                        <button
                          type="button"
                          className="transactions-filter-reset"
                          onClick={() => {
                            setTransactionMinAmount("");
                            setTransactionMaxAmount("");
                          }}
                        >
                          Reset Amount
                        </button>
                      </div>
                    )}
                  </th>
                  <th className="transactions-th-filterable" ref={usdFilterRef}>
                    <div className="transactions-th-content">
                      <span>USD (Now)</span>
                      <button
                        type="button"
                        className={`transactions-th-filter-btn ${activeTransactionFilter === "usd" ? "is-active" : ""} ${hasUsdFilter ? "has-value" : ""}`}
                        onClick={() =>
                          setActiveTransactionFilter((current) =>
                            current === "usd" ? null : "usd",
                          )
                        }
                        aria-label="Filter USD column"
                        title="Filter USD"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path
                            d="M2 3h12l-4.5 5v4l-3-1.8V8z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                    {activeTransactionFilter === "usd" && (
                      <div className="transactions-th-popover transactions-th-popover-amount">
                        <label className="transactions-filter-field transactions-filter-field-amount">
                          <span>Min USD</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={transactionMinUsd}
                            onChange={(event) =>
                              setTransactionMinUsd(event.target.value)
                            }
                            placeholder="0"
                          />
                        </label>
                        <label className="transactions-filter-field transactions-filter-field-amount">
                          <span>Max USD</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={transactionMaxUsd}
                            onChange={(event) =>
                              setTransactionMaxUsd(event.target.value)
                            }
                            placeholder="No limit"
                          />
                        </label>
                        <button
                          type="button"
                          className="transactions-filter-reset"
                          onClick={() => {
                            setTransactionMinUsd("");
                            setTransactionMaxUsd("");
                          }}
                        >
                          Reset USD
                        </button>
                      </div>
                    )}
                  </th>
                  <th>Tx Hash</th>
                  <th>Tx</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length ? (
                  pagedTransactions.map((transfer) => (
                    <tr key={transfer.id}>
                      <td
                        className={`transfer-dir ${transfer.direction === "From" ? "from" : "to"}`}
                      >
                        {transfer.direction}
                      </td>
                      <td>
                        <div className="transfer-counterparty-row">
                          <div className="transfer-counterparty">
                            {transfer.counterpartLabel}
                          </div>
                          {nodeById.has(
                            transfer.counterpartAddress ||
                              transfer.counterpartAddr,
                          ) && (
                            <button
                              type="button"
                              className="transfer-action transfer-action-focus"
                              onClick={() => {
                                const addr =
                                  transfer.counterpartAddress ||
                                  transfer.counterpartAddr;
                                closeTransfersModal();
                                setSelectedNode(nodeById.get(addr));
                              }}
                              aria-label="Focus this node on the map"
                              title="Focus this node on the map"
                            >
                              ⊙
                            </button>
                          )}
                          <button
                            type="button"
                            className="transfer-action"
                            onClick={() =>
                              handleCopyAddress(
                                transfer.counterpartAddress ||
                                  transfer.counterpartAddr,
                              )
                            }
                            aria-label="Copy counterpart address"
                            title="Copy counterpart address"
                          >
                            {copiedAddress ===
                            (transfer.counterpartAddress ||
                              transfer.counterpartAddr)
                              ? "Copied"
                              : "Copy"}
                          </button>
                          <a
                            className="transfer-action"
                            href={`${explorerBase}${encodeURIComponent(transfer.counterpartAddress || transfer.counterpartAddr)}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label="Open address on Phantasma Explorer"
                            title="Open address on Phantasma Explorer"
                          >
                            ↗
                          </a>
                        </div>
                      </td>
                      <td>{transfer.timeUtc}</td>
                      <td>{transfer.token}</td>
                      <td>{fmtTokenAmount(transfer.amount)}</td>
                      <td>{fmtUsdAmount(transfer.usd)}</td>
                      <td>
                        <div
                          className="transfer-hash-cell"
                          title={transfer.transactionHash}
                        >
                          <span className="transfer-hash">
                            {transfer.transactionHash}
                          </span>
                          <button
                            type="button"
                            className="transfer-action"
                            onClick={() =>
                              handleCopyTransactionHash(
                                transfer.transactionHash,
                              )
                            }
                            aria-label="Copy transaction hash"
                            title="Copy transaction hash"
                          >
                            {copiedTxHash === transfer.transactionHash
                              ? "Copied"
                              : "Copy"}
                          </button>
                          <a
                            className="transfer-action"
                            href={`${txExplorerBase}${encodeURIComponent(transfer.transactionHash)}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label="Open transaction on Phantasma Explorer"
                            title="Open transaction on Phantasma Explorer"
                          >
                            ↗
                          </a>
                        </div>
                      </td>
                      <td>
                        <div className="transfer-tx-counts">
                          <span>
                            <span className="transfer-tx-dir-label">S</span>
                            {transfer.sentTransactions.toLocaleString()}
                          </span>
                          <span>
                            <span className="transfer-tx-dir-label">R</span>
                            {transfer.receivedTransactions.toLocaleString()}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="transfers-empty">
                      <div className="transfers-empty-inner">
                        <svg
                          className="transfers-empty-icon"
                          viewBox="0 0 40 40"
                          aria-hidden="true"
                          fill="none"
                        >
                          <circle
                            cx="20"
                            cy="20"
                            r="18"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                            opacity="0.4"
                          />
                          <path
                            d="M14 20h12M20 14v12"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            opacity="0.3"
                          />
                        </svg>
                        <strong>
                          No transactions match the current filters.
                        </strong>
                        <span>
                          Try adjusting your filters or resetting to see all
                          transactions.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {transactionPageCount > 1 && (
          <div className="transfers-pagination">
            <button
              type="button"
              className="transfers-pagination-btn"
              onClick={() => setTransactionPage((p) => Math.max(0, p - 1))}
              disabled={transactionPage === 0}
            >
              ‹ Prev
            </button>
            <span className="transfers-pagination-info">
              Page {transactionPage + 1} of {transactionPageCount}
              {" · "}
              {totalTransactionCount.toLocaleString()} total
            </span>
            <button
              type="button"
              className="transfers-pagination-btn"
              onClick={() =>
                setTransactionPage((p) =>
                  Math.min(transactionPageCount - 1, p + 1),
                )
              }
              disabled={transactionPage >= transactionPageCount - 1}
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(TransactionsModal);

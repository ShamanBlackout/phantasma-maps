import { render, screen } from "@testing-library/react";
import TransactionsModal from "./TransactionsModal";
import { fmtTokenAmount, fmtUsdAmount } from "../lib/format";

function renderModal(props) {
  return render(
    <TransactionsModal
      isOpen
      selectedNode={{
        id: "P2K8mNxHvT3qAaBpFsuWcY9JeGKd4kQ7Rmj6CiDyEF",
        shortAddr: "P2K8…yEF",
      }}
      closeTransfersModal={() => {}}
      setIsExportMenuOpen={() => {}}
      exportTransactions={() => {}}
      resetAllTransactionFilters={() => {}}
      transactionDirFilter="all"
      transactionCounterpartyFilter=""
      filteredTransactions={[]}
      pagedTransactions={[]}
      nodeById={new Map()}
      fmtTokenAmount={String}
      fmtUsdAmount={String}
      transactionPageCount={1}
      transactionPage={0}
      totalTransactionCount={0}
      {...props}
    />,
  );
}

test("export waits until the selected wallet's transactions finish loading", () => {
  const { unmount } = renderModal({ isSelectedNodeTransactionsLoading: true });
  expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  unmount();

  renderModal({ isSelectedNodeTransactionsLoading: false });
  expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
});

test("an already-open export menu cannot export while transactions reload", () => {
  renderModal({
    isSelectedNodeTransactionsLoading: true,
    isExportMenuOpen: true,
  });
  expect(screen.getByRole("button", { name: "Export JSON" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
});

test.each([
  [1e-10, 2e-10, "1.00e-10", "$2.00e-10"],
  [0, 0, "0.00", "$0.00"],
  [1.25, 2.5, "1.25", "$2.50"],
])(
  "transaction amounts preserve nonzero values: %s",
  (amount, usd, tokenText, usdText) => {
    const transfer = {
      id: "precision-transfer",
      direction: "To",
      counterpartAddress: "P2KBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      counterpartLabel: "Wallet B",
      timeUtc: "01:00:00 UTC",
      token: "KCAL",
      amount,
      usd,
      transactionHash: "precision-transfer",
    };
    renderModal({
      filteredTransactions: [transfer],
      pagedTransactions: [transfer],
      fmtTokenAmount,
      fmtUsdAmount,
    });
    expect(
      screen.getByRole("cell", { name: tokenText, exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: usdText, exact: true }),
    ).toBeInTheDocument();
  },
);

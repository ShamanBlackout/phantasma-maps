import { render, screen } from "@testing-library/react";
import TransactionsModal from "./TransactionsModal";

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

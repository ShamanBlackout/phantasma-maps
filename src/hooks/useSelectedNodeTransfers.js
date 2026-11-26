import { useMemo } from "react";
import { mapApiTransaction } from "../lib/walletTransactions";

export default function useSelectedNodeTransfers({
  activeTokenInfo,
  fallbackSelectedNodeTransfers,
  nodeById,
  selectedNode,
  selectedNodeApiTransactions,
  selectedNodeApiTransactionsError,
}) {
  return useMemo(() => {
    if (!selectedNode) return [];

    if (!selectedNodeApiTransactionsError) {
      return selectedNodeApiTransactions.map((transaction, index) =>
        mapApiTransaction(transaction, index, {
          walletId: selectedNode.id,
          nodeById,
          tokenName: activeTokenInfo.name,
          tokenPrice: activeTokenInfo.price,
        }),
      );
    }

    return fallbackSelectedNodeTransfers;
  }, [
    selectedNode,
    selectedNodeApiTransactions,
    selectedNodeApiTransactionsError,
    fallbackSelectedNodeTransfers,
    nodeById,
    activeTokenInfo.name,
    activeTokenInfo.price,
  ]);
}

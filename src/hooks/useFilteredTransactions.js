import { useMemo } from "react";
import { parseUtcDateTimeInput } from "../lib/format";

export default function useFilteredTransactions({
  selectedNode,
  selectedNodeApiTransactionsError,
  selectedNodeTransfers,
  transactionCounterpartyFilter,
  transactionDirFilter,
  transactionEndTime,
  transactionMaxAmount,
  transactionMaxUsd,
  transactionMinAmount,
  transactionMinUsd,
  transactionSortBy,
  transactionSortDirection,
  transactionStartTime,
}) {
  return useMemo(() => {
    const shouldUseServerFilteredPage =
      Boolean(selectedNode?.id) && !selectedNodeApiTransactionsError;
    if (shouldUseServerFilteredPage) {
      return selectedNodeTransfers;
    }

    const startTs = parseUtcDateTimeInput(transactionStartTime);
    const endTs = parseUtcDateTimeInput(transactionEndTime);
    const minAmount =
      transactionMinAmount === "" ? null : Number(transactionMinAmount);
    const maxAmount =
      transactionMaxAmount === "" ? null : Number(transactionMaxAmount);
    const minUsd = transactionMinUsd === "" ? null : Number(transactionMinUsd);
    const maxUsd = transactionMaxUsd === "" ? null : Number(transactionMaxUsd);
    const counterpartyQuery = transactionCounterpartyFilter
      .trim()
      .toLowerCase();

    const filtered = selectedNodeTransfers.filter((transaction) => {
      if (transactionDirFilter !== "all") {
        if (transaction.direction.toLowerCase() !== transactionDirFilter)
          return false;
      }
      if (counterpartyQuery) {
        const haystack =
          `${transaction.counterpartLabel} ${transaction.counterpartAddr}`.toLowerCase();
        if (!haystack.includes(counterpartyQuery)) return false;
      }
      if (startTs !== null && transaction.timestamp < startTs) return false;
      if (endTs !== null && transaction.timestamp > endTs) return false;
      if (minAmount !== null && transaction.amount < minAmount) return false;
      if (maxAmount !== null && transaction.amount > maxAmount) return false;
      if (minUsd !== null && transaction.usd < minUsd) return false;
      if (maxUsd !== null && transaction.usd > maxUsd) return false;
      return true;
    });

    if (transactionSortBy !== "amount" && transactionSortBy !== "time") {
      return filtered;
    }

    const directionMultiplier = transactionSortDirection === "desc" ? -1 : 1;
    return [...filtered].sort((left, right) => {
      const leftValue = Number(left?.[transactionSortBy]) || 0;
      const rightValue = Number(right?.[transactionSortBy]) || 0;
      if (leftValue === rightValue) return 0;
      return leftValue > rightValue
        ? directionMultiplier
        : -directionMultiplier;
    });
  }, [
    selectedNode,
    selectedNodeTransfers,
    selectedNodeApiTransactionsError,
    transactionDirFilter,
    transactionCounterpartyFilter,
    transactionStartTime,
    transactionEndTime,
    transactionMinAmount,
    transactionMaxAmount,
    transactionMinUsd,
    transactionMaxUsd,
    transactionSortBy,
    transactionSortDirection,
  ]);
}

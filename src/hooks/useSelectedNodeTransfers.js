import { useMemo } from "react";
import { normalizeAmount, shortenAddress } from "../graph/graphData";
import {
  formatUtcDateTime,
  parseTimestampMs,
  toUtcDateTimeInputValue,
} from "../lib/format";

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
      return selectedNodeApiTransactions.map((transaction, index) => {
        const fromAddress = String(
          transaction.from_address ?? transaction.fromAddress ?? "",
        );
        const toAddress = String(
          transaction.to_address ?? transaction.toAddress ?? "",
        );
        const txHash = String(transaction.tx_hash ?? transaction.txHash ?? "");
        const token = String(
          transaction.token_symbol ??
            transaction.tokenSymbol ??
            activeTokenInfo.name,
        );
        const amount = normalizeAmount(
          transaction.amountNormalized ??
            transaction.amount_normalized ??
            transaction.amount,
        );
        const timestamp = parseTimestampMs(transaction.timestamp);
        const isOutgoing = fromAddress === selectedNode.id;
        const counterpartId = isOutgoing ? toAddress : fromAddress;
        const counterpartNode = nodeById.get(counterpartId);

        return {
          id: String(
            transaction.id ||
              `${txHash}-${transaction.event_index ?? transaction.eventIndex ?? index}`,
          ),
          direction: isOutgoing ? "To" : "From",
          counterpartLabel:
            counterpartNode?.label ||
            counterpartNode?.shortAddr ||
            shortenAddress(counterpartId),
          counterpartAddress: counterpartId,
          counterpartAddr:
            counterpartNode?.shortAddr || shortenAddress(counterpartId),
          token,
          amount,
          usd: amount * Number(activeTokenInfo.price),
          sentTransactions: isOutgoing ? 1 : 0,
          receivedTransactions: isOutgoing ? 0 : 1,
          transactionHash: txHash || "N/A",
          timestamp,
          timeUtc: formatUtcDateTime(timestamp),
          timeInputValue: toUtcDateTimeInputValue(timestamp),
        };
      });
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

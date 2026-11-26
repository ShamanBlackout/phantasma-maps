import { normalizeAmount, shortenAddress } from "../graph/graphData";
import {
  formatUtcDateTime,
  parseTimestampMs,
  parseUtcDateTimeInput,
  rowsToCsv,
  toUtcDateTimeInputValue,
} from "./format";

const TRANSACTION_EXPORT_HEADERS = [
  "Direction",
  "Counterparty",
  "Address",
  "Time",
  "Token",
  "Amount",
  "USD (Now)",
  "Transaction Hash",
];

function parseOptionalNumber(value) {
  const parsed = value === "" ? null : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Converts the transactions modal filter inputs into GET /transactions query filters.
export function buildTransactionApiFilters({
  direction,
  counterparty,
  startTime,
  endTime,
  minAmount,
  maxAmount,
  minUsd,
  maxUsd,
  usdPrice,
  sortBy,
  sortDirection,
}) {
  const startTs = parseUtcDateTimeInput(startTime);
  const endTs = parseUtcDateTimeInput(endTime);

  return {
    direction,
    counterparty,
    startTime: startTs === null ? "" : new Date(startTs).toISOString(),
    endTime: endTs === null ? "" : new Date(endTs).toISOString(),
    minAmount: parseOptionalNumber(minAmount),
    maxAmount: parseOptionalNumber(maxAmount),
    minUsd: parseOptionalNumber(minUsd),
    maxUsd: parseOptionalNumber(maxUsd),
    usdRateNow: Number.isFinite(Number(usdPrice)) ? Number(usdPrice) : null,
    sortBy: sortBy === "amount" || sortBy === "time" ? sortBy : null,
    sortDir: sortDirection,
  };
}

// Maps one API transaction into the modal row shape, seen from walletId's side.
export function mapApiTransaction(
  transaction,
  index,
  { walletId, nodeById, tokenName, tokenPrice },
) {
  const fromAddress = String(
    transaction.from_address ?? transaction.fromAddress ?? "",
  );
  const toAddress = String(transaction.to_address ?? transaction.toAddress ?? "");
  const txHash = String(transaction.tx_hash ?? transaction.txHash ?? "");
  const token = String(
    transaction.token_symbol ?? transaction.tokenSymbol ?? tokenName,
  );
  const amount = normalizeAmount(
    transaction.amountNormalized ??
      transaction.amount_normalized ??
      transaction.amount,
  );
  const timestamp = parseTimestampMs(transaction.timestamp);
  const isOutgoing = fromAddress === walletId;
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
    counterpartAddr: counterpartNode?.shortAddr || shortenAddress(counterpartId),
    token,
    amount,
    usd: amount * Number(tokenPrice),
    sentTransactions: isOutgoing ? 1 : 0,
    receivedTransactions: isOutgoing ? 0 : 1,
    transactionHash: txHash || "N/A",
    timestamp,
    timeUtc: formatUtcDateTime(timestamp),
    timeInputValue: toUtcDateTimeInputValue(timestamp),
  };
}

export function toTransactionExportRows(transactions) {
  return transactions.map((tx) => ({
    direction: tx.direction,
    counterparty: tx.counterpartLabel,
    address: tx.counterpartAddress || tx.counterpartAddr,
    time: tx.timeUtc,
    token: tx.token,
    amount: tx.amount,
    usdNow: tx.usd,
    transactionHash: tx.transactionHash,
  }));
}

export function transactionExportRowsToCsv(rows) {
  return rowsToCsv(
    TRANSACTION_EXPORT_HEADERS,
    rows.map((row) => [
      row.direction,
      row.counterparty,
      row.address,
      row.time,
      row.token,
      row.amount,
      row.usdNow,
      row.transactionHash,
    ]),
  );
}

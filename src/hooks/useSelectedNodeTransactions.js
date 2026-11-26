import { useEffect } from "react";
import { parseUtcDateTimeInput } from "../lib/format";
import {
  fetchTransactionsPageForAddress as fetchTransactionsPageForAddressFromApi,
} from "../api/mapsApi";
import {
  MAPS_API_BASE_URL,
  MAPS_API_REQUEST_TIMEOUT_MS,
} from "../config/appConfig";
import {
  buildApiErrorRecord,
  buildTokenNotFoundStatus,
  formatApiErrorMeta,
  isTokenNotFoundError,
} from "../api/apiErrors";

export default function useSelectedNodeTransactions({
  activeTokenInfo,
  selectedNode,
  selectedTokenSymbol,
  setIsSelectedNodeTransactionsLoading,
  setLastApiError,
  setSelectedNodeApiTransactions,
  setSelectedNodeApiTransactionsError,
  setSelectedNodeApiTransactionsTotal,
  transactionCounterpartyFilter,
  transactionDirFilter,
  transactionEndTime,
  transactionMaxAmount,
  transactionMaxUsd,
  transactionMinAmount,
  transactionMinUsd,
  transactionPage,
  transactionSortBy,
  transactionSortDirection,
  transactionStartTime,
}) {
  useEffect(() => {
    if (!selectedNode?.id) {
      setSelectedNodeApiTransactions([]);
      setSelectedNodeApiTransactionsTotal(0);
      setSelectedNodeApiTransactionsError("");
      setIsSelectedNodeTransactionsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchSelectedNodeTransactions() {
      setIsSelectedNodeTransactionsLoading(true);
      setSelectedNodeApiTransactionsError("");

      const startTs = parseUtcDateTimeInput(transactionStartTime);
      const endTs = parseUtcDateTimeInput(transactionEndTime);
      const minAmount =
        transactionMinAmount === "" ? null : Number(transactionMinAmount);
      const maxAmount =
        transactionMaxAmount === "" ? null : Number(transactionMaxAmount);
      const minUsd =
        transactionMinUsd === "" ? null : Number(transactionMinUsd);
      const maxUsd =
        transactionMaxUsd === "" ? null : Number(transactionMaxUsd);

      const apiFilters = {
        direction: transactionDirFilter,
        counterparty: transactionCounterpartyFilter,
        startTime: startTs === null ? "" : new Date(startTs).toISOString(),
        endTime: endTs === null ? "" : new Date(endTs).toISOString(),
        minAmount: Number.isFinite(minAmount) ? minAmount : null,
        maxAmount: Number.isFinite(maxAmount) ? maxAmount : null,
        minUsd: Number.isFinite(minUsd) ? minUsd : null,
        maxUsd: Number.isFinite(maxUsd) ? maxUsd : null,
        usdRateNow: Number.isFinite(Number(activeTokenInfo.price))
          ? Number(activeTokenInfo.price)
          : null,
        sortBy:
          transactionSortBy === "amount" || transactionSortBy === "time"
            ? transactionSortBy
            : null,
        sortDir: transactionSortDirection,
      };

      try {
        const pageData = await fetchTransactionsPageForAddressFromApi(
          MAPS_API_BASE_URL,
          MAPS_API_REQUEST_TIMEOUT_MS,
          selectedNode.id,
          selectedTokenSymbol,
          {
            page: transactionPage + 1,
            pageSize: 100,
            filters: apiFilters,
          },
        );

        if (!isMounted) return;
        setSelectedNodeApiTransactions(pageData.items);
        setSelectedNodeApiTransactionsTotal(pageData.total);
        setSelectedNodeApiTransactionsError("");
      } catch (error) {
        if (!isMounted) return;
        setLastApiError(
          buildApiErrorRecord(
            error,
            "transactions",
            "Transactions API unavailable",
          ),
        );
        setSelectedNodeApiTransactions([]);
        setSelectedNodeApiTransactionsTotal(0);
        if (isTokenNotFoundError(error)) {
          setSelectedNodeApiTransactionsError(
            buildTokenNotFoundStatus(selectedTokenSymbol, error),
          );
          return;
        }
        setSelectedNodeApiTransactionsError(
          `Using graph-derived transfers (transactions API unavailable).${formatApiErrorMeta(error)}`,
        );
      } finally {
        if (isMounted) {
          setIsSelectedNodeTransactionsLoading(false);
        }
      }
    }

    fetchSelectedNodeTransactions();

    return () => {
      isMounted = false;
    };
  }, [
    selectedNode,
    selectedTokenSymbol,
    transactionPage,
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
    activeTokenInfo.price,
    setIsSelectedNodeTransactionsLoading,
    setLastApiError,
    setSelectedNodeApiTransactions,
    setSelectedNodeApiTransactionsError,
    setSelectedNodeApiTransactionsTotal,
  ]);
}

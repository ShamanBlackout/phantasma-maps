import { useEffect } from "react";
import { buildTransactionApiFilters } from "../lib/walletTransactions";
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

      const apiFilters = buildTransactionApiFilters({
        direction: transactionDirFilter,
        counterparty: transactionCounterpartyFilter,
        startTime: transactionStartTime,
        endTime: transactionEndTime,
        minAmount: transactionMinAmount,
        maxAmount: transactionMaxAmount,
        minUsd: transactionMinUsd,
        maxUsd: transactionMaxUsd,
        usdPrice: activeTokenInfo.price,
        sortBy: transactionSortBy,
        sortDirection: transactionSortDirection,
      });

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

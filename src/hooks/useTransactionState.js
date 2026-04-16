import { useCallback, useMemo, useReducer } from "react";

const initialState = {
  activeTransactionFilter: null,
  transactionDirFilter: "all",
  transactionCounterpartyFilter: "",
  transactionStartTime: "",
  transactionEndTime: "",
  transactionMinAmount: "",
  transactionMaxAmount: "",
  transactionMinUsd: "",
  transactionMaxUsd: "",
  transactionSortBy: null,
  transactionSortDirection: "asc",
  transactionPage: 0,
};

function transactionReducer(state, action) {
  if (action.type === "reset") {
    return initialState;
  }

  if (action.type === "set") {
    const currentValue = state[action.field];
    const nextValue =
      typeof action.value === "function"
        ? action.value(currentValue)
        : action.value;

    return {
      ...state,
      [action.field]: nextValue,
    };
  }

  return state;
}

export default function useTransactionState() {
  const [state, dispatch] = useReducer(transactionReducer, initialState);

  const setField = useCallback(
    (field) => (value) =>
      dispatch({
        type: "set",
        field,
        value,
      }),
    [dispatch],
  );

  const setters = useMemo(
    () => ({
      setActiveTransactionFilter: setField("activeTransactionFilter"),
      setTransactionDirFilter: setField("transactionDirFilter"),
      setTransactionCounterpartyFilter: setField(
        "transactionCounterpartyFilter",
      ),
      setTransactionStartTime: setField("transactionStartTime"),
      setTransactionEndTime: setField("transactionEndTime"),
      setTransactionMinAmount: setField("transactionMinAmount"),
      setTransactionMaxAmount: setField("transactionMaxAmount"),
      setTransactionMinUsd: setField("transactionMinUsd"),
      setTransactionMaxUsd: setField("transactionMaxUsd"),
      setTransactionSortBy: setField("transactionSortBy"),
      setTransactionSortDirection: setField("transactionSortDirection"),
      setTransactionPage: setField("transactionPage"),
    }),
    [setField],
  );

  const resetTransactionState = useCallback(
    () =>
      dispatch({
        type: "reset",
      }),
    [dispatch],
  );

  return {
    ...state,
    ...setters,
    resetTransactionState,
  };
}

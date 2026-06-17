import { useEffect } from "react";

/**
 * Reads initial token and node values from the URL search params on page load.
 * Call this outside any hook to get stable initial values for useState/useRef.
 */
export function readUrlParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      tokenSymbol: params.get("token")?.toUpperCase() || null,
      nodeId: params.get("node") || null,
      rootAddress: params.get("address") || null,
      view: params.get("view") || "token",
      query: params.get("q") || "",
      legend: params.get("legend") || "",
      density: params.get("density") || "",
      txDir: params.get("txdir") || "",
      txCounterparty: params.get("txcp") || "",
      traceFrom: params.get("tfrom") || "",
      traceTo: params.get("tto") || "",
      traceStop: params.get("tstop") || "",
      tracePath: params.get("tpath") || "",
    };
  } catch {
    return {
      tokenSymbol: null,
      nodeId: null,
      rootAddress: null,
      view: "token",
      query: "",
      legend: "",
      density: "",
      txDir: "",
      txCounterparty: "",
      traceFrom: "",
      traceTo: "",
      traceStop: "",
      tracePath: "",
    };
  }
}

/**
 * Keeps the browser URL in sync with the selected token, node, and root address.
 */
export default function useUrlState(
  selectedTokenSymbol,
  selectedNode,
  rootAddress,
  options = {},
) {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("token", selectedTokenSymbol);
      if (selectedNode?.id) {
        params.set("node", selectedNode.id);
      } else {
        params.delete("node");
      }

      const normalizedRootAddress = String(rootAddress || "").trim();
      if (normalizedRootAddress) {
        params.set("address", normalizedRootAddress);
      } else {
        params.delete("address");
      }

      const normalizedView =
        String(options?.isConnectionsView ? "connections" : "token").trim() ||
        "token";
      params.set("view", normalizedView);

      const normalizedQuery = String(options?.searchQuery || "").trim();
      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      } else {
        params.delete("q");
      }

      const normalizedLegend = String(options?.activeLegendFilter || "").trim();
      if (normalizedLegend) {
        params.set("legend", normalizedLegend);
      } else {
        params.delete("legend");
      }

      const normalizedDensity = String(options?.densityMode || "").trim();
      if (normalizedDensity) {
        params.set("density", normalizedDensity);
      } else {
        params.delete("density");
      }

      const normalizedTxDir = String(
        options?.transactionDirFilter || "",
      ).trim();
      if (normalizedTxDir && normalizedTxDir !== "all") {
        params.set("txdir", normalizedTxDir);
      } else {
        params.delete("txdir");
      }

      const normalizedTxCounterparty = String(
        options?.transactionCounterpartyFilter || "",
      ).trim();
      if (normalizedTxCounterparty) {
        params.set("txcp", normalizedTxCounterparty);
      } else {
        params.delete("txcp");
      }

      const normalizedTraceFrom = String(
        options?.traceFromAddress || "",
      ).trim();
      const normalizedTraceTo = String(options?.traceToAddress || "").trim();
      const hasTracePair = Boolean(normalizedTraceFrom && normalizedTraceTo);

      if (normalizedTraceFrom) {
        params.set("tfrom", normalizedTraceFrom);
      } else {
        params.delete("tfrom");
      }

      if (normalizedTraceTo) {
        params.set("tto", normalizedTraceTo);
      } else {
        params.delete("tto");
      }

      const normalizedTraceStop = String(options?.traceStopMode || "").trim();
      if (
        hasTracePair &&
        (normalizedTraceStop === "terminal" ||
          normalizedTraceStop === "through")
      ) {
        params.set("tstop", normalizedTraceStop);
      } else {
        params.delete("tstop");
      }

      const normalizedTracePath = String(
        options?.selectedTraceDbPathKey || "",
      ).trim();
      if (hasTracePair && normalizedTracePath) {
        params.set("tpath", normalizedTracePath);
      } else {
        params.delete("tpath");
      }

      window.history.replaceState(null, "", `?${params.toString()}`);
    } catch {
      // Ignore if history API is unavailable.
    }
  }, [selectedTokenSymbol, selectedNode, rootAddress, options]);
}

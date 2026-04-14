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
    };
  } catch {
    return { tokenSymbol: null, nodeId: null };
  }
}

/**
 * Keeps the browser URL in sync with the selected token and node.
 */
export default function useUrlState(selectedTokenSymbol, selectedNode) {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("token", selectedTokenSymbol);
      if (selectedNode?.id) {
        params.set("node", selectedNode.id);
      } else {
        params.delete("node");
      }
      window.history.replaceState(null, "", `?${params.toString()}`);
    } catch {
      // Ignore if history API is unavailable.
    }
  }, [selectedTokenSymbol, selectedNode]);
}

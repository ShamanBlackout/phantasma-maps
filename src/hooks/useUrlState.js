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
    };
  } catch {
    return { tokenSymbol: null, nodeId: null, rootAddress: null };
  }
}

/**
 * Keeps the browser URL in sync with the selected token, node, and root address.
 */
export default function useUrlState(
  selectedTokenSymbol,
  selectedNode,
  rootAddress,
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

      window.history.replaceState(null, "", `?${params.toString()}`);
    } catch {
      // Ignore if history API is unavailable.
    }
  }, [selectedTokenSymbol, selectedNode, rootAddress]);
}

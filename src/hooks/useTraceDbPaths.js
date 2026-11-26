import { useEffect } from "react";
import { fetchTracePaths as fetchTracePathsFromApi } from "../api/mapsApi";
import {
  MAPS_API_BASE_URL,
  MAPS_API_REQUEST_TIMEOUT_MS,
} from "../config/appConfig";

export default function useTraceDbPaths({
  isTraceToolOpen,
  selectedTokenSymbol,
  setIsTraceDbPathsLoading,
  setSelectedTraceDbPathKey,
  setTraceDbPaths,
  setTraceStatusMessage,
  traceFromAddress,
  traceSearchNonce,
  traceStopMode,
  traceToAddress,
}) {
  useEffect(() => {
    if (!isTraceToolOpen) {
      setIsTraceDbPathsLoading(false);
      return undefined;
    }

    if (
      !traceFromAddress ||
      !traceToAddress ||
      traceFromAddress === traceToAddress
    ) {
      setTraceDbPaths([]);
      setIsTraceDbPathsLoading(false);
      setSelectedTraceDbPathKey("");
      return;
    }

    let isMounted = true;
    setIsTraceDbPathsLoading(true);

    (async () => {
      try {
        const result = await fetchTracePathsFromApi(
          MAPS_API_BASE_URL,
          MAPS_API_REQUEST_TIMEOUT_MS,
          selectedTokenSymbol,
          traceFromAddress,
          traceToAddress,
          {
            maxHops: 8,
            limit: 500,
            stopAtTerminals: traceStopMode === "terminal",
          },
        );

        if (!isMounted) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        setTraceDbPaths(items);
        setSelectedTraceDbPathKey((current) => {
          if (!current) {
            return "";
          }
          return items.some(
            (item) => (item?.nodePath || []).join("->") === current,
          )
            ? current
            : "";
        });

        if (items.length) {
          const shortestHops = Math.min(
            ...items.map((item) => Number(item?.hopCount) || 0),
          );
          setTraceStatusMessage(
            traceStopMode === "terminal"
              ? `Database found ${items.length.toLocaleString()} path(s). Shortest path is ${shortestHops} hop(s). Paths end at the destination or at hub/high inbound/high outbound wallets.`
              : `Database found ${items.length.toLocaleString()} path(s). Shortest path is ${shortestHops} hop(s). Terminal hubs/high inbound/high outbound can be traversed in this mode.`,
          );
        } else {
          setTraceStatusMessage(
            traceStopMode === "terminal"
              ? "Database search found no paths under destination-or-terminal stop rules."
              : "Database search found no paths under pass-through mode.",
          );
        }
      } catch (error) {
        if (!isMounted) return;
        setTraceDbPaths([]);
        setSelectedTraceDbPathKey("");
        setTraceStatusMessage(
          error instanceof Error
            ? `Database path search failed: ${error.message}`
            : "Database path search failed.",
        );
      } finally {
        if (isMounted) {
          setIsTraceDbPathsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [
    isTraceToolOpen,
    selectedTokenSymbol,
    traceSearchNonce,
    traceStopMode,
    traceFromAddress,
    traceToAddress,
    setIsTraceDbPathsLoading,
    setSelectedTraceDbPathKey,
    setTraceDbPaths,
    setTraceStatusMessage,
  ]);
}

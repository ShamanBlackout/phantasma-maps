import { useEffect } from "react";
import {
  createActivityEndpoint as buildActivityEndpoint,
} from "../api/mapsApi";
import {
  MAPS_API_BASE_URL,
  MAPS_API_REQUEST_TIMEOUT_MS,
} from "../config/appConfig";
import { fetchJsonWithTimeout } from "../api/http";
import { buildApiErrorRecord, isTokenNotFoundError } from "../api/apiErrors";

export default function useSelectedNodeActivity({
  selectedNode,
  selectedNodeActivityCacheRef,
  selectedTokenSymbol,
  setIsSelectedNodeActivityLoading,
  setLastApiError,
  setSelectedNodeSparkline,
}) {
  useEffect(() => {
    if (!selectedNode?.id || !selectedTokenSymbol) {
      setSelectedNodeSparkline([]);
      setIsSelectedNodeActivityLoading(false);
      return;
    }

    let isMounted = true;
    const cacheKey = `${selectedTokenSymbol}:${selectedNode.id}:30`;
    const cachedEntry = selectedNodeActivityCacheRef.current.get(cacheKey);
    const now = Date.now();
    const cacheTtlMs = 2 * 60 * 1000;

    if (cachedEntry?.items?.length) {
      setSelectedNodeSparkline(cachedEntry.items);
      const isFresh = now - Number(cachedEntry.fetchedAt || 0) < cacheTtlMs;
      if (isFresh) {
        setIsSelectedNodeActivityLoading(false);
        return () => {
          isMounted = false;
        };
      }
    } else {
      setSelectedNodeSparkline([]);
    }

    setIsSelectedNodeActivityLoading(true);
    const endpoint = buildActivityEndpoint(
      MAPS_API_BASE_URL,
      selectedNode.id,
      selectedTokenSymbol,
      30,
    );

    fetchJsonWithTimeout(endpoint, {}, MAPS_API_REQUEST_TIMEOUT_MS)
      .then((result) => {
        if (!isMounted) return;
        if (result.ok && Array.isArray(result.payload?.items)) {
          const items = result.payload.items;
          setSelectedNodeSparkline(items);
          selectedNodeActivityCacheRef.current.set(cacheKey, {
            items,
            fetchedAt: Date.now(),
          });
        } else {
          if (isTokenNotFoundError(result)) {
            setLastApiError(
              buildApiErrorRecord(
                result,
                "activity",
                "Token activity is not available in the database",
              ),
            );
          }
          setSelectedNodeSparkline([]);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setSelectedNodeSparkline([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsSelectedNodeActivityLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    selectedNode?.id,
    selectedTokenSymbol,
    selectedNodeActivityCacheRef,
    setIsSelectedNodeActivityLoading,
    setLastApiError,
    setSelectedNodeSparkline,
  ]);
}

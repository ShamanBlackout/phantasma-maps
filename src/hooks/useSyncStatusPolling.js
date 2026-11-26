import { useEffect } from "react";
import { fetchJsonWithTimeout } from "../api/http";
import {
  createSyncStatusEndpoint as buildSyncStatusEndpoint,
} from "../api/mapsApi";
import {
  MAPS_API_BASE_URL,
  MAPS_API_REQUEST_TIMEOUT_MS,
  MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS,
} from "../config/appConfig";
import { buildApiErrorRecord } from "../api/apiErrors";

export default function useSyncStatusPolling({
  setBlockSyncHeight,
  setBlockSyncTargetHeight,
  setBlockSyncUpdatedAt,
  setLastApiError,
}) {
  useEffect(() => {
    let isActive = true;
    let timeoutId = null;

    async function fetchSyncStatus() {
      const result = await fetchJsonWithTimeout(
        buildSyncStatusEndpoint(MAPS_API_BASE_URL),
        {},
        MAPS_API_REQUEST_TIMEOUT_MS,
      );

      if (!isActive) return;

      if (result.ok) {
        const items = Array.isArray(result.payload?.items)
          ? result.payload.items
          : [];
        const chainState = items.find(
          (item) => String(item?.tokenSymbol || "") === "__chain__",
        );
        const nextHeight = Number(chainState?.lastBlockHeight);
        const nextTargetHeight = Number(result.payload?.chainHeadBlockHeight);
        const nextUpdatedAt = chainState?.updatedAt
          ? new Date(chainState.updatedAt).getTime()
          : null;

        setBlockSyncHeight(Number.isFinite(nextHeight) ? nextHeight : null);
        setBlockSyncTargetHeight(
          Number.isFinite(nextTargetHeight) ? nextTargetHeight : null,
        );
        setBlockSyncUpdatedAt(
          Number.isFinite(nextUpdatedAt) ? nextUpdatedAt : null,
        );
      } else {
        setLastApiError(
          buildApiErrorRecord(
            result,
            "sync-status",
            "Sync status request failed",
          ),
        );
      }

      timeoutId = window.setTimeout(
        fetchSyncStatus,
        MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS,
      );
    }

    fetchSyncStatus().catch((error) => {
      if (!isActive) return;
      setLastApiError(
        buildApiErrorRecord(error, "sync-status", "Sync status request failed"),
      );
      setBlockSyncHeight(null);
      setBlockSyncTargetHeight(null);
      setBlockSyncUpdatedAt(null);
      timeoutId = window.setTimeout(
        fetchSyncStatus,
        MAPS_API_SYNC_STATUS_POLL_INTERVAL_MS,
      );
    });

    return () => {
      isActive = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    setBlockSyncHeight,
    setBlockSyncTargetHeight,
    setBlockSyncUpdatedAt,
    setLastApiError,
  ]);
}

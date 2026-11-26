import { useEffect } from "react";
import {
  fetchTokenSnapshot,
  mergeSnapshotIntoHistory,
  normalizeTokenSnapshot,
} from "../graph/tokenSnapshots";
import {
  MAPS_API_BASE_URL,
  MAPS_API_REQUEST_TIMEOUT_MS,
} from "../config/appConfig";
import {
  buildApiErrorRecord,
  buildTokenNotFoundStatus,
} from "../api/apiErrors";

export default function useCompareSnapshot({
  compareTokenSymbol,
  setCompareSnapshotStatus,
  setLastApiError,
  setTokenSnapshotHistory,
  setTokenSnapshots,
}) {
  useEffect(() => {
    let isMounted = true;

    async function ensureCompareSnapshot() {
      const compareKey = String(compareTokenSymbol || "").trim();
      if (!compareKey) {
        setCompareSnapshotStatus("");
        return;
      }

      setCompareSnapshotStatus(`Loading ${compareKey} snapshot...`);

      const result = await fetchTokenSnapshot(
        MAPS_API_BASE_URL,
        MAPS_API_REQUEST_TIMEOUT_MS,
        compareKey,
      );

      if (!isMounted) return;

      if (result.snapshot) {
        setTokenSnapshots((current) => ({
          ...current,
          [compareKey]:
            normalizeTokenSnapshot(result.snapshot) || result.snapshot,
        }));
        setTokenSnapshotHistory((current) =>
          mergeSnapshotIntoHistory(current, compareKey, result.snapshot),
        );
        setCompareSnapshotStatus(
          result.fallbackUsed ? "Using fallback snapshot data." : "",
        );
        return;
      }

      if (result.isTokenNotFound) {
        setLastApiError(
          buildApiErrorRecord(
            result.error,
            "snapshot",
            "Token snapshot is not available in the database",
          ),
        );
        setCompareSnapshotStatus(
          buildTokenNotFoundStatus(compareKey, result.error),
        );
        return;
      }

      setCompareSnapshotStatus(`Unable to load ${compareKey} snapshot.`);
    }

    ensureCompareSnapshot().catch(() => {
      if (!isMounted) return;
      const compareKey = String(compareTokenSymbol || "").trim();
      if (!compareKey) return;
      setCompareSnapshotStatus(`Unable to load ${compareKey} snapshot.`);
    });

    return () => {
      isMounted = false;
    };
  }, [
    compareTokenSymbol,
    setCompareSnapshotStatus,
    setLastApiError,
    setTokenSnapshotHistory,
    setTokenSnapshots,
  ]);
}

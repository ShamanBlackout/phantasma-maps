import { useEffect } from "react";

export default function useMapLoadingPhase({
  isMapLoaderVisible,
  mapLoadingDisplayedPhase,
  mapLoadingPhaseShownAtRef,
  mapLoadingPhaseTarget,
  mapLoadingProfile,
  setMapLoadingDisplayedPhase,
}) {
  useEffect(() => {
    if (!isMapLoaderVisible) {
      mapLoadingPhaseShownAtRef.current = 0;
      setMapLoadingDisplayedPhase("balances");
      return undefined;
    }

    const phaseOrder = ["balances", "addresses", "topology", "ready"];
    const currentIndex = phaseOrder.indexOf(mapLoadingDisplayedPhase);
    const targetIndex = phaseOrder.indexOf(mapLoadingPhaseTarget);

    if (targetIndex === -1 || currentIndex === -1) {
      setMapLoadingDisplayedPhase(mapLoadingPhaseTarget);
      mapLoadingPhaseShownAtRef.current = Date.now();
      return undefined;
    }

    if (targetIndex <= currentIndex) {
      if (targetIndex < currentIndex) {
        setMapLoadingDisplayedPhase(mapLoadingPhaseTarget);
        mapLoadingPhaseShownAtRef.current = Date.now();
      }
      return undefined;
    }

    const now = Date.now();
    const shownAt = mapLoadingPhaseShownAtRef.current || now;
    if (!mapLoadingPhaseShownAtRef.current) {
      mapLoadingPhaseShownAtRef.current = now;
    }
    const elapsedMs = now - shownAt;
    const waitMs = Math.max(0, mapLoadingProfile.phaseMinVisibleMs - elapsedMs);

    if (waitMs === 0) {
      setMapLoadingDisplayedPhase(mapLoadingPhaseTarget);
      mapLoadingPhaseShownAtRef.current = Date.now();
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setMapLoadingDisplayedPhase(mapLoadingPhaseTarget);
      mapLoadingPhaseShownAtRef.current = Date.now();
    }, waitMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    isMapLoaderVisible,
    mapLoadingDisplayedPhase,
    mapLoadingPhaseTarget,
    mapLoadingProfile.phaseMinVisibleMs,
    mapLoadingPhaseShownAtRef,
    setMapLoadingDisplayedPhase,
  ]);
}

import { useEffect } from "react";

export default function usePopoutDismissal({
  compareButtonRef,
  comparePopoutRef,
  diagnosticsButtonRef,
  diagnosticsPopoutRef,
  exportPresetsButtonRef,
  exportPresetsPopoutRef,
  isCompareModeOpen,
  isDiagnosticsOpen,
  isExportPresetsOpen,
  isSavedViewsOpen,
  savedViewsButtonRef,
  savedViewsPopoutRef,
  setIsCompareModeOpen,
  setIsDiagnosticsOpen,
  setIsExportPresetsOpen,
  setIsSavedViewsOpen,
}) {
  useEffect(() => {
    if (
      !isSavedViewsOpen &&
      !isCompareModeOpen &&
      !isDiagnosticsOpen &&
      !isExportPresetsOpen
    ) {
      return undefined;
    }

    function handlePointerDown(event) {
      const target = event.target;
      const popoutConfigs = [
        {
          isOpen: isSavedViewsOpen,
          popoutRef: savedViewsPopoutRef,
          triggerRef: savedViewsButtonRef,
          close: () => setIsSavedViewsOpen(false),
        },
        {
          isOpen: isCompareModeOpen,
          popoutRef: comparePopoutRef,
          triggerRef: compareButtonRef,
          close: () => setIsCompareModeOpen(false),
        },
        {
          isOpen: isDiagnosticsOpen,
          popoutRef: diagnosticsPopoutRef,
          triggerRef: diagnosticsButtonRef,
          close: () => setIsDiagnosticsOpen(false),
        },
        {
          isOpen: isExportPresetsOpen,
          popoutRef: exportPresetsPopoutRef,
          triggerRef: exportPresetsButtonRef,
          close: () => setIsExportPresetsOpen(false),
        },
      ];

      popoutConfigs.forEach((config) => {
        if (!config.isOpen) return;

        const isInsidePopout = config.popoutRef.current?.contains(target);
        const isOnTrigger = config.triggerRef.current?.contains(target);
        if (isInsidePopout || isOnTrigger) return;

        config.close();
      });
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [
    isCompareModeOpen,
    isDiagnosticsOpen,
    isExportPresetsOpen,
    isSavedViewsOpen,
    compareButtonRef,
    comparePopoutRef,
    diagnosticsButtonRef,
    diagnosticsPopoutRef,
    exportPresetsButtonRef,
    exportPresetsPopoutRef,
    savedViewsButtonRef,
    savedViewsPopoutRef,
    setIsCompareModeOpen,
    setIsDiagnosticsOpen,
    setIsExportPresetsOpen,
    setIsSavedViewsOpen,
  ]);
}

import { useState, useCallback } from 'react';

export type OverlayType = 'css-workshop' | 'prefetch-workshop' | null;

export function useOverlay() {
  const [currentOverlay, setCurrentOverlay] = useState<OverlayType>(null);

  const openOverlay = useCallback((overlayType: OverlayType) => {
    setCurrentOverlay(overlayType);
  }, []);

  const closeOverlay = useCallback(() => {
    setCurrentOverlay(null);
  }, []);

  const isOpen = useCallback((overlayType: OverlayType) => {
    return currentOverlay === overlayType;
  }, [currentOverlay]);

  return {
    currentOverlay,
    openOverlay,
    closeOverlay,
    isOpen
  };
}

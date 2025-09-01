import { useEffect, useRef } from 'react';
import type { OverlayType } from '@/hooks/useOverlay';
import type { ProjectFile, WorkshopMessage } from '@/types/workshop';
import CSSWorkshop from './CSSWorkshop';
import PrefetchWorkshop from './PrefetchWorkshop';

interface OverlaySystemProps {
  currentOverlay: OverlayType;
  onClose: () => void;
  files: ProjectFile[];
  sendMessage: (iframe: HTMLIFrameElement | null, message: WorkshopMessage) => void;
}

export default function OverlaySystem({ currentOverlay, onClose, files, sendMessage }: OverlaySystemProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && currentOverlay) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [currentOverlay, onClose]);

  // Handle overlay click outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!currentOverlay) return null;

  return (
    <div 
      ref={overlayRef}
      className="overlay"
      onClick={handleOverlayClick}
      data-testid="overlay-system"
    >
      {currentOverlay === 'css-workshop' && (
        <CSSWorkshop 
          files={files} 
          onClose={onClose} 
          sendMessage={sendMessage}
        />
      )}
      
      {currentOverlay === 'prefetch-workshop' && (
        <PrefetchWorkshop 
          files={files} 
          onClose={onClose} 
          sendMessage={sendMessage}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef } from 'react';
import type { WorkshopMessage } from '@/types/workshop';

export function useWorkshopMessage(onMessage?: (message: WorkshopMessage) => void) {
  const messageQueue = useRef<WorkshopMessage[]>([]);

  const sendMessage = useCallback((iframe: HTMLIFrameElement | null, message: WorkshopMessage) => {
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(message, '*');
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent<WorkshopMessage>) => {
    if (event.data && typeof event.data === 'object' && event.data.type) {
      messageQueue.current.push(event.data);
      onMessage?.(event.data);
    }
  }, [onMessage]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  return {
    sendMessage,
    messageQueue: messageQueue.current
  };
}

import { useEffect } from 'react';
import { useAuraStore } from '@/state/useAuraStore';

export function useViewport() {
  const updateViewport = useAuraStore((state) => state.updateViewport);

  useEffect(() => {
    const handleResize = () => {
      updateViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: Math.min(window.devicePixelRatio, 2),
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateViewport]);

  return useAuraStore((state) => state.viewport);
}

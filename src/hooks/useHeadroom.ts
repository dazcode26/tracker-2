import { useState, useEffect } from 'react';

export interface UseHeadroomOptions {
  /**
   * Scroll threshold in pixels before the toolbar becomes sticky.
   * Default: 10px
   */
  threshold?: number;
  /**
   * Minimum scroll delta in pixels (kept for interface compatibility).
   */
  delta?: number;
  /**
   * If true, keeps the toolbar visible regardless of scroll direction.
   */
  forceVisible?: boolean;
}

export interface UseHeadroomReturn {
  isSticky: boolean;
  isVisible: boolean;
}

/**
 * Hook to manage sticky toolbar behaviour:
 * Stays stuck at the top in all conditions (whether scrolling down or scrolling up),
 * never hiding out of view.
 */
export function useHeadroom({
  threshold = 10,
}: UseHeadroomOptions = {}): UseHeadroomReturn {
  const [isSticky, setIsSticky] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
      setIsSticky(currentScrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  return { isSticky, isVisible: true };
}


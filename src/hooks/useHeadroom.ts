import { useState, useEffect, useRef } from 'react';

export interface UseHeadroomOptions {
  /**
   * Scroll threshold in pixels before the toolbar becomes sticky.
   * Default: 50px
   */
  threshold?: number;
  /**
   * Minimum scroll delta in pixels before toggling visibility to prevent jitter.
   * Default: 6px
   */
  delta?: number;
  /**
   * If true, keeps the toolbar visible regardless of scroll direction (e.g. when menus or search are open).
   * Default: false
   */
  forceVisible?: boolean;
}

export interface UseHeadroomReturn {
  isSticky: boolean;
  isVisible: boolean;
}

/**
 * Custom hook to implement a "smart sticky header / headroom" pattern:
 * - When at the top of the page, the toolbar sits in its natural layout flow.
 * - When scrolling down, the toolbar hides out of view to maximize screen space.
 * - When scrolling up, the toolbar immediately reappears and sticks to the top.
 */
export function useHeadroom({
  threshold = 50,
  delta = 6,
  forceVisible = false,
}: UseHeadroomOptions = {}): UseHeadroomReturn {
  const [isSticky, setIsSticky] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const lastScrollY = useRef<number>(0);
  const ticking = useRef<boolean>(false);

  // If forceVisible becomes true, immediately show the toolbar
  useEffect(() => {
    if (forceVisible) {
      setIsVisible(true);
    }
  }, [forceVisible]);

  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return;

      ticking.current = true;
      window.requestAnimationFrame(() => {
        const currentScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
        const prevScrollY = lastScrollY.current;
        const scrollDiff = currentScrollY - prevScrollY;

        // When near the top of the page, return to natural unpinned flow
        if (currentScrollY <= threshold) {
          setIsSticky(false);
          setIsVisible(true);
        } else {
          setIsSticky(true);

          if (forceVisible) {
            setIsVisible(true);
          } else if (scrollDiff > delta) {
            // Scrolling down -> hide toolbar
            setIsVisible(false);
          } else if (scrollDiff < -delta) {
            // Scrolling up -> immediately reveal toolbar stuck on top!
            setIsVisible(true);
          }
        }

        lastScrollY.current = currentScrollY;
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold, delta, forceVisible]);

  return { isSticky, isVisible };
}

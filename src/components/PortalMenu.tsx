import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface PortalMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  triggerElement?: HTMLElement | null;
  children: React.ReactNode;
  align?: 'right' | 'left';
  className?: string;
}

export const PortalMenu: React.FC<PortalMenuProps> = ({
  isOpen,
  onClose,
  anchorRect,
  triggerElement,
  children,
  align = 'right',
  className = '',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRect) {
      setCoords(null);
      return;
    }

    const menuEl = menuRef.current;
    const menuHeight = menuEl ? menuEl.offsetHeight : 220;
    const menuWidth = menuEl ? menuEl.offsetWidth : 180;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Check vertical space: if not enough room below, open above
    const spaceBelow = viewportHeight - anchorRect.bottom;
    const openUpwards = spaceBelow < menuHeight + 16 && anchorRect.top > menuHeight + 16;

    const newCoords: { top?: number; bottom?: number; left?: number; right?: number } = {};

    if (openUpwards) {
      newCoords.bottom = Math.max(8, viewportHeight - anchorRect.top + 6);
    } else {
      newCoords.top = Math.max(8, anchorRect.bottom + 6);
    }

    if (align === 'right') {
      const rightDistance = viewportWidth - anchorRect.right;
      // Make sure it doesn't overflow the left edge of screen
      if (viewportWidth - rightDistance - menuWidth < 8) {
        newCoords.left = 8;
      } else {
        newCoords.right = Math.max(8, rightDistance);
      }
    } else {
      const leftDistance = anchorRect.left;
      if (leftDistance + menuWidth > viewportWidth - 8) {
        newCoords.right = 8;
      } else {
        newCoords.left = Math.max(8, leftDistance);
      }
    }

    setCoords(newCoords);
  }, [isOpen, anchorRect, align]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      if (triggerElement && triggerElement.contains(target)) {
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen, onClose, triggerElement]);

  if (!isOpen || !anchorRect) return null;

  return createPortal(
    <div
      ref={menuRef}
      data-popover-root
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: coords?.top !== undefined ? `${coords.top}px` : undefined,
        bottom: coords?.bottom !== undefined ? `${coords.bottom}px` : undefined,
        left: coords?.left !== undefined ? `${coords.left}px` : undefined,
        right: coords?.right !== undefined ? `${coords.right}px` : undefined,
        visibility: coords ? 'visible' : 'hidden',
      }}
      className={`bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1.5 text-xs animate-in fade-in duration-100 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
};

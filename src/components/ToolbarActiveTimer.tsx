import React, { useState, useEffect } from 'react';
import { Square } from 'lucide-react';
import { AppData, ItemNode } from '../types';
import { findItemById } from '../utils/treeUtils';

interface ToolbarActiveTimerProps {
  appData?: AppData;
  onStopTimer?: () => void;
  onOpenItemModal?: (item: ItemNode) => void;
  className?: string;
}

const formatTimerClock = (totalSec: number): string => {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const hh = String(hrs).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

export const ToolbarActiveTimer: React.FC<ToolbarActiveTimerProps> = ({
  appData,
  onStopTimer,
  onOpenItemModal,
  className = '',
}) => {
  const activeTimer = appData?.settings?.activeTimer;
  const activeItemInfo = activeTimer && appData ? findItemById(appData, activeTimer.itemId) : null;
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Active timer live tick effect
  useEffect(() => {
    if (!activeTimer) {
      setElapsedSeconds(0);
      return;
    }
    const updateElapsed = () => {
      const startTime = new Date(activeTimer.startedAt).getTime();
      const nowTime = Date.now();
      const diffSec = Math.max(0, Math.floor((nowTime - startTime) / 1000));
      setElapsedSeconds(diffSec);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!activeTimer || !activeItemInfo) return null;

  const item = activeItemInfo.item;

  return (
    <div
      className={`h-8 px-2 sm:px-2.5 rounded-lg border border-orange-500/35 bg-orange-500/10 [data-theme=light]:bg-orange-50 [data-theme=light]:border-orange-300 flex items-center gap-1.5 sm:gap-2 text-xs select-none max-w-[240px] xl:max-w-[300px] shrink-0 ${className}`}
      title={`Active Timer: ${item.name} (${formatTimerClock(elapsedSeconds)})`}
    >
      {/* Live Pulsing Dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
      </span>

      {/* Task Name Button */}
      <button
        type="button"
        onClick={() => onOpenItemModal && onOpenItemModal(item)}
        className="font-semibold text-xs text-[#f4f4f5] [data-theme=light]:text-slate-900 truncate max-w-[90px] xl:max-w-[140px] hover:underline cursor-pointer text-left shrink"
        title={`Task: ${item.name} (Click to open details)`}
      >
        {item.icon && <span className="mr-1 shrink-0">{item.icon}</span>}
        <span className="truncate">{item.name}</span>
      </button>

      {/* Subtle Separator */}
      <span className="text-orange-500/40 [data-theme=light]:text-orange-400/50 text-[10px] select-none shrink-0">
        |
      </span>

      {/* Live Clock */}
      <span
        className="font-mono font-bold text-xs text-orange-400 [data-theme=light]:text-orange-600 tracking-wider shrink-0"
        title="Elapsed time"
      >
        {formatTimerClock(elapsedSeconds)}
      </span>

      {/* Stop Button */}
      {onStopTimer && (
        <button
          type="button"
          onClick={onStopTimer}
          className="w-5 h-5 rounded flex items-center justify-center bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all cursor-pointer shrink-0 ml-0.5"
          title="Stop & save timer"
          aria-label="Stop timer"
        >
          <Square className="w-2 h-2 fill-current" />
        </button>
      )}
    </div>
  );
};

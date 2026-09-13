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
  const isLight = appData?.settings?.theme === 'light';

  return (
    <div
      id="toolbar-active-timer"
      className={`toolbar-active-timer h-8 px-2 sm:px-2.5 rounded-lg border flex items-center gap-1.5 sm:gap-2 text-xs select-none max-w-[320px] lg:max-w-[420px] xl:max-w-[580px] 2xl:max-w-[760px] shrink min-w-0 transition-colors ${
        isLight
          ? 'bg-orange-50/90 border-orange-300/80 shadow-xs'
          : 'border-orange-500/35 bg-orange-500/10'
      } ${className}`}
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
        className={`toolbar-timer-task-name font-semibold text-xs truncate max-w-[180px] lg:max-w-[260px] xl:max-w-[420px] 2xl:max-w-[600px] hover:underline cursor-pointer text-left shrink min-w-0 ${
          isLight ? 'text-slate-900 hover:text-orange-600' : 'text-[#f4f4f5] hover:text-orange-300'
        }`}
        title={`Task: ${item.name} (Click to open details)`}
      >
        {item.icon && <span className="mr-1 shrink-0">{item.icon}</span>}
        <span className="truncate">{item.name}</span>
      </button>

      {/* Subtle Separator */}
      <span
        className={`text-[10px] select-none shrink-0 ${
          isLight ? 'text-orange-400' : 'text-orange-500/40'
        }`}
      >
        |
      </span>

      {/* Live Clock */}
      <span
        className={`font-mono font-bold text-xs tracking-wider shrink-0 ${
          isLight ? 'text-orange-600' : 'text-orange-400'
        }`}
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

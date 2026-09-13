import React, { useState, useEffect } from 'react';
import { Square, ArrowUpRight } from 'lucide-react';
import { AppData, ItemNode } from '../types';
import { findItemById } from '../utils/treeUtils';

interface ActiveTimerBannerProps {
  appData: AppData;
  onStopTimer: () => void;
  onOpenItemModal?: (item: ItemNode) => void;
  hideOnLg?: boolean;
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

export const ActiveTimerBanner: React.FC<ActiveTimerBannerProps> = ({
  appData,
  onStopTimer,
  onOpenItemModal,
  hideOnLg = false,
}) => {
  const activeTimer = appData.settings.activeTimer;
  const activeItemInfo = activeTimer ? findItemById(appData, activeTimer.itemId) : null;
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
  const isLight = appData.settings.theme === 'light';

  return (
    <div
      id="active-timer-banner"
      className={`active-timer-banner sticky top-0 w-full shrink-0 border-b transition-colors z-50 flex items-center justify-center px-4 h-9 select-none animate-in fade-in slide-in-from-top-2 duration-200 ${
        isLight
          ? 'bg-[#fff7ed] border-orange-200/80 text-slate-900 shadow-xs'
          : 'bg-[#161619] border-orange-500/30 text-[#f4f4f5]'
      } ${hideOnLg ? 'lg:hidden' : ''}`}
      style={{
        borderColor: isLight
          ? 'rgba(249, 115, 22, 0.35)'
          : 'var(--accent-subtle-border, rgba(249, 115, 22, 0.40))',
      }}
    >
      {/* Centered Cluster: Task Name, Clock, and Stop Icon Button */}
      <div className="flex items-center justify-center gap-2.5 sm:gap-3 max-w-full truncate px-2">
        {/* Task Name */}
        <button
          type="button"
          onClick={() => onOpenItemModal && onOpenItemModal(item)}
          className={`active-timer-task-name text-xs font-semibold truncate hover:underline text-left cursor-pointer flex items-center gap-1 max-w-[180px] sm:max-w-[320px] md:max-w-[480px] ${
            isLight
              ? 'text-slate-900 hover:text-orange-600'
              : 'text-[#f4f4f5] hover:text-orange-300'
          } ${onOpenItemModal ? 'group' : ''}`}
          title={`Task: ${item.name} (Click to open details)`}
        >
          {item.icon && <span className="text-xs shrink-0">{item.icon}</span>}
          <span className="truncate">{item.name}</span>
          {onOpenItemModal && (
            <ArrowUpRight
              className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${
                isLight ? 'text-slate-500' : 'text-[#a1a1aa]'
              }`}
            />
          )}
        </button>

        {/* Subtle Separator Dot */}
        <span
          className={`active-timer-sep text-xs shrink-0 select-none ${
            isLight ? 'text-slate-400' : 'text-[#71717a]'
          }`}
        >
          ·
        </span>

        {/* Raw Live Digital Clock (No badge / box border) */}
        <span
          className={`text-xs sm:text-sm font-mono font-bold tracking-wider shrink-0 ${
            isLight ? 'text-orange-600' : 'text-orange-400'
          }`}
          style={{
            color: isLight ? '#ea580c' : 'var(--accent-text, #fb923c)',
          }}
          title="Elapsed session time"
        >
          {formatTimerClock(elapsedSeconds)}
        </span>

        {/* Stop Button: Square Icon Only (No 'Stop & Save' text) */}
        <button
          type="button"
          onClick={onStopTimer}
          className="w-6 h-6 rounded-md text-white transition-all flex items-center justify-center shadow-xs cursor-pointer shrink-0 hover:opacity-90 hover:scale-105 active:scale-95 bg-orange-500 hover:bg-orange-600"
          title="Stop timer & log session"
          aria-label="Stop timer and log session"
        >
          <Square className="w-2.5 h-2.5 fill-current" />
        </button>
      </div>
    </div>
  );
};

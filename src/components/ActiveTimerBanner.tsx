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

const formatSessionTime = (totalSec: number): string => {
  if (totalSec < 60) {
    return `${totalSec} s`;
  }
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (totalSec < 3600) {
    return `${mins} min ${secs} s`;
  }
  const hrs = Math.floor(totalSec / 3600);
  const remMins = mins % 60;
  return `${hrs} h ${remMins} min ${secs} s`;
};

export const ActiveTimerBanner: React.FC<ActiveTimerBannerProps> = ({
  appData,
  onStopTimer,
  onOpenItemModal,
  hideOnLg = false,
}) => {
  const activeTimer = appData.settings.activeTimer;
  const activeItemInfo = activeTimer ? findItemById(appData, activeTimer.itemId) : null;
  const [, setTick] = useState<number>(0);

  // Active timer live tick effect
  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!activeTimer || !activeItemInfo) return null;

  const item = activeItemInfo.item;
  const isLight = appData.settings.theme === 'light';

  // Calculate live session duration in seconds
  const sessionSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000)
  );
  const formattedSessionTime = formatSessionTime(sessionSec);

  return (
    <div
      id="active-timer-banner"
      className={`active-timer-banner sticky top-0 w-full shrink-0 border-b transition-colors z-50 flex items-center justify-center px-4 h-9 select-none animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden relative ${
        isLight
          ? 'bg-white border-slate-300/80 text-slate-900'
          : 'bg-[#101010] border-[#27272a] text-[#f4f4f5]'
      } ${hideOnLg ? 'lg:hidden' : ''}`}
      style={{
        borderColor: 'var(--accent-subtle-border, rgba(59, 130, 246, 0.4))',
        backgroundColor: isLight ? '#ffffff' : '#101010',
      }}
    >
      {/* Subtle accent tint overlay over solid background to prevent scroll text bleed */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundColor: 'var(--accent-subtle-bg, rgba(59, 130, 246, 0.12))',
        }}
      />

      {/* Centered Cluster: Task Name, Clock, and Stop Button */}
      <div className="relative z-10 flex items-center justify-center gap-2.5 sm:gap-3 max-w-full truncate px-2">
        {/* Task Name */}
        <button
          type="button"
          onClick={() => onOpenItemModal && onOpenItemModal(item)}
          className={`active-timer-task-name text-xs font-semibold truncate hover:underline text-left cursor-pointer flex items-center gap-1 max-w-[180px] sm:max-w-[320px] md:max-w-[480px] ${
            isLight
              ? 'text-slate-900 hover:text-slate-700'
              : 'text-[#f4f4f5] hover:text-white'
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

        {/* Separator | using theme accent */}
        <span
          className="text-[11px] font-bold shrink-0 select-none opacity-60"
          style={{ color: 'var(--accent-main, #3b82f6)' }}
        >
          |
        </span>

        {/* Live Clock with pulsing effect matching TreeView */}
        <span
          className="font-mono text-[11px] font-bold whitespace-nowrap shrink-0 animate-pulse"
          style={{
            color: 'var(--accent-text, #3b82f6)',
          }}
          title="Elapsed session time"
        >
          {formattedSessionTime}
        </span>

        {/* Compact Red Pill Stop Button */}
        <button
          type="button"
          onClick={onStopTimer}
          className="h-5 px-2 rounded-full bg-[#ef4444] hover:bg-red-600 text-white text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
          title="Stop timer & log session"
          aria-label="Stop timer and log session"
        >
          <Square className="w-2 h-2 fill-current" />
          <span className="leading-none">Stop</span>
        </button>
      </div>
    </div>
  );
};

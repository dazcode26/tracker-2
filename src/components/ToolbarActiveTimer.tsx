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

export const ToolbarActiveTimer: React.FC<ToolbarActiveTimerProps> = ({
  appData,
  onStopTimer,
  onOpenItemModal,
  className = '',
}) => {
  const activeTimer = appData?.settings?.activeTimer;
  const activeItemInfo = activeTimer && appData ? findItemById(appData, activeTimer.itemId) : null;
  const [, setTick] = useState<number>(0);

  // Active timer live tick effect every 1s
  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!activeTimer || !activeItemInfo || !appData) return null;

  const item = activeItemInfo.item;
  const isLight = appData.settings?.theme === 'light';

  // Calculate live session duration in seconds
  const sessionSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000)
  );
  const formattedSessionTime = formatSessionTime(sessionSec);

  return (
    <div
      id="toolbar-active-timer"
      className={`toolbar-active-timer h-7 pl-2.5 pr-1 rounded-full border flex items-center gap-1.5 sm:gap-2 text-xs select-none max-w-[320px] lg:max-w-[420px] xl:max-w-[580px] 2xl:max-w-[760px] shrink min-w-0 transition-colors ${className}`}
      style={{
        borderColor: 'var(--accent-subtle-border, rgba(59, 130, 246, 0.4))',
        backgroundColor: 'var(--accent-subtle-bg, rgba(59, 130, 246, 0.12))',
      }}
      title={`Active Session: ${item.name} (${formattedSessionTime})`}
    >
      {/* Live Pulsing Dot matching theme accent */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: 'var(--accent-main, #3b82f6)' }}
        />
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: 'var(--accent-main, #3b82f6)' }}
        />
      </span>

      {/* Task Name Button */}
      <button
        type="button"
        onClick={() => onOpenItemModal && onOpenItemModal(item)}
        className={`toolbar-timer-task-name font-semibold text-xs truncate max-w-[160px] lg:max-w-[240px] xl:max-w-[380px] 2xl:max-w-[550px] hover:underline cursor-pointer text-left shrink min-w-0 ${
          isLight ? 'text-slate-900 hover:text-slate-700' : 'text-[#f4f4f5] hover:text-white'
        }`}
        title={`Task: ${item.name} (Click to open details)`}
      >
        {item.icon && <span className="mr-1 shrink-0">{item.icon}</span>}
        <span className="truncate">{item.name}</span>
      </button>

      {/* Dynamic Separator | using theme accent */}
      <span
        className="text-[11px] font-bold select-none shrink-0 opacity-60"
        style={{ color: 'var(--accent-main, #3b82f6)' }}
      >
        |
      </span>

      {/* Live Clock matching TreeView font size and pulse animation */}
      <span
        className="font-mono text-[11px] font-bold whitespace-nowrap shrink-0 animate-pulse"
        style={{ color: 'var(--accent-text, #3b82f6)' }}
        title="Session duration"
      >
        {formattedSessionTime}
      </span>

      {/* Compact Red Pill Stop Button with equalized top/bottom/right spacing */}
      {onStopTimer && (
        <button
          type="button"
          onClick={onStopTimer}
          className="h-5 px-2 rounded-full bg-[#ef4444] hover:bg-red-600 text-white text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0 ml-0.5"
          title="Stop timer & log session"
          aria-label="Stop timer"
        >
          <Square className="w-2 h-2 fill-current" />
          <span className="leading-none">Stop</span>
        </button>
      )}
    </div>
  );
};

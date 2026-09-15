import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle2,
  Folder,
  Flag,
  ChevronsDown,
  ChevronsUp,
  CalendarRange,
  CalendarDays,
  X,
  Check,
  MoreHorizontal,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react';
import { TimeBasedToolbar } from './TimeBasedToolbar';
import { AppData, ItemNode, ItemStatus, ProjectNode, Session } from '../types';
import {
  getVisibleFlatItems,
  getLeafFlatItems,
  formatDuration,
  getItemLoggedSeconds,
  getRealizationDatesForTree,
  getRealizationDatesForProject,
  getStatusConfig,
} from '../utils/treeUtils';

type TimeScale = 'month' | 'week' | 'day' | 'year';

interface RealizationSegment {
  id: string;
  startDate: Date;
  endDate: Date;
  loggedSeconds: number;
  sessionTitle?: string;
  status: ItemStatus;
  isSession: boolean;
  mergedCount?: number;
}

const ONE_HOUR_MS = 60 * 60 * 1000; // 1-hour tolerance for merging nearby session bars (3,600,000 ms)

const hexToRgba = (hex?: string, alpha: number = 0.5): string => {
  if (!hex || !hex.startsWith('#')) return `rgba(249, 115, 22, ${alpha})`;
  const c = hex.replace('#', '');
  if (c.length !== 6 && c.length !== 3) return `rgba(249, 115, 22, ${alpha})`;
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(249, 115, 22, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getProjectCardStyle = (projectColor?: string) => {
  const color = projectColor || '#f97316';
  return {
    backgroundColor: hexToRgba(color, 0.5),
    borderColor: color,
  };
};

// Helper to generate solid (opaque) 20% tint of a hex color blended onto white (#ffffff)
const getSolid20PercentTint = (hex?: string): string => {
  if (!hex || !hex.startsWith('#')) return '#f3f4f6';
  const c = hex.replace('#', '');
  if (c.length !== 6 && c.length !== 3) return '#f3f4f6';
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#f3f4f6';
  // 20% project color + 80% white (r: 255, g: 255, b: 255) - solid, zero transparency
  const r20 = Math.round(r * 0.2 + 255 * 0.8);
  const g20 = Math.round(g * 0.2 + 255 * 0.8);
  const b20 = Math.round(b * 0.2 + 255 * 0.8);
  return `rgb(${r20}, ${g20}, ${b20})`;
};

export const getTaskStatusPercentage = (item: ItemNode): number => {
  if (item.status === 'completed') return 100;
  if (item.subItems && item.subItems.length > 0) {
    const leafTasks = getLeafFlatItems([{ id: 'temp', type: 'project-node', title: '', items: [item], status: 'active' }]);
    if (leafTasks.length > 0) {
      const doneCount = leafTasks.filter((t) => t.item.status === 'completed').length;
      return Math.round((doneCount / leafTasks.length) * 100);
    }
  }
  if (item.status === 'review') return 80;
  if (item.status === 'in-progress') return 50;
  return 0;
};

/**
 * Merges realization segments that overlap or have a gap of less than 1 hour (< 3,600,000 ms).
 */
export const mergeAdjacentSegments = (
  segments: RealizationSegment[],
  gapToleranceMs: number = ONE_HOUR_MS
): RealizationSegment[] => {
  if (segments.length <= 1) return segments;

  // Sort by startDate ascending
  const sorted = [...segments].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  const merged: RealizationSegment[] = [];
  let current: RealizationSegment = {
    ...sorted[0],
    mergedCount: sorted[0].mergedCount || 1,
  };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentEndMs = current.endDate.getTime();
    const nextStartMs = next.startDate.getTime();

    // Check if next segment overlaps or gap is less than the 1-hour tolerance
    if (nextStartMs <= currentEndMs + gapToleranceMs) {
      // Overlapping or within 1 hour gap -> Merge!
      const newEndMs = Math.max(currentEndMs, next.endDate.getTime());
      current.endDate = new Date(newEndMs);
      current.loggedSeconds += next.loggedSeconds;
      current.mergedCount = (current.mergedCount || 1) + (next.mergedCount || 1);

      if (next.status === 'in-progress' || current.status === 'in-progress') {
        current.status = 'in-progress';
      }
      current.isSession = current.isSession || next.isSession;
      current.sessionTitle = `${current.mergedCount} Sessions`;
      current.id = `${current.id}_${next.id}`;
    } else {
      merged.push(current);
      current = {
        ...next,
        mergedCount: next.mergedCount || 1,
      };
    }
  }
  merged.push(current);

  return merged;
};

/**
 * Consolidates segments at day-level resolution for Month and Week views.
 * Merges overlapping or consecutive/adjacent day segments seamlessly.
 */
export const consolidateDaySegments = (
  rawSegments: { seg: RealizationSegment; startCol: number; endCol: number }[],
  totalCols: number
): { seg: RealizationSegment; leftPct: number; widthPct: number }[] => {
  if (rawSegments.length === 0) return [];

  // Sort by startCol then endCol
  const sorted = [...rawSegments].sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
  const result: { seg: RealizationSegment; leftPct: number; widthPct: number }[] = [];

  let current = { ...sorted[0] };
  let mergedLoggedSec = current.seg.loggedSeconds;
  let mergedCount = current.seg.mergedCount || 1;
  let minStart = current.seg.startDate;
  let maxEnd = current.seg.endDate;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    // If overlapping in the same day column(s) OR adjacent days (next.startCol <= current.endCol + 1)
    if (next.startCol <= current.endCol + 1) {
      current.endCol = Math.max(current.endCol, next.endCol);
      mergedLoggedSec += next.seg.loggedSeconds;
      mergedCount += (next.seg.mergedCount || 1);
      if (next.seg.startDate.getTime() < minStart.getTime()) {
        minStart = next.seg.startDate;
      }
      if (next.seg.endDate.getTime() > maxEnd.getTime()) {
        maxEnd = next.seg.endDate;
      }
    } else {
      const spanCols = current.endCol - current.startCol + 1;
      const spanWidthPct = (spanCols / totalCols) * 100;
      const widthPct = spanWidthPct * 0.9;
      const leftPct = (current.startCol / totalCols) * 100 + spanWidthPct * 0.05;
      result.push({
        seg: {
          ...current.seg,
          startDate: minStart,
          endDate: maxEnd,
          loggedSeconds: mergedLoggedSec,
          mergedCount: mergedCount > 1 ? mergedCount : undefined,
          sessionTitle: mergedCount > 1 ? `${mergedCount} Sessions` : current.seg.sessionTitle,
        },
        leftPct,
        widthPct,
      });

      current = { ...next };
      mergedLoggedSec = next.seg.loggedSeconds;
      mergedCount = next.seg.mergedCount || 1;
      minStart = next.seg.startDate;
      maxEnd = next.seg.endDate;
    }
  }

  const spanCols = current.endCol - current.startCol + 1;
  const spanWidthPct = (spanCols / totalCols) * 100;
  const widthPct = spanWidthPct * 0.9;
  const leftPct = (current.startCol / totalCols) * 100 + spanWidthPct * 0.05;
  result.push({
    seg: {
      ...current.seg,
      startDate: minStart,
      endDate: maxEnd,
      loggedSeconds: mergedLoggedSec,
      mergedCount: mergedCount > 1 ? mergedCount : undefined,
      sessionTitle: mergedCount > 1 ? `${mergedCount} Sessions` : current.seg.sessionTitle,
    },
    leftPct,
    widthPct,
  });

  return result;
};

interface TimelineViewProps {
  appData: AppData;
  onOpenEditItemModal?: (item: any) => void;
  onStopTimer?: () => void;
  onOpenProjectModal?: (project: ProjectNode) => void;
  onOpenAddItemModal?: (parentId?: string, projectId?: string) => void;
  onToggleExpand?: (itemId: string, projectId: string) => void;
  onSetAllExpand?: (expand: boolean) => void;
  selectedProjectId?: string;
  onSelectProjectFilter?: (projectId: string) => void;
  selectedPersonId?: string;
  onSelectPersonFilter?: (personId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  timeScale?: TimeScale;
  onTimeScaleChange?: (scale: TimeScale) => void;
  currentDate?: Date;
  onCurrentDateChange?: (date: Date) => void;
  showWeekends?: boolean;
  onShowWeekendsChange?: (show: boolean) => void;
  showCompleted?: boolean;
  onShowCompletedChange?: (show: boolean) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  appData,
  onOpenEditItemModal,
  onStopTimer,
  onOpenProjectModal,
  onOpenAddItemModal,
  onToggleExpand,
  onSetAllExpand,
  selectedProjectId = 'all',
  onSelectProjectFilter,
  selectedPersonId = 'all',
  onSelectPersonFilter,
  searchQuery = '',
  onSearchChange,
  timeScale: controlledTimeScale,
  onTimeScaleChange,
  currentDate: controlledCurrentDate,
  onCurrentDateChange,
  showWeekends: controlledShowWeekends,
  onShowWeekendsChange,
  showCompleted: controlledShowCompleted,
  onShowCompletedChange,
}) => {
  // Timeline Zoom / Scale Mode: 'month' | 'week' | 'day' | 'year'
  const [internalTimeScale, setInternalTimeScale] = useState<TimeScale>(() => {
    try {
      const saved =
        localStorage.getItem('struktur_filter_timescale') ||
        localStorage.getItem('struktur_timeline_timescale') ||
        localStorage.getItem('struktur_calendar_viewtype');
      if (saved && ['month', 'week', 'day', 'year'].includes(saved)) {
        return saved as TimeScale;
      }
    } catch {
      // ignore
    }
    return 'month';
  });

  const timeScale = controlledTimeScale !== undefined ? controlledTimeScale : internalTimeScale;

  const setTimeScale = (newScale: TimeScale) => {
    if (onTimeScaleChange) {
      onTimeScaleChange(newScale);
    }
    setInternalTimeScale(newScale);
    try {
      localStorage.setItem('struktur_filter_timescale', newScale);
      localStorage.setItem('struktur_timeline_timescale', newScale);
      localStorage.setItem('struktur_calendar_viewtype', newScale);
    } catch {
      // ignore
    }
  };

  // Show Weekends & Show Completed filters with localStorage persistence
  const [internalShowWeekends, setInternalShowWeekends] = useState<boolean>(() => {
    try {
      const saved =
        localStorage.getItem('struktur_filter_show_weekends') ??
        localStorage.getItem('struktur_calendar_show_weekends');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return true;
  });

  const showWeekends = controlledShowWeekends !== undefined ? controlledShowWeekends : internalShowWeekends;

  const setShowWeekends = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(showWeekends) : val;
    if (onShowWeekendsChange) {
      onShowWeekendsChange(nextVal);
    }
    setInternalShowWeekends(nextVal);
    try {
      localStorage.setItem('struktur_filter_show_weekends', String(nextVal));
      localStorage.setItem('struktur_calendar_show_weekends', String(nextVal));
    } catch {
      // ignore
    }
  };

  const [internalShowCompleted, setInternalShowCompleted] = useState<boolean>(() => {
    try {
      const saved =
        localStorage.getItem('struktur_filter_show_completed') ??
        localStorage.getItem('struktur_calendar_show_completed');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return true;
  });

  const showCompleted = controlledShowCompleted !== undefined ? controlledShowCompleted : internalShowCompleted;

  const setShowCompleted = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(showCompleted) : val;
    if (onShowCompletedChange) {
      onShowCompletedChange(nextVal);
    }
    setInternalShowCompleted(nextVal);
    try {
      localStorage.setItem('struktur_filter_show_completed', String(nextVal));
      localStorage.setItem('struktur_calendar_show_completed', String(nextVal));
    } catch {
      // ignore
    }
  };

  // Project collapse state in timeline (synced with localStorage)
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(() => {
    try {
      const saved =
        localStorage.getItem('struktur_timeline_collapsed_projects') ||
        localStorage.getItem('tracker_timeline_collapsed_projects') ||
        localStorage.getItem('struktur_tree_collapsed_projects');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {
      // ignore
    }
    return new Set();
  });

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      try {
        const arr = Array.from(next);
        localStorage.setItem('struktur_timeline_collapsed_projects', JSON.stringify(arr));
        localStorage.setItem('tracker_timeline_collapsed_projects', JSON.stringify(arr));
      } catch {}
      return next;
    });
  };

  // Expand / collapse all projects and tasks
  const handleExpandAll = () => {
    const nextSet = new Set<string>();
    setCollapsedProjectIds(nextSet);
    try {
      localStorage.setItem('struktur_timeline_collapsed_projects', JSON.stringify([]));
      localStorage.setItem('tracker_timeline_collapsed_projects', JSON.stringify([]));
    } catch {}
    if (onSetAllExpand) {
      onSetAllExpand(true);
    }
  };

  const handleCollapseAll = () => {
    const nextSet = new Set(activeProjects.map((p) => p.id));
    setCollapsedProjectIds(nextSet);
    try {
      localStorage.setItem('struktur_timeline_collapsed_projects', JSON.stringify(Array.from(nextSet)));
      localStorage.setItem('tracker_timeline_collapsed_projects', JSON.stringify(Array.from(nextSet)));
    } catch {}
    if (onSetAllExpand) {
      onSetAllExpand(false);
    }
  };

  // Reference Date for navigation (Defaults to today, synced with localStorage and shared prop)
  const [internalCurrentDate, setInternalCurrentDate] = useState<Date>(() => {
    try {
      const saved = localStorage.getItem('struktur_filter_current_date');
      if (saved) {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    } catch {
      // ignore
    }
    return new Date();
  });

  const currentDate = controlledCurrentDate !== undefined ? controlledCurrentDate : internalCurrentDate;

  const setCurrentDate = (d: Date | ((prev: Date) => Date)) => {
    const nextDate = typeof d === 'function' ? d(currentDate) : d;
    if (onCurrentDateChange) {
      onCurrentDateChange(nextDate);
    }
    setInternalCurrentDate(nextDate);
    try {
      localStorage.setItem('struktur_filter_current_date', nextDate.toISOString());
    } catch {
      // ignore
    }
  };
  const [filterMode, setFilterMode] = useState<'all' | 'realized-only'>(() => {
    try {
      const saved = localStorage.getItem('struktur_timeline_filter_mode');
      if (saved && ['all', 'realized-only'].includes(saved)) {
        return saved as 'all' | 'realized-only';
      }
    } catch {
      // ignore
    }
    return 'all';
  });

  useEffect(() => {
    try {
      localStorage.setItem('struktur_timeline_filter_mode', filterMode);
    } catch {
      // ignore
    }
  }, [filterMode]);

  // Hide inactive hours in Day view (00:00-06:00 and 20:00-00:00)
  const [hideInactiveHours, setHideInactiveHours] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('struktur_timeline_hide_inactive_hours');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('struktur_timeline_hide_inactive_hours', String(hideInactiveHours));
    } catch {
      // ignore
    }
  }, [hideInactiveHours]);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(() => new Date());
  const pickerRef = useRef<HTMLDivElement>(null);

  // Synchronize picker date when opened
  useEffect(() => {
    if (isDatePickerOpen) {
      setPickerDate(new Date(currentDate));
    }
  }, [isDatePickerOpen, currentDate]);

  // Click outside to close picker popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDatePickerOpen]);

  // Search & Project Filter State fallback
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const [internalSelectedProjectId, setInternalSelectedProjectId] = useState<string>('all');
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState<boolean>(false);
  const projectFilterRef = useRef<HTMLDivElement>(null);

  // View Switcher Dropdown (Month / Week / Day)
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  const currentProjectId = selectedProjectId !== undefined ? selectedProjectId : internalSelectedProjectId;
  const currentSearchQuery = searchQuery !== undefined ? searchQuery : internalSearchQuery;

  const handleFilterChange = (projId: string) => {
    if (onSelectProjectFilter) {
      onSelectProjectFilter(projId);
    } else {
      setInternalSelectedProjectId(projId);
    }
    setIsProjectFilterOpen(false);
  };

  const handleSearchInputChange = (text: string) => {
    if (onSearchChange) {
      onSearchChange(text);
    } else {
      setInternalSearchQuery(text);
    }
  };

  // Close project filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        projectFilterRef.current &&
        !projectFilterRef.current.contains(event.target as Node)
      ) {
        setIsProjectFilterOpen(false);
      }
      if (
        viewDropdownRef.current &&
        !viewDropdownRef.current.contains(event.target as Node)
      ) {
        setIsViewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts (D: Day, W: Week, M: Month, Y: Year, T: Today)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea or select
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      const key = e.key.toUpperCase();
      if (key === 'D') setTimeScale('day');
      else if (key === 'W') setTimeScale('week');
      else if (key === 'M') setTimeScale('month');
      else if (key === 'Y') setTimeScale('year');
      else if (key === 'T') {
        const today = new Date();
        setCurrentDate(today);
        setPickerDate(today);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentYear = currentDate.getFullYear();
  const currentMonthIndex = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const englishMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // 1. MONTH MODE DATA:
  const totalDaysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const allMonthDaysArray = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);
  const monthDaysArray = showWeekends
    ? allMonthDaysArray
    : allMonthDaysArray.filter((d) => {
        const dow = new Date(currentYear, currentMonthIndex, d).getDay();
        return dow !== 0 && dow !== 6;
      });
  const currentMonthStart = new Date(currentYear, currentMonthIndex, 1, 0, 0, 0).getTime();
  const currentMonthEnd = new Date(currentYear, currentMonthIndex, totalDaysInMonth, 23, 59, 59, 999).getTime();
  const totalMonthMs = currentMonthEnd - currentMonthStart;

  // 2. WEEK MODE DATA (Monday to Sunday, or Mon-Fri if showWeekends is false):
  const getWeekDays = (refDate: Date): Date[] => {
    const current = new Date(refDate);
    const dayOfWeek = current.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(current);
    monday.setDate(current.getDate() - diffToMonday);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    }
    return days;
  };

  const allWeekDays = getWeekDays(currentDate);
  const weekDays = showWeekends ? allWeekDays : allWeekDays.slice(0, 5);
  const weekStartMs = new Date(weekDays[0].getFullYear(), weekDays[0].getMonth(), weekDays[0].getDate(), 0, 0, 0, 0).getTime();
  const weekEndMs = new Date(weekDays[weekDays.length - 1].getFullYear(), weekDays[weekDays.length - 1].getMonth(), weekDays[weekDays.length - 1].getDate(), 23, 59, 59, 999).getTime();
  const totalWeekMs = weekEndMs - weekStartMs;

  // 3. YEAR MODE DATA (12 Months):
  const yearStartMs = new Date(currentYear, 0, 1, 0, 0, 0, 0).getTime();
  const yearEndMs = new Date(currentYear, 11, 31, 23, 59, 59, 999).getTime();
  const totalYearMs = yearEndMs - yearStartMs;

  const isNoneProjects = currentProjectId === 'none';
  const isNonePersons = selectedPersonId === 'none';

  const selectedProjectIds = useMemo(() => {
    if (!currentProjectId || currentProjectId === 'all' || currentProjectId === 'none') return [];
    return currentProjectId.split(',').filter(Boolean);
  }, [currentProjectId]);

  const selectedPersonIds = useMemo(() => {
    if (!selectedPersonId || selectedPersonId === 'all' || selectedPersonId === 'none') return [];
    return selectedPersonId.split(',').filter(Boolean);
  }, [selectedPersonId]);

  // Helper to filter items if user selected one or more persons
  const matchesPerson = (item: ItemNode): boolean => {
    if (isNonePersons) return false;
    if (selectedPersonIds.length === 0) return true;
    const hasPerson =
      (item.assigneeId && selectedPersonIds.includes(item.assigneeId)) ||
      (item.reviewerId && selectedPersonIds.includes(item.reviewerId));
    if (hasPerson) return true;
    if (item.subItems) {
      return item.subItems.some((child) => matchesPerson(child));
    }
    return false;
  };

  // Helper to filter items based on showCompleted and selected person
  const filterProjectFlatItems = (items: { item: ItemNode; depth: number }[]) => {
    let res = items;
    if (selectedPersonIds.length > 0) {
      res = res.filter(({ item }) => matchesPerson(item));
    }
    if (!showCompleted) {
      res = res.filter(({ item }) => {
        if (item.status !== 'completed') return true;
        const hasUncompletedChild = (node: ItemNode): boolean => {
          if (!node.subItems || node.subItems.length === 0) return false;
          return node.subItems.some((sub) => sub.status !== 'completed' || hasUncompletedChild(sub));
        };
        return hasUncompletedChild(item);
      });
    }
    return res;
  };

  // Month column span helper
  const getMonthColSpan = (
    startMs: number,
    endMs: number
  ): { leftPct: number; widthPct: number; startCol: number; endCol: number } | null => {
    const totalCols = monthDaysArray.length;
    if (totalCols === 0) return null;

    const mStart = new Date(currentYear, currentMonthIndex, monthDaysArray[0], 0, 0, 0, 0).getTime();
    const mEnd = new Date(currentYear, currentMonthIndex, monthDaysArray[totalCols - 1], 23, 59, 59, 999).getTime();

    if (endMs < mStart || startMs > mEnd) return null;

    const sDate = new Date(startMs);
    const eDate = new Date(endMs);

    let startCol = 0;
    if (startMs > mStart) {
      const sDay = sDate.getFullYear() === currentYear && sDate.getMonth() === currentMonthIndex ? sDate.getDate() : 1;
      const foundIdx = monthDaysArray.findIndex((d) => d >= sDay);
      startCol = foundIdx !== -1 ? foundIdx : totalCols - 1;
    }

    let endCol = totalCols - 1;
    if (endMs < mEnd) {
      const eDay = eDate.getFullYear() === currentYear && eDate.getMonth() === currentMonthIndex ? eDate.getDate() : monthDaysArray[totalCols - 1];
      let foundIdx = -1;
      for (let i = totalCols - 1; i >= 0; i--) {
        if (monthDaysArray[i] <= eDay) {
          foundIdx = i;
          break;
        }
      }
      endCol = foundIdx !== -1 ? foundIdx : 0;
    }

    if (startCol > endCol) return null;

    const leftPct = (startCol / totalCols) * 100;
    const widthPct = ((endCol - startCol + 1) / totalCols) * 100;
    return { leftPct, widthPct, startCol, endCol };
  };

  const getMonthTargetPinLeftPct = (targetDate: string): number | null => {
    const totalCols = monthDaysArray.length;
    if (totalCols === 0) return null;
    const t = new Date(targetDate);
    if (t.getFullYear() !== currentYear || t.getMonth() !== currentMonthIndex) return null;
    const tDay = t.getDate();
    const colIdx = monthDaysArray.indexOf(tDay);
    if (colIdx === -1) return null;
    return ((colIdx + 0.5) / totalCols) * 100;
  };

  // Week column span helper
  const getWeekColSpan = (
    startMs: number,
    endMs: number
  ): { leftPct: number; widthPct: number; startCol: number; endCol: number } | null => {
    const totalCols = weekDays.length;
    if (totalCols === 0) return null;

    const wStart = new Date(weekDays[0].getFullYear(), weekDays[0].getMonth(), weekDays[0].getDate(), 0, 0, 0, 0).getTime();
    const wEnd = new Date(weekDays[totalCols - 1].getFullYear(), weekDays[weekDays.length - 1].getMonth(), weekDays[weekDays.length - 1].getDate(), 23, 59, 59, 999).getTime();

    if (endMs < wStart || startMs > wEnd) return null;

    let startCol = -1;
    let endCol = -1;

    for (let i = 0; i < totalCols; i++) {
      const dayStart = new Date(weekDays[i].getFullYear(), weekDays[i].getMonth(), weekDays[i].getDate(), 0, 0, 0, 0).getTime();
      const dayEnd = new Date(weekDays[i].getFullYear(), weekDays[i].getMonth(), weekDays[i].getDate(), 23, 59, 59, 999).getTime();

      if (startMs <= dayEnd && startCol === -1) {
        startCol = i;
      }
      if (endMs >= dayStart) {
        endCol = i;
      }
    }

    if (startCol === -1 || endCol === -1 || startCol > endCol) return null;

    const leftPct = (startCol / totalCols) * 100;
    const widthPct = ((endCol - startCol + 1) / totalCols) * 100;
    return { leftPct, widthPct, startCol, endCol };
  };

  const getWeekTargetPinLeftPct = (targetDate: string): number | null => {
    const totalCols = weekDays.length;
    if (totalCols === 0) return null;
    const t = new Date(targetDate);
    const tYear = t.getFullYear();
    const tMonth = t.getMonth();
    const tDay = t.getDate();

    const idx = weekDays.findIndex(
      (d) => d.getFullYear() === tYear && d.getMonth() === tMonth && d.getDate() === tDay
    );
    if (idx === -1) return null;
    return ((idx + 0.5) / totalCols) * 100;
  };

  // 4. DAY MODE DATA (Hourly):
  // When hideInactiveHours is enabled: show 06:00 to 20:00 (14 hours: index 6 to 19)
  // When disabled: show full 24 hours (00:00 to 23:59:59)
  const hoursArray = hideInactiveHours
    ? Array.from({ length: 14 }, (_, i) => i + 6) // [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
    : Array.from({ length: 24 }, (_, i) => i);

  const dayStartMs = new Date(
    currentYear,
    currentMonthIndex,
    currentDay,
    hideInactiveHours ? 6 : 0,
    0,
    0,
    0
  ).getTime();

  const dayEndMs = new Date(
    currentYear,
    currentMonthIndex,
    currentDay,
    hideInactiveHours ? 20 : 23,
    hideInactiveHours ? 0 : 59,
    hideInactiveHours ? 0 : 59,
    hideInactiveHours ? 0 : 999
  ).getTime();

  const totalDayMs = dayEndMs - dayStartMs;

  // Navigation handlers
  const handlePrev = () => {
    if (timeScale === 'year') {
      setCurrentDate(new Date(currentYear - 1, currentMonthIndex, Math.min(currentDay, 28)));
    } else if (timeScale === 'month') {
      setCurrentDate(new Date(currentYear, currentMonthIndex - 1, Math.min(currentDay, 28)));
    } else if (timeScale === 'week') {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() - 7);
      setCurrentDate(nextDate);
    } else {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() - 1);
      setCurrentDate(nextDate);
    }
  };

  const handleNext = () => {
    if (timeScale === 'year') {
      setCurrentDate(new Date(currentYear + 1, currentMonthIndex, Math.min(currentDay, 28)));
    } else if (timeScale === 'month') {
      setCurrentDate(new Date(currentYear, currentMonthIndex + 1, Math.min(currentDay, 28)));
    } else if (timeScale === 'week') {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 7);
      setCurrentDate(nextDate);
    } else {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      setCurrentDate(nextDate);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Current time state for live hour-sensitive today line
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // 1. Month View Today position (% within the right grid)
  const monthTodayPosition = useMemo(() => {
    const now = currentTime;
    const isThisMonth =
      now.getFullYear() === currentYear && now.getMonth() === currentMonthIndex;
    if (!isThisMonth) return null;

    const totalCols = monthDaysArray.length;
    if (totalCols === 0) return null;

    const todayDay = now.getDate();
    const colIdx = monthDaysArray.indexOf(todayDay);
    if (colIdx === -1) return null; // e.g., weekend hidden

    const dayFraction =
      (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    return ((colIdx + dayFraction) / totalCols) * 100;
  }, [currentTime, currentYear, currentMonthIndex, monthDaysArray]);

  // 2. Week View Today position (% within the right grid)
  const weekTodayPosition = useMemo(() => {
    const now = currentTime;
    const totalCols = weekDays.length;
    if (totalCols === 0) return null;

    const colIdx = weekDays.findIndex(
      (d) =>
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
    if (colIdx === -1) return null; // not in current week or weekend hidden

    const dayFraction =
      (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    return ((colIdx + dayFraction) / totalCols) * 100;
  }, [currentTime, weekDays]);

  // 3. Day View Today position (% within the right grid)
  const dayTodayPosition = useMemo(() => {
    const now = currentTime;
    const isThisDay =
      now.getFullYear() === currentYear &&
      now.getMonth() === currentMonthIndex &&
      now.getDate() === currentDay;
    if (!isThisDay) return null;

    const nowMs = now.getTime();
    if (nowMs < dayStartMs || nowMs > dayEndMs) return null;

    return ((nowMs - dayStartMs) / totalDayMs) * 100;
  }, [currentTime, currentYear, currentMonthIndex, currentDay, dayStartMs, dayEndMs, totalDayMs]);

  // 4. Year View Today position (% within the right grid)
  const yearTodayPosition = useMemo(() => {
    const now = currentTime;
    if (now.getFullYear() !== currentYear) return null;

    const mIdx = now.getMonth();
    const daysInThisMonth = new Date(currentYear, mIdx + 1, 0).getDate();
    const dayFraction =
      (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    const monthFraction = (now.getDate() - 1 + dayFraction) / daysInThisMonth;

    return ((mIdx + monthFraction) / 12) * 100;
  }, [currentTime, currentYear]);

  /**
   * Extracts distinct realization segments / individual session blocks for an item.
   * - When sub-tasks are expanded (isExpanded = true), child sessions are NOT duplicated
   *   onto the parent/folder row. Each session only renders in its respective owner task row.
   * - When collapsed (isExpanded = false), child sessions / group realization are aggregated
   *   so the collapsed group shows overall progress.
   */
  const getItemRealizationSegments = (
    item: ItemNode,
    isExpanded: boolean = true,
    hasChildren: boolean = false
  ): RealizationSegment[] => {
    const segments: RealizationSegment[] = [];

    // Active live timer check
    const activeTimerItemId = appData.settings.activeTimer?.itemId;
    const activeTimerStartedAt = appData.settings.activeTimer?.startedAt;
    const isLiveActive = activeTimerItemId === item.id && activeTimerStartedAt;

    // Direct sessions belonging to this specific node
    const directSessions: Session[] = Array.isArray(item.sessions) ? [...item.sessions] : [];

    // If parent is collapsed, include child sessions so the collapsed row reflects work done
    if (hasChildren && !isExpanded) {
      const collect = (node: ItemNode) => {
        if (node.sessions && Array.isArray(node.sessions)) {
          directSessions.push(...node.sessions);
        }
        if (node.subItems) {
          node.subItems.forEach(collect);
        }
      };
      if (item.subItems) {
        item.subItems.forEach(collect);
      }
    }

    if (directSessions.length > 0 || isLiveActive) {
      directSessions.forEach((s, idx) => {
        const sStart = new Date(s.startedAt);
        const isManualRange = s.type === 'manual-range' || (!s.loggedSeconds && s.endedAt && s.endedAt !== s.startedAt);
        const sEnd = s.endedAt
          ? new Date(s.endedAt)
          : new Date(sStart.getTime() + (s.loggedSeconds || 0) * 1000);

        if (!isNaN(sStart.getTime()) && !isNaN(sEnd.getTime())) {
          segments.push({
            id: s.id || `sess-${item.id}-${idx}`,
            startDate: sStart,
            endDate: sEnd,
            loggedSeconds: s.loggedSeconds || 0,
            sessionTitle: s.title || (isManualRange ? 'Realization Period' : directSessions.length > 1 ? `Session ${idx + 1}` : 'Work Session'),
            status: item.status,
            isSession: !isManualRange,
          });
        }
      });

      if (isLiveActive) {
        const now = new Date();
        const start = new Date(activeTimerStartedAt);
        const diffSec = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 1000));
        segments.push({
          id: `live-timer-${item.id}`,
          startDate: start,
          endDate: now,
          loggedSeconds: diffSec,
          sessionTitle: 'Active Live Timer',
          status: 'in-progress',
          isSession: true,
        });
      }
    } else if (item.actualStartDate) {
      const sStart = new Date(item.actualStartDate);
      const sEnd = item.actualEndDate ? new Date(item.actualEndDate) : sStart;
      if (!isNaN(sStart.getTime()) && !isNaN(sEnd.getTime())) {
        segments.push({
          id: `manual-range-${item.id}`,
          startDate: sStart,
          endDate: sEnd,
          loggedSeconds: 0,
          sessionTitle: 'Realization Period',
          status: item.status,
          isSession: false,
        });
      }
    }

    // Merge sessions/segments if overlapping or if gap is less than 1 hour (< 3,600,000 ms)
    return mergeAdjacentSegments(segments, ONE_HOUR_MS);
  };

  /**
   * Extracts aggregated realization segments for an entire project.
   * When project is collapsed, this acts as the parent row aggregating all child tasks.
   */
  const getProjectRealizationSegments = (project: ProjectNode): RealizationSegment[] => {
    const segments: RealizationSegment[] = [];
    const activeTimerItemId = appData.settings.activeTimer?.itemId;
    const activeTimerStartedAt = appData.settings.activeTimer?.startedAt;

    const collectFromNode = (node: ItemNode) => {
      const isLiveActive = activeTimerItemId === node.id && activeTimerStartedAt;
      const directSessions: Session[] = Array.isArray(node.sessions) ? [...node.sessions] : [];

      if (directSessions.length > 0 || isLiveActive) {
        directSessions.forEach((s, idx) => {
          const sStart = new Date(s.startedAt);
          const isManualRange = s.type === 'manual-range' || (!s.loggedSeconds && s.endedAt && s.endedAt !== s.startedAt);
          const sEnd = s.endedAt
            ? new Date(s.endedAt)
            : new Date(sStart.getTime() + (s.loggedSeconds || 0) * 1000);

          if (!isNaN(sStart.getTime()) && !isNaN(sEnd.getTime())) {
            segments.push({
              id: s.id || `proj-sess-${project.id}-${node.id}-${idx}`,
              startDate: sStart,
              endDate: sEnd,
              loggedSeconds: s.loggedSeconds || 0,
              sessionTitle: `${node.name} (${s.title || (isManualRange ? 'Period' : 'Session')})`,
              status: node.status,
              isSession: !isManualRange,
            });
          }
        });

        if (isLiveActive) {
          const now = new Date();
          const start = new Date(activeTimerStartedAt);
          const diffSec = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 1000));
          segments.push({
            id: `live-timer-${node.id}`,
            startDate: start,
            endDate: now,
            loggedSeconds: diffSec,
            sessionTitle: `${node.name} (Active Live Timer)`,
            status: 'in-progress',
            isSession: true,
          });
        }
      } else if (node.actualStartDate) {
        const sStart = new Date(node.actualStartDate);
        const sEnd = node.actualEndDate ? new Date(node.actualEndDate) : sStart;
        if (!isNaN(sStart.getTime()) && !isNaN(sEnd.getTime())) {
          segments.push({
            id: `proj-manual-${project.id}-${node.id}`,
            startDate: sStart,
            endDate: sEnd,
            loggedSeconds: 0,
            sessionTitle: `${node.name} (Realization)`,
            status: node.status,
            isSession: false,
          });
        }
      }

      if (node.subItems && Array.isArray(node.subItems)) {
        node.subItems.forEach(collectFromNode);
      }
    };

    (project.items || []).forEach(collectFromNode);

    return mergeAdjacentSegments(segments, ONE_HOUR_MS);
  };

  // Active projects
  const activeProjects = appData.projects.filter((p) => p.status === 'active');

  // Filtered projects by Project Filter, Person Filter, and Search
  const filteredProjects = activeProjects.filter((project) => {
    if (isNoneProjects) return false;
    if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(project.id)) {
      return false;
    }
    if (isNonePersons) return false;
    if (selectedPersonIds.length > 0) {
      const hasMatchingPerson = (project.items || []).some((item) => matchesPerson(item));
      if (!hasMatchingPerson) return false;
    }
    if (!currentSearchQuery.trim()) return true;
    const q = currentSearchQuery.toLowerCase().trim();
    if (project.title.toLowerCase().includes(q)) return true;
    if (project.description && project.description.toLowerCase().includes(q)) return true;
    const leafItems = getLeafFlatItems([project]);
    return leafItems.some(
      ({ item }) =>
        item.name.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q))
    );
  });

  // Status color helper for realization bars (transparent 50% with solid 100% border)
  const getBarColor = (status: ItemStatus) => {
    if (status === 'completed') {
      return 'bg-[#10b981]/50 border border-[#10b981] text-white';
    }
    if (status === 'review') {
      return 'bg-[#f59e0b]/50 border border-[#f59e0b] text-white font-bold';
    }
    if (status === 'in-progress') {
      return 'bg-orange-500/50 border border-orange-500 text-white';
    }
    return 'bg-[#3f3f46]/50 border border-[#71717a] text-[#f4f4f5]';
  };

  const formatD = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const toInputDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const renderPickerGrid = () => {
    const pYear = pickerDate.getFullYear();
    const pMonth = pickerDate.getMonth();
    const daysInMonth = new Date(pYear, pMonth + 1, 0).getDate();

    // Monday-based offset (0 = Mon, 6 = Sun)
    const firstDay = new Date(pYear, pMonth, 1).getDay();
    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < mondayOffset; i++) {
      cells.push(<div key={`blank-${i}`} className="w-7 h-7" />);
    }

    const today = new Date();
    const isTodayMonth = today.getFullYear() === pYear && today.getMonth() === pMonth;
    const isCurrentMonth = currentDate.getFullYear() === pYear && currentDate.getMonth() === pMonth;

    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected = isCurrentMonth && currentDate.getDate() === d;
      const isToday = isTodayMonth && today.getDate() === d;

      cells.push(
        <button
          key={`day-${d}`}
          type="button"
          onClick={() => {
            const target = new Date(pYear, pMonth, d);
            setCurrentDate(target);
            setPickerDate(target);
            setIsDatePickerOpen(false);
          }}
          className={`w-7 h-7 rounded-lg text-xs font-mono flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-orange-500 text-white font-bold shadow-sm shadow-orange-500/30'
              : isToday
              ? 'border border-orange-500/60 text-orange-400 font-bold hover:bg-orange-500/10'
              : 'text-[#d4d4d8] hover:bg-[#27272a] hover:text-white'
          }`}
        >
          {d}
        </button>
      );
    }
    return cells;
  };

  // Header Title formatted according to timeScale (Matches GanttView format)
  const headerTitle = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = monthNames[currentDate.getMonth()];
    const day = currentDate.getDate();

    if (timeScale === 'year') return `${year}`;
    if (timeScale === 'day') return `${day} ${month.substring(0, 3)} ${year}`;
    if (timeScale === 'week') {
      const mon = weekDays[0];
      const lastDay = weekDays[weekDays.length - 1];
      const sMonth = monthNames[mon.getMonth()].substring(0, 3);
      const eMonth = monthNames[lastDay.getMonth()].substring(0, 3);
      if (mon.getFullYear() !== lastDay.getFullYear()) {
        return `${mon.getDate()} ${sMonth} ${mon.getFullYear()} - ${lastDay.getDate()} ${eMonth} ${lastDay.getFullYear()}`;
      }
      return `${mon.getDate()} ${sMonth} - ${lastDay.getDate()} ${eMonth} ${year}`;
    }

    return `${month} ${year}`;
  }, [currentDate, timeScale, weekDays]);

  return (
    <div className="w-full md:h-full md:flex md:flex-col md:min-h-0 space-y-2 pb-[10px]">
      {/* Time-Based Unified Toolbar */}
      <TimeBasedToolbar
        isFullHeight={true}
        projects={appData.projects}
        selectedProjectId={currentProjectId}
        onSelectProject={handleFilterChange}
        persons={appData.persons}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPersonFilter}
        searchQuery={currentSearchQuery}
        onSearchChange={handleSearchInputChange}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        onToday={handleToday}
        onPrev={handlePrev}
        onNext={handleNext}
        headerTitle={headerTitle}
        timeScale={timeScale}
        onTimeScaleChange={setTimeScale}
        hasActiveTimer={!!appData.settings.activeTimer}
        appData={appData}
        onStopTimer={onStopTimer}
        onOpenEditItemModal={onOpenEditItemModal}
      />

      {/* Secondary Controls Bar: Inactive Hours Toggle (Day view only) */}
      {timeScale === 'day' && (
        <div className="flex items-center justify-end text-xs shrink-0">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-0.5 flex text-xs">
            <button
              type="button"
              onClick={() => setHideInactiveHours(!hideInactiveHours)}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 font-medium select-none cursor-pointer ${
                hideInactiveHours
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]'
              }`}
              title={
                hideInactiveHours
                  ? 'Active Hours View (06:00 - 20:00). Click to show 24 hours.'
                  : '24 Hours View. Click to hide inactive hours (00:00-06:00 & 20:00-00:00).'
              }
            >
              {hideInactiveHours ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Active Hours (06:00 - 20:00)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">14h</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#a1a1aa]" />
                  <span>Hide Inactive Hours</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#27272a] text-[#71717a] font-mono">24h</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================= GANTT TIMELINE MATRIX ================= */}
      <div className="bg-[#121215] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl flex-1 min-h-0 flex flex-col md:h-full">
        <div className="overflow-auto flex-1 min-h-0">
          {/* ================= 1. MONTH VIEW ================= */}
          {timeScale === 'month' && (
            <div className="relative" style={{ minWidth: `${280 + monthDaysArray.length * 34}px` }}>
              {/* Vertical Today Line (Solid Blue, Hour-sensitive) */}
              <div className="absolute top-0 bottom-0 right-0 left-[280px] pointer-events-none z-30">
                {monthTodayPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-blue-500"
                    style={{ left: `${monthTodayPosition}%` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 -ml-[5px] -mt-1 shadow-sm" />
                    <span className="absolute top-2 -left-3.5 px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] font-sans font-bold tracking-tight shadow-md select-none">
                      Today
                    </span>
                  </div>
                )}
              </div>

              {/* Header Timeline Dates */}
              <div className="grid grid-cols-[280px_1fr] bg-[#18181b] border-b border-[#27272a] text-xs text-[#a1a1aa] sticky top-0 z-40">
                <div className="sticky left-0 z-50 bg-[#18181b] px-3 py-2 font-sans border-r border-[#27272a] flex items-center justify-center shadow-[4px_0_12px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={handleExpandAll}
                      className="px-2.5 py-1 rounded-md text-[11px] font-sans font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
                      title="Expand All"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={handleCollapseAll}
                      className="px-2.5 py-1 rounded-md text-[11px] font-sans font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
                      title="Collapse All"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
                <div
                  className="grid text-center divide-x divide-[#27272a] py-2 font-mono"
                  style={{ gridTemplateColumns: `repeat(${monthDaysArray.length}, minmax(32px, 1fr))` }}
                >
                  {monthDaysArray.map((day) => {
                    const dateObj = new Date(currentYear, currentMonthIndex, day);
                    const dayOfWeek = dateObj.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const todayDate = new Date();
                    const isToday =
                      dateObj.getDate() === todayDate.getDate() &&
                      dateObj.getMonth() === todayDate.getMonth() &&
                      dateObj.getFullYear() === todayDate.getFullYear();

                    return (
                      <div
                        key={day}
                        className={`flex flex-col items-center justify-center py-1 transition-colors ${
                          isToday
                            ? 'bg-orange-500/20 text-orange-400 font-bold border-t-2 border-t-orange-500'
                            : isWeekend
                            ? 'bg-[#141417] text-[#71717a]'
                            : 'text-[#a1a1aa]'
                        }`}
                      >
                        <span className="text-[9px] opacity-70 uppercase">
                          {dateObj.toLocaleDateString('en-US', { weekday: 'narrow' })}
                        </span>
                        <span className={`text-[11px] ${isToday ? 'text-[#f4f4f5] font-bold' : ''}`}>
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows Grouped By Project */}
              <div className="text-xs">
                {filteredProjects.map((project) => {
                  const isProjectCollapsed = collapsedProjectIds.has(project.id);
                  const leafTasks = getLeafFlatItems([project]);
                  const completedCount = leafTasks.filter((f) => f.item.status === 'completed').length;
                  const totalTasks = leafTasks.length;
                  const projectTotalSeconds = project.items.reduce(
                    (acc, it) =>
                      acc +
                      getItemLoggedSeconds(
                        it,
                        appData.settings.activeTimer?.itemId,
                        appData.settings.activeTimer?.startedAt
                      ),
                    0
                  );
                  const { minDate: projMinDate, maxDate: projMaxDate } = getRealizationDatesForProject(project);

                  let projRealizationSummaryText = '';
                  if (projMinDate) {
                    if (projMaxDate && projMinDate.getTime() !== projMaxDate.getTime()) {
                      projRealizationSummaryText = `${formatD(projMinDate)} - ${formatD(projMaxDate)}`;
                    } else {
                      projRealizationSummaryText = formatD(projMinDate);
                    }
                  }

                  const projectFlatItems = filterProjectFlatItems(getVisibleFlatItems([project]));

                  // If filterMode is realized-only, check if project or items have realization
                  if (filterMode === 'realized-only' && !projMinDate && projectFlatItems.length === 0) {
                    return null;
                  }

                  return (
                    <React.Fragment key={project.id}>
                      {/* ===== PROJECT NODE ROW ===== */}
                      <div
                        id={`timeline-project-node-${project.id}`}
                        className="grid grid-cols-[280px_1fr] transition-colors group font-sans border-b border-[#27272a]"
                      >
                        {/* Left Column: Project Node Header (Month) */}
                        <div
                          style={getProjectCardStyle(project.color)}
                          className="sticky left-0 z-30 min-h-[44px] h-full p-2.5 font-bold border border-r border-[#27272a] truncate flex items-center justify-between gap-2 pr-2.5 cursor-pointer select-none"
                          onClick={() => toggleProjectCollapse(project.id)}
                          title={`${isProjectCollapsed ? 'Expand' : 'Collapse'} project: ${project.title}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectCollapse(project.id);
                              }}
                              className="p-0.5 rounded hover:bg-black/10 text-slate-700 hover:text-slate-950 transition-colors shrink-0"
                            >
                              {isProjectCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-slate-800" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-800" />
                              )}
                            </button>

                            <span className="truncate text-xs font-bold text-slate-950 tracking-tight">
                              {project.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {projRealizationSummaryText ? (
                              <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded bg-black/10 text-slate-900 border border-black/15 font-semibold">
                                {projRealizationSummaryText}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Right Column: Month Timeline Grid for Project Node */}
                        <div className="relative py-2 px-1 min-h-[44px] h-full flex items-center bg-[#141418]/60">
                          {/* Background Grid Days */}
                          <div
                            className="absolute inset-0 grid h-full pointer-events-none"
                            style={{ gridTemplateColumns: `repeat(${monthDaysArray.length}, minmax(32px, 1fr))` }}
                          >
                            {monthDaysArray.map((day) => {
                              const dateObj = new Date(currentYear, currentMonthIndex, day);
                              const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                              return (
                                <div
                                  key={`proj-bg-${day}`}
                                  className={`h-full border-r border-[#27272a]/30 ${
                                    isWeekend ? 'bg-[#18181b]/20' : ''
                                  }`}
                                />
                              );
                            })}
                          </div>

                          {/* When project is collapsed, render aggregated task realization cards (acts as parent task) */}
                          {isProjectCollapsed && (() => {
                            const projSegments = getProjectRealizationSegments(project);
                            const rawProjMonthSegments = projSegments
                              .map((seg) => {
                                const segStartMidnight = new Date(seg.startDate.getFullYear(), seg.startDate.getMonth(), seg.startDate.getDate(), 0, 0, 0, 0).getTime();
                                const segEndMidnight = new Date(seg.endDate.getFullYear(), seg.endDate.getMonth(), seg.endDate.getDate(), 23, 59, 59, 999).getTime();
                                const span = getMonthColSpan(segStartMidnight, segEndMidnight);
                                if (!span) return null;
                                return { seg, startCol: span.startCol, endCol: span.endCol };
                              })
                              .filter(Boolean) as { seg: RealizationSegment; startCol: number; endCol: number }[];

                            const projMonthSegments = consolidateDaySegments(rawProjMonthSegments, monthDaysArray.length);

                            return projMonthSegments.map(({ seg, leftPct, widthPct }) => (
                              <div
                                key={seg.id}
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  minWidth: '20px',
                                }}
                                className={`absolute h-6 rounded-full ${getBarColor(seg.status)} select-none transition-all truncate z-10 shadow-sm cursor-pointer hover:brightness-110`}
                                title={`Project: ${project.title} | ${seg.sessionTitle || 'Realization'}: ${formatDuration(seg.loggedSeconds)} (${formatD(seg.startDate)}${seg.startDate.getTime() !== seg.endDate.getTime() ? ` - ${formatD(seg.endDate)}` : ''})`}
                              />
                            ));
                          })()}
                        </div>
                      </div>

                      {/* ===== SUBSEQUENT TASK ITEMS UNDER THIS PROJECT ===== */}
                      {!isProjectCollapsed &&
                        projectFlatItems.map(({ item, depth }) => {
                          const isExpanded = item.isExpanded !== false;
                          const hasChildren = Boolean(item.subItems && item.subItems.length > 0);

                          const segments = getItemRealizationSegments(item, isExpanded, hasChildren);
                          const hasRealization = segments.length > 0;

                          if (filterMode === 'realized-only' && !hasRealization) {
                            return null;
                          }

                          // Calculate day-snapped month positioning for each segment (fills full day columns, no empty sides)
                          const rawMonthSegments = segments
                            .map((seg) => {
                              const segStartMidnight = new Date(seg.startDate.getFullYear(), seg.startDate.getMonth(), seg.startDate.getDate(), 0, 0, 0, 0).getTime();
                              const segEndMidnight = new Date(seg.endDate.getFullYear(), seg.endDate.getMonth(), seg.endDate.getDate(), 23, 59, 59, 999).getTime();

                              const span = getMonthColSpan(segStartMidnight, segEndMidnight);
                              if (!span) return null;

                              return {
                                seg,
                                startCol: span.startCol,
                                endCol: span.endCol,
                              };
                            })
                            .filter(Boolean) as { seg: RealizationSegment; startCol: number; endCol: number }[];

                          // Consolidate segments that overlap on the same day(s) into single full bars
                          const monthSegments = consolidateDaySegments(rawMonthSegments, monthDaysArray.length);

                          const targetPinLeftPct = item.targetDate ? getMonthTargetPinLeftPct(item.targetDate) : null;

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[280px_1fr] hover:bg-[#27272a]/30 transition-colors group border-b border-[#27272a]"
                            >
                              {/* Left Column: Task Name Indented Under Project */}
                              <div
                                style={{ paddingLeft: `${14 + depth * 12}px` }}
                                className={`sticky left-0 z-30 bg-[#121215] group-hover:bg-[#18181c] min-h-[44px] h-full p-2.5 font-medium border-r border-[#27272a] truncate flex items-center justify-between gap-1.5 pr-2 select-none ${
                                  hasChildren ? 'cursor-pointer' : 'cursor-default'
                                }`}
                                onClick={() => {
                                  if (hasChildren && onToggleExpand) {
                                    onToggleExpand(item.id);
                                  }
                                }}
                                title={hasChildren ? `${isExpanded ? 'Collapse' : 'Expand'} sub-tasks: ${item.name}` : undefined}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  {/* Chevron / Bullet aligned with TreeView pattern */}
                                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                    {hasChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onToggleExpand) onToggleExpand(item.id);
                                        }}
                                        className="w-4 h-4 rounded flex items-center justify-center hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors shrink-0"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5 text-[#71717a]" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#3f3f46] inline-block" />
                                    )}
                                  </div>

                                  {/* Task Icon / Emoji */}
                                  <span className="text-xs shrink-0 select-none">
                                    {item.icon || (hasChildren ? '📁' : '📄')}
                                  </span>

                                  <div className="min-w-0 truncate flex-1 flex flex-col justify-center">
                                    <span className="truncate text-sm font-medium text-[#f4f4f5] group-hover:text-white">
                                      {item.name}
                                    </span>
                                    {item.notes && (
                                      <span className="truncate text-[11px] font-normal leading-tight text-[#a1a1aa] mt-0.5">
                                        {item.notes}
                                      </span>
                                    )}
                                  </div>

                                  {hasChildren && !isExpanded && (
                                    <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-[#27272a] text-orange-400/90 border border-orange-500/20 shrink-0">
                                      +{item.subItems.length}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right Column: Month Timeline Grid */}
                              <div className="relative py-2 px-1 min-h-[44px] h-full flex items-center">
                                {/* Background Grid Days */}
                                <div
                                  className="absolute inset-0 grid h-full pointer-events-none"
                                  style={{ gridTemplateColumns: `repeat(${monthDaysArray.length}, minmax(32px, 1fr))` }}
                                >
                                  {monthDaysArray.map((day) => {
                                    const dateObj = new Date(currentYear, currentMonthIndex, day);
                                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                    return (
                                      <div
                                        key={`bg-${day}`}
                                        className={`h-full border-r border-[#27272a]/40 ${
                                          isWeekend ? 'bg-[#18181b]/30' : ''
                                        }`}
                                      />
                                    );
                                  })}
                                </div>

                                {/* Target Date Marker Pin */}
                                {targetPinLeftPct !== null && (
                                  <div
                                    style={{ left: `${targetPinLeftPct}%` }}
                                    className="absolute inset-y-1 -translate-x-1/2 flex items-center justify-center pointer-events-none z-10"
                                    title={`Target Deadline: ${new Date(item.targetDate!).toLocaleDateString('en-GB')}`}
                                  >
                                    <div className="w-1 h-full bg-orange-400/70 rounded-full flex flex-col items-center">
                                      <Flag className="w-3 h-3 text-orange-400 -mt-1 drop-shadow" />
                                    </div>
                                  </div>
                                )}

                                {/* Individual Session Segments with Continuous Exact Positioning */}
                                {monthSegments.map(({ seg, leftPct, widthPct }) => (
                                  <div
                                    key={seg.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onOpenEditItemModal) onOpenEditItemModal(item);
                                    }}
                                    style={{
                                      left: `${leftPct}%`,
                                      width: `${widthPct}%`,
                                      minWidth: '20px',
                                    }}
                                    className={`absolute h-6 rounded-full ${getBarColor(seg.status)} cursor-pointer hover:brightness-110 select-none transition-all truncate z-10 shadow-sm`}
                                    title={`Click to edit task: ${item.name} (${getTaskStatusPercentage(item)}%) | ${seg.sessionTitle || 'Realization'}: ${formatDuration(seg.loggedSeconds)} (${formatD(seg.startDate)}${seg.startDate.getTime() !== seg.endDate.getTime() ? ` - ${formatD(seg.endDate)}` : ''})`}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= 2. WEEK VIEW (MONDAY - SUNDAY) ================= */}
          {timeScale === 'week' && (
            <div className="relative" style={{ minWidth: `${280 + weekDays.length * 110}px` }}>
              {/* Vertical Today Line (Solid Blue, Hour-sensitive) */}
              <div className="absolute top-0 bottom-0 right-0 left-[280px] pointer-events-none z-30">
                {weekTodayPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-blue-500"
                    style={{ left: `${weekTodayPosition}%` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 -ml-[5px] -mt-1 shadow-sm" />
                    <span className="absolute top-2 -left-3.5 px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] font-sans font-bold tracking-tight shadow-md select-none">
                      Today
                    </span>
                  </div>
                )}
              </div>

              {/* Header Days (Dynamic Monday - Sunday / Friday) */}
              <div className="grid grid-cols-[280px_1fr] bg-[#18181b] border-b border-[#27272a] text-xs text-[#a1a1aa] sticky top-0 z-40">
                <div className="sticky left-0 z-50 bg-[#18181b] px-3 py-2 font-sans border-r border-[#27272a] flex items-center justify-center shadow-[4px_0_12px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={handleExpandAll}
                      className="px-2.5 py-1 rounded-md text-[11px] font-sans font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
                      title="Expand All"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={handleCollapseAll}
                      className="px-2.5 py-1 rounded-md text-[11px] font-sans font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
                      title="Collapse All"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
                <div
                  className="grid text-center divide-x divide-[#27272a] py-2 font-mono"
                  style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(110px, 1fr))` }}
                >
                  {weekDays.map((wDate, idx) => {
                    const dayName = englishDays[wDate.getDay()];
                    const dateNum = wDate.getDate();
                    const monthShort = monthNames[wDate.getMonth()].substring(0, 3);
                    const isWeekend = wDate.getDay() === 0 || wDate.getDay() === 6;
                    const todayDate = new Date();
                    const isSelectedDay =
                      wDate.getDate() === todayDate.getDate() &&
                      wDate.getMonth() === todayDate.getMonth() &&
                      wDate.getFullYear() === todayDate.getFullYear();

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col items-center justify-center py-1.5 transition-colors ${
                          isSelectedDay
                            ? 'bg-orange-500/20 text-orange-400 font-bold border-t-2 border-t-orange-500'
                            : isWeekend
                            ? 'bg-[#141417] text-[#71717a]'
                            : 'text-[#a1a1aa]'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider">{dayName}</span>
                        <span className={`text-xs mt-0.5 ${isSelectedDay ? 'text-[#f4f4f5] font-bold' : ''}`}>
                          {dateNum} {monthShort}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows for Week View Grouped by Project */}
              <div className="text-xs">
                {filteredProjects.map((project) => {
                  const isProjectCollapsed = collapsedProjectIds.has(project.id);
                  const leafTasks = getLeafFlatItems([project]);
                  const completedCount = leafTasks.filter((f) => f.item.status === 'completed').length;
                  const totalTasks = leafTasks.length;
                  const projectTotalSeconds = project.items.reduce(
                    (acc, it) =>
                      acc +
                      getItemLoggedSeconds(
                        it,
                        appData.settings.activeTimer?.itemId,
                        appData.settings.activeTimer?.startedAt
                      ),
                    0
                  );
                  const { minDate: projMinDate, maxDate: projMaxDate } = getRealizationDatesForProject(project);

                  let projRealizationSummaryText = '';
                  if (projMinDate) {
                    if (projMaxDate && projMinDate.getTime() !== projMaxDate.getTime()) {
                      projRealizationSummaryText = `${formatD(projMinDate)} - ${formatD(projMaxDate)}`;
                    } else {
                      projRealizationSummaryText = formatD(projMinDate);
                    }
                  }

                  const projectFlatItems = filterProjectFlatItems(getVisibleFlatItems([project]));

                  if (filterMode === 'realized-only' && !projMinDate && projectFlatItems.length === 0) {
                    return null;
                  }

                  return (
                    <React.Fragment key={project.id}>
                      {/* ===== PROJECT NODE ROW (WEEK) ===== */}
                      <div
                        id={`timeline-project-node-week-${project.id}`}
                        className="grid grid-cols-[280px_1fr] transition-colors group font-sans border-b border-[#27272a]"
                      >
                        {/* Left Column: Project Node Info */}
                        <div
                          style={getProjectCardStyle(project.color)}
                          className="sticky left-0 z-30 min-h-[44px] h-full p-2.5 font-bold border border-r border-[#27272a] truncate flex items-center justify-between gap-2 pr-2.5 cursor-pointer select-none"
                          onClick={() => toggleProjectCollapse(project.id)}
                          title={`${isProjectCollapsed ? 'Expand' : 'Collapse'} project: ${project.title}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectCollapse(project.id);
                              }}
                              className="p-0.5 rounded hover:bg-black/10 text-slate-700 hover:text-slate-950 transition-colors shrink-0"
                            >
                              {isProjectCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-slate-800" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-800" />
                              )}
                            </button>

                            <span className="truncate text-xs font-bold text-slate-950 tracking-tight">
                              {project.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {projRealizationSummaryText ? (
                              <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded bg-black/10 text-slate-900 border border-black/15 font-semibold">
                                {projRealizationSummaryText}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Right Column: Week Grid for Project Node */}
                        <div className="relative py-2 px-1 min-h-[44px] h-full flex items-center bg-[#141418]/60">
                          {/* Background Grid */}
                          <div
                            className="absolute inset-0 grid h-full pointer-events-none"
                            style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(110px, 1fr))` }}
                          >
                            {weekDays.map((wDate, idx) => {
                              const isWeekend = wDate.getDay() === 0 || wDate.getDay() === 6;
                              return (
                                <div
                                  key={`proj-wbg-${idx}`}
                                  className={`h-full border-r border-[#27272a]/30 ${
                                    isWeekend ? 'bg-[#18181b]/20' : ''
                                  }`}
                                />
                              );
                            })}
                          </div>

                          {/* When project is collapsed, render aggregated task realization cards (acts as parent task) */}
                          {isProjectCollapsed && (() => {
                            const projSegments = getProjectRealizationSegments(project);
                            const rawProjWeekSegments = projSegments
                              .map((seg) => {
                                const segStartDateMidnight = new Date(seg.startDate.getFullYear(), seg.startDate.getMonth(), seg.startDate.getDate(), 0, 0, 0, 0).getTime();
                                const segEndDateMidnight = new Date(seg.endDate.getFullYear(), seg.endDate.getMonth(), seg.endDate.getDate(), 23, 59, 59, 999).getTime();
                                const span = getWeekColSpan(segStartDateMidnight, segEndDateMidnight);
                                if (!span) return null;
                                return { seg, startCol: span.startCol, endCol: span.endCol };
                              })
                              .filter(Boolean) as { seg: RealizationSegment; startCol: number; endCol: number }[];

                            const projWeekSegments = consolidateDaySegments(rawProjWeekSegments, weekDays.length);

                            return projWeekSegments.map(({ seg, leftPct, widthPct }) => (
                              <div
                                key={seg.id}
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  minWidth: '24px',
                                }}
                                className={`absolute h-6.5 rounded-full ${getBarColor(seg.status)} select-none transition-all truncate z-10 shadow-sm cursor-pointer hover:brightness-110`}
                                title={`Project: ${project.title} | ${seg.sessionTitle || 'Realization'}: ${formatDuration(seg.loggedSeconds)} (${formatD(seg.startDate)}${seg.startDate.getTime() !== seg.endDate.getTime() ? ` - ${formatD(seg.endDate)}` : ''})`}
                              />
                            ));
                          })()}
                        </div>
                      </div>

                      {/* ===== SUBSEQUENT TASK ITEMS UNDER THIS PROJECT (WEEK) ===== */}
                      {!isProjectCollapsed &&
                        projectFlatItems.map(({ item, depth }) => {
                          const isExpanded = item.isExpanded !== false;
                          const hasChildren = Boolean(item.subItems && item.subItems.length > 0);

                          const segments = getItemRealizationSegments(item, isExpanded, hasChildren);
                          const hasRealization = segments.length > 0;

                          if (filterMode === 'realized-only' && !hasRealization) {
                            return null;
                          }

                          // Calculate day-snapped week positioning for each segment (fills full day columns, no empty sides)
                          const rawWeekSegments = segments
                            .map((seg) => {
                              const segStartDateMidnight = new Date(seg.startDate.getFullYear(), seg.startDate.getMonth(), seg.startDate.getDate(), 0, 0, 0, 0).getTime();
                              const segEndDateMidnight = new Date(seg.endDate.getFullYear(), seg.endDate.getMonth(), seg.endDate.getDate(), 23, 59, 59, 999).getTime();

                              const span = getWeekColSpan(segStartDateMidnight, segEndDateMidnight);
                              if (!span) return null;

                              return {
                                seg,
                                startCol: span.startCol,
                                endCol: span.endCol,
                              };
                            })
                            .filter(Boolean) as { seg: RealizationSegment; startCol: number; endCol: number }[];

                          // Consolidate segments that overlap on the same day(s) into single full bars
                          const weekSegments = consolidateDaySegments(rawWeekSegments, weekDays.length);

                          const targetPinLeftPct = item.targetDate ? getWeekTargetPinLeftPct(item.targetDate) : null;

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[280px_1fr] hover:bg-[#27272a]/30 transition-colors group border-b border-[#27272a]"
                            >
                              {/* Left Column: Task Name */}
                              <div
                                style={{ paddingLeft: `${14 + depth * 12}px` }}
                                className={`sticky left-0 z-30 bg-[#121215] group-hover:bg-[#18181c] min-h-[44px] h-full p-2.5 font-medium border-r border-[#27272a] truncate flex items-center justify-between gap-1.5 pr-2 select-none ${
                                  hasChildren ? 'cursor-pointer' : 'cursor-default'
                                }`}
                                onClick={() => {
                                  if (hasChildren && onToggleExpand) {
                                    onToggleExpand(item.id);
                                  }
                                }}
                                title={hasChildren ? `${isExpanded ? 'Collapse' : 'Expand'} sub-tasks: ${item.name}` : undefined}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  {/* Chevron / Bullet aligned with TreeView pattern */}
                                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                    {hasChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onToggleExpand) onToggleExpand(item.id);
                                        }}
                                        className="w-4 h-4 rounded flex items-center justify-center hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors shrink-0"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5 text-[#71717a]" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#3f3f46] inline-block" />
                                    )}
                                  </div>

                                  {/* Task Icon / Emoji */}
                                  <span className="text-xs shrink-0 select-none">
                                    {item.icon || (hasChildren ? '📁' : '📄')}
                                  </span>

                                  <div className="min-w-0 truncate flex-1 flex flex-col justify-center">
                                    <span className="truncate text-sm font-medium text-[#f4f4f5] group-hover:text-white">
                                      {item.name}
                                    </span>
                                    {item.notes && (
                                      <span className="truncate text-[11px] font-normal leading-tight text-[#a1a1aa] mt-0.5">
                                        {item.notes}
                                      </span>
                                    )}
                                  </div>

                                  {hasChildren && !isExpanded && (
                                    <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-[#27272a] text-orange-400/90 border border-orange-500/20 shrink-0">
                                      +{item.subItems.length}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right Column: Week Grid with Continuous Positioning */}
                              <div className="relative py-2 px-1 min-h-[44px] h-full flex items-center">
                                {/* Background Grid */}
                                <div
                                  className="absolute inset-0 grid h-full pointer-events-none"
                                  style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(110px, 1fr))` }}
                                >
                                  {weekDays.map((wDate, idx) => {
                                    const isWeekend = wDate.getDay() === 0 || wDate.getDay() === 6;
                                    return (
                                      <div
                                        key={`week-bg-${idx}`}
                                        className={`h-full border-r border-[#27272a]/40 ${
                                          isWeekend ? 'bg-[#18181b]/30' : ''
                                        }`}
                                      />
                                    );
                                  })}
                                </div>

                                {/* Target Date Marker Pin */}
                                {targetPinLeftPct !== null && (
                                  <div
                                    style={{ left: `${targetPinLeftPct}%` }}
                                    className="absolute inset-y-1 -translate-x-1/2 flex items-center justify-center pointer-events-none z-10"
                                    title={`Target Deadline: ${new Date(item.targetDate!).toLocaleDateString('en-GB')}`}
                                  >
                                    <div className="w-1 h-full bg-orange-400/70 rounded-full flex flex-col items-center">
                                      <Flag className="w-3.5 h-3.5 text-orange-400 -mt-1 drop-shadow" />
                                    </div>
                                  </div>
                                )}

                                {/* Week Session Segments with Continuous Exact Positioning */}
                                {weekSegments.map(({ seg, leftPct, widthPct }) => (
                                  <div
                                    key={seg.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onOpenEditItemModal) onOpenEditItemModal(item);
                                    }}
                                    style={{
                                      left: `${leftPct}%`,
                                      width: `${widthPct}%`,
                                      minWidth: '24px',
                                    }}
                                    className={`absolute h-6.5 rounded-full ${getBarColor(seg.status)} cursor-pointer hover:brightness-110 select-none transition-all truncate z-10 shadow-sm`}
                                    title={`Click to edit task: ${item.name} (${getTaskStatusPercentage(item)}%) | ${seg.sessionTitle || 'Realization'}: ${formatDuration(seg.loggedSeconds)} (${formatD(seg.startDate)}${seg.startDate.getTime() !== seg.endDate.getTime() ? ` - ${formatD(seg.endDate)}` : ''})`}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= 3. DAY VIEW (HOURLY) ================= */}
          {timeScale === 'day' && (
            <div className="relative" style={{ minWidth: `${280 + hoursArray.length * 138}px` }}>
              {/* Vertical Today Line (Solid Blue, Hour-sensitive) */}
              <div className="absolute top-0 bottom-0 right-0 left-[280px] pointer-events-none z-30">
                {dayTodayPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-blue-500"
                    style={{ left: `${dayTodayPosition}%` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 -ml-[5px] -mt-1 shadow-sm" />
                    <span className="absolute top-2 -left-3.5 px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] font-sans font-bold tracking-tight shadow-md select-none">
                      Today
                    </span>
                  </div>
                )}
              </div>

              {/* Header Hours (3x wider columns) */}
              <div className="grid grid-cols-[280px_1fr] bg-[#18181b] border-b border-[#27272a] text-xs text-[#a1a1aa] sticky top-0 z-40">
                <div className="sticky left-0 z-50 bg-[#18181b] px-3 py-2 font-sans border-r border-[#27272a] flex items-center justify-center shadow-[4px_0_12px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={handleExpandAll}
                      className="px-2.5 py-1 rounded-md text-[11px] font-sans font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
                      title="Expand All"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={handleCollapseAll}
                      className="px-2.5 py-1 rounded-md text-[11px] font-sans font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
                      title="Collapse All"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
                <div
                  className="grid text-center divide-x divide-[#27272a] py-1.5 font-mono"
                  style={{ gridTemplateColumns: `repeat(${hoursArray.length}, minmax(138px, 1fr))` }}
                >
                  {hoursArray.map((hour) => {
                    const isWorkHour = hour >= 8 && hour < 17; // 08:00 to 17:00
                    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                    const nextHourStr = `${((hour + 1) % 24).toString().padStart(2, '0')}:00`;

                    return (
                      <div
                        key={hour}
                        className={`flex flex-col items-center justify-center py-1.5 transition-colors relative ${
                          isWorkHour
                            ? 'bg-orange-500/10 text-orange-400 font-semibold border-t-2 border-t-orange-500/40'
                            : 'text-[#71717a]'
                        }`}
                      >
                        <span className="text-[11px] font-mono font-semibold tracking-tight">{hourStr}</span>
                        <span className="text-[9px] text-[#71717a] font-mono opacity-80 mt-0.5">
                          {hourStr} - {nextHourStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows for Day View Grouped by Project */}
              <div className="text-xs">
                {filteredProjects.map((project) => {
                  const isProjectCollapsed = collapsedProjectIds.has(project.id);
                  const leafTasks = getLeafFlatItems([project]);
                  const completedCount = leafTasks.filter((f) => f.item.status === 'completed').length;
                  const totalTasks = leafTasks.length;
                  const projectTotalSeconds = project.items.reduce(
                    (acc, it) =>
                      acc +
                      getItemLoggedSeconds(
                        it,
                        appData.settings.activeTimer?.itemId,
                        appData.settings.activeTimer?.startedAt
                      ),
                    0
                  );

                  const { minDate: projMinDate, maxDate: projMaxDate } = getRealizationDatesForProject(project);
                  let projRealizationSummaryText = '';
                  if (projMinDate) {
                    if (projMaxDate && projMinDate.getTime() !== projMaxDate.getTime()) {
                      projRealizationSummaryText = `${formatD(projMinDate)} - ${formatD(projMaxDate)}`;
                    } else {
                      projRealizationSummaryText = formatD(projMinDate);
                    }
                  }

                  const projectFlatItems = filterProjectFlatItems(getVisibleFlatItems([project]));

                  // Calculate total project activity logged today
                  let projectTodaySeconds = 0;
                  leafTasks.forEach(({ item }) => {
                    const segs = getItemRealizationSegments(item, true, false);
                    segs.forEach((s) => {
                      const sMs = s.startDate.getTime();
                      const eMs = s.endDate.getTime();
                      if (sMs <= dayEndMs && eMs >= dayStartMs) {
                        projectTodaySeconds += s.loggedSeconds;
                      }
                    });
                  });

                  if (filterMode === 'realized-only' && projectTodaySeconds === 0 && projectFlatItems.length === 0) {
                    return null;
                  }

                  return (
                    <React.Fragment key={project.id}>
                      {/* ===== PROJECT NODE ROW (DAY) ===== */}
                      <div
                        id={`timeline-project-node-day-${project.id}`}
                        className="grid grid-cols-[280px_1fr] transition-colors group font-sans border-b border-[#27272a]"
                      >
                        {/* Left Column: Project Node Info */}
                        <div
                          style={getProjectCardStyle(project.color)}
                          className="sticky left-0 z-30 min-h-[44px] h-full p-2.5 font-bold border border-r border-[#27272a] truncate flex items-center justify-between gap-2 pr-2.5 cursor-pointer select-none"
                          onClick={() => toggleProjectCollapse(project.id)}
                          title={`${isProjectCollapsed ? 'Expand' : 'Collapse'} project: ${project.title}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectCollapse(project.id);
                              }}
                              className="p-0.5 rounded hover:bg-black/10 text-slate-700 hover:text-slate-950 transition-colors shrink-0"
                            >
                              {isProjectCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-slate-800" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-800" />
                              )}
                            </button>

                            <span className="truncate text-xs font-bold text-slate-950 tracking-tight">
                              {project.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {projRealizationSummaryText ? (
                              <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded bg-black/10 text-slate-900 border border-black/15 font-semibold">
                                {projRealizationSummaryText}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Right Column: Hourly Grid for Project Node (3x wider columns) */}
                        <div className="relative py-2 px-1 min-h-[44px] h-full flex items-center bg-[#141418]/60">
                          {/* Background Hour Column Grid */}
                          <div
                            className="absolute inset-0 grid h-full pointer-events-none"
                            style={{ gridTemplateColumns: `repeat(${hoursArray.length}, minmax(138px, 1fr))` }}
                          >
                            {hoursArray.map((hour) => {
                              const isWorkHour = hour >= 8 && hour < 17;
                              return (
                                <div
                                  key={`day-pbg-${hour}`}
                                  className={`h-full border-r border-[#27272a]/30 relative ${
                                    isWorkHour ? 'bg-orange-500/[0.02]' : 'bg-[#18181b]/20'
                                  }`}
                                >
                                  {/* Half-hour guideline */}
                                  <div className="absolute top-0 bottom-0 left-1/2 border-r border-dashed border-[#27272a]/20" />
                                </div>
                              );
                            })}
                          </div>

                          {/* When project is collapsed, render aggregated task realization cards (acts as parent task) */}
                          {isProjectCollapsed && (() => {
                            const projSegments = getProjectRealizationSegments(project);
                            const projDaySegments = projSegments
                              .map((seg) => {
                                const sMs = seg.startDate.getTime();
                                const eMs = seg.endDate.getTime();

                                if (sMs > dayEndMs || eMs < dayStartMs) {
                                  return null;
                                }

                                const isAllDaySpan = !seg.isSession;
                                let leftPct = 0;
                                let widthPct = 100;
                                let timeRangeStr = 'All Day';

                                if (!isAllDaySpan) {
                                  const visibleStartMs = Math.max(dayStartMs, sMs);
                                  const visibleEndMs = Math.min(dayEndMs, Math.max(visibleStartMs + 60000, eMs));

                                  leftPct = ((visibleStartMs - dayStartMs) / totalDayMs) * 100;
                                  widthPct = Math.max(0.5, ((visibleEndMs - visibleStartMs) / totalDayMs) * 100);

                                  const pad = (n: number) => n.toString().padStart(2, '0');
                                  timeRangeStr = `${pad(seg.startDate.getHours())}:${pad(seg.startDate.getMinutes())} - ${pad(seg.endDate.getHours())}:${pad(seg.endDate.getMinutes())}`;
                                }

                                return {
                                  seg,
                                  leftPct,
                                  widthPct,
                                  timeRangeStr,
                                };
                              })
                              .filter(Boolean) as {
                              seg: RealizationSegment;
                              leftPct: number;
                              widthPct: number;
                              timeRangeStr: string;
                            }[];

                            return projDaySegments.map(({ seg, leftPct, widthPct, timeRangeStr }) => (
                              <div
                                key={seg.id}
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  minWidth: '24px',
                                }}
                                className={`absolute h-6.5 rounded-full ${getBarColor(seg.status)} select-none transition-all truncate z-10 shadow-sm cursor-pointer hover:brightness-110`}
                                title={`Project: ${project.title} | ${seg.sessionTitle || 'Period'}: ${timeRangeStr} ${seg.loggedSeconds ? `(${formatDuration(seg.loggedSeconds)})` : ''}`}
                              />
                            ));
                          })()}
                        </div>
                      </div>

                      {/* ===== SUBSEQUENT TASK ITEMS UNDER THIS PROJECT (DAY) ===== */}
                      {!isProjectCollapsed &&
                        projectFlatItems.map(({ item, depth }) => {
                          const isExpanded = item.isExpanded !== false;
                          const hasChildren = Boolean(item.subItems && item.subItems.length > 0);

                          const segments = getItemRealizationSegments(item, isExpanded, hasChildren);

                          // Find segments active on this day and calculate exact minute-by-minute horizontal positions
                          const daySegments = segments
                            .map((seg) => {
                              const sMs = seg.startDate.getTime();
                              const eMs = seg.endDate.getTime();

                              if (sMs > dayEndMs || eMs < dayStartMs) {
                                return null;
                              }

                              const isAllDaySpan = !seg.isSession;
                              let leftPct = 0;
                              let widthPct = 100;
                              let timeRangeStr = 'All Day';

                              if (!isAllDaySpan) {
                                const visibleStartMs = Math.max(dayStartMs, sMs);
                                const visibleEndMs = Math.min(dayEndMs, Math.max(visibleStartMs + 60000, eMs));

                                leftPct = ((visibleStartMs - dayStartMs) / totalDayMs) * 100;
                                widthPct = Math.max(0.5, ((visibleEndMs - visibleStartMs) / totalDayMs) * 100);

                                const pad = (n: number) => n.toString().padStart(2, '0');
                                timeRangeStr = `${pad(seg.startDate.getHours())}:${pad(seg.startDate.getMinutes())} - ${pad(seg.endDate.getHours())}:${pad(seg.endDate.getMinutes())}`;
                              }

                              return {
                                seg,
                                leftPct,
                                widthPct,
                                timeRangeStr,
                              };
                            })
                            .filter(Boolean) as {
                            seg: RealizationSegment;
                            leftPct: number;
                            widthPct: number;
                            timeRangeStr: string;
                          }[];

                          const totalTodaySeconds = daySegments.reduce((acc, d) => acc + d.seg.loggedSeconds, 0);

                          if (filterMode === 'realized-only' && daySegments.length === 0) {
                            return null;
                          }

                          // Target deadline marker on this day
                          let targetPinLeftPct: number | null = null;
                          if (item.targetDate) {
                            const tDate = new Date(item.targetDate);
                            const tTime = tDate.getTime();
                            if (tTime >= dayStartMs && tTime <= dayEndMs) {
                              targetPinLeftPct = ((tTime - dayStartMs) / totalDayMs) * 100;
                            }
                          }

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[280px_1fr] hover:bg-[#27272a]/30 transition-colors group border-b border-[#27272a]"
                            >
                              {/* Left Column: Task Name */}
                              <div
                                style={{ paddingLeft: `${14 + depth * 12}px` }}
                                className={`sticky left-0 z-30 bg-[#121215] group-hover:bg-[#18181c] min-h-[44px] h-full p-2.5 font-medium border-r border-[#27272a] truncate flex items-center justify-between gap-1.5 pr-2 select-none ${
                                  hasChildren ? 'cursor-pointer' : 'cursor-default'
                                }`}
                                onClick={() => {
                                  if (hasChildren && onToggleExpand) {
                                    onToggleExpand(item.id);
                                  }
                                }}
                                title={hasChildren ? `${isExpanded ? 'Collapse' : 'Expand'} sub-tasks: ${item.name}` : undefined}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  {/* Chevron / Bullet aligned with TreeView pattern */}
                                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                    {hasChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onToggleExpand) onToggleExpand(item.id);
                                        }}
                                        className="w-4 h-4 rounded flex items-center justify-center hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors shrink-0"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5 text-[#71717a]" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#3f3f46] inline-block" />
                                    )}
                                  </div>

                                  {/* Task Icon / Emoji */}
                                  <span className="text-xs shrink-0 select-none">
                                    {item.icon || (hasChildren ? '📁' : '📄')}
                                  </span>

                                  <div className="min-w-0 truncate flex-1 flex flex-col justify-center">
                                    <span className="truncate text-sm font-medium text-[#f4f4f5] group-hover:text-white">
                                      {item.name}
                                    </span>
                                    {item.notes && (
                                      <span className="truncate text-[11px] font-normal leading-tight text-[#a1a1aa] mt-0.5">
                                        {item.notes}
                                      </span>
                                    )}
                                  </div>

                                  {hasChildren && !isExpanded && (
                                    <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-[#27272a] text-orange-400/90 border border-orange-500/20 shrink-0">
                                      +{item.subItems.length}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right Column: Hourly Timeline with Precise Continuous Positioning (3x wider columns) */}
                              <div className="relative py-2 px-1 min-h-[44px] h-full flex items-center">
                                {/* Background Hour Column Grid */}
                                <div
                                  className="absolute inset-0 grid h-full pointer-events-none"
                                  style={{ gridTemplateColumns: `repeat(${hoursArray.length}, minmax(138px, 1fr))` }}
                                >
                                  {hoursArray.map((hour) => {
                                    const isWorkHour = hour >= 8 && hour < 17;
                                    return (
                                      <div
                                        key={`day-bg-${hour}`}
                                        className={`h-full border-r border-[#27272a]/40 relative ${
                                          isWorkHour ? 'bg-orange-500/[0.04]' : 'bg-[#18181b]/30'
                                        }`}
                                      >
                                        {/* Half-hour guideline */}
                                        <div className="absolute top-0 bottom-0 left-1/2 border-r border-dashed border-[#27272a]/20" />
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Target Marker Pin */}
                                {targetPinLeftPct !== null && (
                                  <div
                                    style={{ left: `${targetPinLeftPct}%` }}
                                    className="absolute inset-y-1 -translate-x-1/2 flex items-center justify-center pointer-events-none z-10"
                                    title={`Target Deadline: ${new Date(item.targetDate!).toLocaleTimeString('en-GB')}`}
                                  >
                                    <div className="w-1 h-full bg-orange-400/70 rounded-full flex flex-col items-center">
                                      <Flag className="w-3.5 h-3.5 text-orange-400 -mt-1 drop-shadow" />
                                    </div>
                                  </div>
                                )}

                                {/* Hourly Session Segments Placed at Exact Minutes */}
                                {daySegments.map(({ seg, leftPct, widthPct, timeRangeStr }) => (
                                  <div
                                    key={seg.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onOpenEditItemModal) onOpenEditItemModal(item);
                                    }}
                                    style={{
                                      left: `${leftPct}%`,
                                      width: `${widthPct}%`,
                                      minWidth: '24px',
                                    }}
                                    className={`absolute h-6.5 rounded-full ${getBarColor(seg.status)} cursor-pointer hover:brightness-110 select-none transition-all truncate z-10 shadow-sm`}
                                    title={`Click to edit task: ${item.name} (${getTaskStatusPercentage(item)}%) | ${seg.sessionTitle || 'Period'}: ${timeRangeStr} ${seg.loggedSeconds ? `(${formatDuration(seg.loggedSeconds)})` : ''}`}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= 4. YEAR VIEW (12 MONTHS) ================= */}
          {timeScale === 'year' && (
            <div className="relative" style={{ minWidth: '1180px' }}>
              {/* Vertical Today Line (Solid Blue, Hour-sensitive) */}
              <div className="absolute top-0 bottom-0 right-0 left-[280px] pointer-events-none z-30">
                {yearTodayPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-blue-500"
                    style={{ left: `${yearTodayPosition}%` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 -ml-[5px] -mt-1 shadow-sm" />
                    <span className="absolute top-2 -left-3.5 px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] font-sans font-bold tracking-tight shadow-md select-none">
                      Today
                    </span>
                  </div>
                )}
              </div>

              {/* Header 12 Months */}
              <div className="grid grid-cols-[280px_1fr] bg-[#18181b] border-b border-[#27272a] text-xs text-[#a1a1aa] sticky top-0 z-40">
                <div className="sticky left-0 z-50 bg-[#18181b] px-3 py-2 font-sans border-r border-[#27272a] flex items-center justify-center shadow-[4px_0_12px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={handleExpandAll}
                      className="px-2.5 py-1 rounded-md text-[11px] font-sans font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
                      title="Expand All"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={handleCollapseAll}
                      className="px-2.5 py-1 rounded-md text-[11px] font-sans font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
                      title="Collapse All"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
                <div
                  className="grid text-center divide-x divide-[#27272a] py-2 font-mono"
                  style={{ gridTemplateColumns: 'repeat(12, minmax(75px, 1fr))' }}
                >
                  {monthNames.map((mName, mIdx) => {
                    const isCurrentMonthNow =
                      new Date().getFullYear() === currentYear && new Date().getMonth() === mIdx;

                    return (
                      <div
                        key={mIdx}
                        className={`flex flex-col items-center justify-center py-1 transition-colors ${
                          isCurrentMonthNow
                            ? 'bg-orange-500/20 text-orange-400 font-bold border-t-2 border-t-orange-500'
                            : 'text-[#a1a1aa]'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {mName.substring(0, 3)}
                        </span>
                        <span className="text-[9px] text-[#71717a] mt-0.5">
                          {new Date(currentYear, mIdx + 1, 0).getDate()}d
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows for Year Grouped by Project */}
              <div className="text-xs">
                {filteredProjects.map((project) => {
                  const isProjectCollapsed = collapsedProjectIds.has(project.id);
                  const leafTasks = getLeafFlatItems([project]);
                  const { minDate: projMinDate, maxDate: projMaxDate } = getRealizationDatesForProject(project);

                  let projRealizationSummaryText = '';
                  if (projMinDate) {
                    if (projMaxDate && projMinDate.getTime() !== projMaxDate.getTime()) {
                      projRealizationSummaryText = `${formatD(projMinDate)} - ${formatD(projMaxDate)}`;
                    } else {
                      projRealizationSummaryText = formatD(projMinDate);
                    }
                  }

                  const projectFlatItems = filterProjectFlatItems(getVisibleFlatItems([project]));

                  if (filterMode === 'realized-only' && !projMinDate && projectFlatItems.length === 0) {
                    return null;
                  }

                  return (
                    <React.Fragment key={project.id}>
                      {/* ===== PROJECT NODE ROW (YEAR) ===== */}
                      <div
                        id={`timeline-project-node-year-${project.id}`}
                        className="grid grid-cols-[280px_1fr] transition-colors group font-sans border-b border-[#27272a]"
                      >
                        {/* Left Column: Project Node Info */}
                        <div
                          style={getProjectCardStyle(project.color)}
                          className="sticky left-0 z-30 min-h-[44px] h-full p-2.5 font-bold border border-r border-[#27272a] truncate flex items-center justify-between gap-2 pr-2.5 cursor-pointer select-none"
                          onClick={() => toggleProjectCollapse(project.id)}
                          title={`${isProjectCollapsed ? 'Expand' : 'Collapse'} project: ${project.title}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectCollapse(project.id);
                              }}
                              className="p-0.5 rounded hover:bg-black/10 text-slate-700 hover:text-slate-950 transition-colors shrink-0"
                            >
                              {isProjectCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-slate-800" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-800" />
                              )}
                            </button>

                            <span className="truncate text-xs font-bold text-slate-950 tracking-tight">
                              {project.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {projRealizationSummaryText ? (
                              <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded bg-black/10 text-slate-900 border border-black/15 font-semibold">
                                {projRealizationSummaryText}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Right Column: Year Grid for Project Node */}
                        <div className="relative py-2 px-1 min-h-[44px] h-full flex items-center bg-[#141418]/60">
                          {/* Background Grid Months */}
                          <div
                            className="absolute inset-0 grid h-full pointer-events-none"
                            style={{ gridTemplateColumns: 'repeat(12, minmax(75px, 1fr))' }}
                          >
                            {monthNames.map((_, mIdx) => (
                              <div
                                key={`proj-ybg-${mIdx}`}
                                className="h-full border-r border-[#27272a]/30"
                              />
                            ))}
                          </div>

                          {/* When project is collapsed, render aggregated task realization cards (acts as parent task) */}
                          {isProjectCollapsed && (() => {
                            const projSegments = getProjectRealizationSegments(project);
                            const rawProjYearSegments = projSegments
                              .map((seg) => {
                                const sMs = seg.startDate.getTime();
                                const eMs = seg.endDate.getTime();

                                if (eMs < yearStartMs || sMs > yearEndMs) {
                                  return null;
                                }

                                const startCol = seg.startDate.getFullYear() < currentYear ? 0 : seg.startDate.getMonth();
                                const endCol = seg.endDate.getFullYear() > currentYear ? 11 : seg.endDate.getMonth();

                                return {
                                  seg,
                                  startCol,
                                  endCol,
                                };
                              })
                              .filter(Boolean) as { seg: RealizationSegment; startCol: number; endCol: number }[];

                            const projYearSegments = consolidateDaySegments(rawProjYearSegments, 12);

                            return projYearSegments.map(({ seg, leftPct, widthPct }) => (
                              <div
                                key={seg.id}
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  minWidth: '24px',
                                }}
                                className={`absolute h-6 rounded-full ${getBarColor(seg.status)} select-none transition-all truncate z-10 shadow-sm cursor-pointer hover:brightness-110`}
                                title={`Project: ${project.title} | ${seg.sessionTitle || 'Realization'}: ${formatDuration(seg.loggedSeconds)} (${formatD(seg.startDate)}${seg.startDate.getTime() !== seg.endDate.getTime() ? ` - ${formatD(seg.endDate)}` : ''})`}
                              />
                            ));
                          })()}
                        </div>
                      </div>

                      {/* ===== SUBSEQUENT TASK ITEMS UNDER THIS PROJECT (YEAR) ===== */}
                      {!isProjectCollapsed &&
                        projectFlatItems.map(({ item, depth }) => {
                          const isExpanded = item.isExpanded !== false;
                          const hasChildren = Boolean(item.subItems && item.subItems.length > 0);

                          const segments = getItemRealizationSegments(item, isExpanded, hasChildren);
                          const hasRealization = segments.length > 0;

                          if (filterMode === 'realized-only' && !hasRealization) {
                            return null;
                          }

                          // Calculate month-snapped year positioning for each segment
                          const rawYearSegments = segments
                            .map((seg) => {
                              const sMs = seg.startDate.getTime();
                              const eMs = seg.endDate.getTime();

                              if (eMs < yearStartMs || sMs > yearEndMs) {
                                return null;
                              }

                              const startCol = seg.startDate.getFullYear() < currentYear ? 0 : seg.startDate.getMonth();
                              const endCol = seg.endDate.getFullYear() > currentYear ? 11 : seg.endDate.getMonth();

                              return {
                                seg,
                                startCol,
                                endCol,
                              };
                            })
                            .filter(Boolean) as { seg: RealizationSegment; startCol: number; endCol: number }[];

                          // Consolidate segments that overlap on the same month(s) into single full bars
                          const yearSegments = consolidateDaySegments(rawYearSegments, 12);

                          let targetPinLeftPct: number | null = null;
                          if (item.targetDate) {
                            const tDate = new Date(item.targetDate);
                            if (tDate.getFullYear() === currentYear) {
                              targetPinLeftPct = ((tDate.getMonth() + 0.5) / 12) * 100;
                            }
                          }

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[280px_1fr] hover:bg-[#27272a]/30 transition-colors group border-b border-[#27272a]"
                            >
                              {/* Left Column: Task Name */}
                              <div
                                style={{ paddingLeft: `${14 + depth * 12}px` }}
                                className={`sticky left-0 z-30 bg-[#121215] group-hover:bg-[#18181c] min-h-[44px] h-full p-2.5 font-medium border-r border-[#27272a] truncate flex items-center justify-between gap-1.5 pr-2 select-none ${
                                  hasChildren ? 'cursor-pointer' : 'cursor-default'
                                }`}
                                onClick={() => {
                                  if (hasChildren && onToggleExpand) {
                                    onToggleExpand(item.id);
                                  }
                                }}
                                title={hasChildren ? `${isExpanded ? 'Collapse' : 'Expand'} sub-tasks: ${item.name}` : undefined}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  {/* Chevron / Bullet aligned with TreeView pattern */}
                                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                    {hasChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onToggleExpand) onToggleExpand(item.id);
                                        }}
                                        className="w-4 h-4 rounded flex items-center justify-center hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors shrink-0"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5 text-[#71717a]" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#3f3f46] inline-block" />
                                    )}
                                  </div>

                                  {/* Task Icon / Emoji */}
                                  <span className="text-xs shrink-0 select-none">
                                    {item.icon || (hasChildren ? '📁' : '📄')}
                                  </span>

                                  <div className="min-w-0 truncate flex-1 flex flex-col justify-center">
                                    <span className="truncate text-sm font-medium text-[#f4f4f5] group-hover:text-white">
                                      {item.name}
                                    </span>
                                    {item.notes && (
                                      <span className="truncate text-[11px] font-normal leading-tight text-[#a1a1aa] mt-0.5">
                                        {item.notes}
                                      </span>
                                    )}
                                  </div>

                                  {hasChildren && !isExpanded && (
                                    <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-[#27272a] text-orange-400/90 border border-orange-500/20 shrink-0">
                                      +{item.subItems.length}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right Column: Year Grid with Continuous Positioning */}
                              <div className="relative py-2 px-1 min-h-[44px] h-full flex items-center">
                                {/* Background Grid Months */}
                                <div
                                  className="absolute inset-0 grid h-full pointer-events-none"
                                  style={{ gridTemplateColumns: 'repeat(12, minmax(75px, 1fr))' }}
                                >
                                  {monthNames.map((_, mIdx) => (
                                    <div
                                      key={`ybg-${mIdx}`}
                                      className="h-full border-r border-[#27272a]/40"
                                    />
                                  ))}
                                </div>

                                {/* Target Date Marker Pin */}
                                {targetPinLeftPct !== null && (
                                  <div
                                    style={{ left: `${targetPinLeftPct}%` }}
                                    className="absolute inset-y-1 -translate-x-1/2 flex items-center justify-center pointer-events-none z-10"
                                    title={`Target Deadline: ${new Date(item.targetDate!).toLocaleDateString('en-GB')}`}
                                  >
                                    <div className="w-1 h-full bg-orange-400/70 rounded-full flex flex-col items-center">
                                      <Flag className="w-3.5 h-3.5 text-orange-400 -mt-1 drop-shadow" />
                                    </div>
                                  </div>
                                )}

                                {/* Year Session Segments */}
                                {yearSegments.map(({ seg, leftPct, widthPct }) => (
                                  <div
                                    key={seg.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onOpenEditItemModal) onOpenEditItemModal(item);
                                    }}
                                    style={{
                                      left: `${leftPct}%`,
                                      width: `${widthPct}%`,
                                      minWidth: '24px',
                                    }}
                                    className={`absolute h-6.5 rounded-full ${getBarColor(seg.status)} cursor-pointer hover:brightness-110 select-none transition-all truncate z-10 shadow-sm`}
                                    title={`Click to edit task: ${item.name} (${getTaskStatusPercentage(item)}%) | ${seg.sessionTitle || 'Realization'}: ${formatDuration(seg.loggedSeconds)} (${formatD(seg.startDate)}${seg.startDate.getTime() !== seg.endDate.getTime() ? ` - ${formatD(seg.endDate)}` : ''})`}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {activeProjects.length === 0 && (
            <div className="p-12 text-center text-[#71717a]">
              <Folder className="w-10 h-10 mx-auto text-[#3f3f46] mb-2" />
              <p className="text-sm">No active projects or tasks found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

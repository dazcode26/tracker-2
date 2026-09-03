import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  Filter,
  Search,
  Check,
  CalendarDays,
  Folder,
  Layers,
  X,
  Eye,
  Sparkles,
} from 'lucide-react';
import { TimeBasedToolbar } from './TimeBasedToolbar';
import { AppData, ItemNode, ItemStatus, ProjectNode, Session } from '../types';
import {
  getAllFlatItems,
  getReportableFlatItems,
  getAllItemSessionsRecursive,
  formatDuration,
  getStatusConfig,
} from '../utils/treeUtils';

export type CalendarViewType = 'day' | 'week' | 'month' | 'year';

interface CalendarViewProps {
  appData: AppData;
  onOpenEditItemModal?: (item: ItemNode) => void;
  onOpenAddItemModal?: (parentItemId?: string, projectId?: string, initialDate?: string) => void;
  selectedProjectId?: string;
  onSelectProjectFilter?: (projectId: string) => void;
  selectedPersonId?: string;
  onSelectPersonFilter?: (personId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  timeScale?: CalendarViewType;
  onTimeScaleChange?: (scale: CalendarViewType) => void;
  currentDate?: Date;
  onCurrentDateChange?: (date: Date) => void;
  showWeekends?: boolean;
  onShowWeekendsChange?: (show: boolean) => void;
  showCompleted?: boolean;
  onShowCompletedChange?: (show: boolean) => void;
}

interface CalendarEvent {
  id: string;
  itemId: string;
  item: ItemNode;
  project: ProjectNode;
  title: string;
  dateKey: string; // YYYY-MM-DD
  endDateKey?: string; // YYYY-MM-DD for multi-day
  isAllDay: boolean;
  startTimeStr?: string; // HH:MM
  endTimeStr?: string; // HH:MM
  startHour?: number; // 0 - 23.99
  endHour?: number; // 0 - 23.99
  durationSeconds: number;
  status: ItemStatus;
  isSession: boolean;
  sessionTitle?: string;
  sessionCount?: number;
  color: string;
}

interface MonthDayTask {
  id: string;
  itemId: string;
  item: ItemNode;
  project: ProjectNode;
  title: string;
  status: ItemStatus;
  color: string;
  isAllDay: boolean;
  totalDurationSeconds: number;
  sessionCount: number;
  timeRangeStr?: string;
  earliestStartMs?: number;
}

const DAYS_OF_WEEK_MON = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_OF_WEEK_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateSafe(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

interface LayoutedTimedEvent {
  event: CalendarEvent;
  topPx: number;
  heightPx: number;
}

/**
 * Calculates vertical positions for timed events on a day column to ensure
 * they NEVER overlap each other, nudging colliding cards down smoothly with a clean gap.
 */
function calculateNonOverlappingLayout(
  events: CalendarEvent[],
  hourHeight: number,
  minCardHeight: number = 42,
  gapPx: number = 5
): LayoutedTimedEvent[] {
  if (!events || events.length === 0) return [];

  // Sort events by starting hour ascending, then duration descending
  const sorted = [...events].sort((a, b) => {
    const aStart = a.startHour ?? 9;
    const bStart = b.startHour ?? 9;
    if (Math.abs(aStart - bStart) > 0.001) {
      return aStart - bStart;
    }
    return (b.durationSeconds || 0) - (a.durationSeconds || 0);
  });

  const result: LayoutedTimedEvent[] = [];
  let lastBottomPx = -1;

  for (const ev of sorted) {
    const startHr = ev.startHour ?? 9;
    const naturalDurationHrs = Math.max(0.6, (ev.durationSeconds || 1800) / 3600);
    const naturalTopPx = startHr * hourHeight;
    const naturalHeightPx = Math.max(minCardHeight, naturalDurationHrs * hourHeight);

    // If naturalTop overlaps with the previous event's bottom, nudge it down smoothly
    let adjustedTopPx = naturalTopPx;
    if (lastBottomPx >= 0 && adjustedTopPx < lastBottomPx + gapPx) {
      adjustedTopPx = lastBottomPx + gapPx;
    }

    const finalHeightPx = naturalHeightPx;

    result.push({
      event: ev,
      topPx: adjustedTopPx,
      heightPx: finalHeightPx,
    });

    lastBottomPx = adjustedTopPx + finalHeightPx;
  }

  return result;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  appData,
  onOpenEditItemModal,
  onOpenAddItemModal,
  selectedProjectId = 'all',
  onSelectProjectFilter,
  selectedPersonId = 'all',
  onSelectPersonFilter,
  searchQuery = '',
  onSearchChange,
  timeScale,
  onTimeScaleChange,
  currentDate: controlledCurrentDate,
  onCurrentDateChange,
  showWeekends: controlledShowWeekends,
  onShowWeekendsChange,
  showCompleted: controlledShowCompleted,
  onShowCompletedChange,
}) => {
  // Calendar view mode: Day, Week, Month, Year
  const [internalViewType, setInternalViewType] = useState<CalendarViewType>(() => {
    try {
      const saved =
        localStorage.getItem('struktur_filter_timescale') ||
        localStorage.getItem('struktur_calendar_viewtype') ||
        localStorage.getItem('struktur_timeline_timescale');
      if (saved && ['day', 'week', 'month', 'year'].includes(saved)) {
        return saved as CalendarViewType;
      }
    } catch {
      // ignore
    }
    return 'month';
  });

  const viewType = timeScale !== undefined ? timeScale : internalViewType;

  const setViewType = (newType: CalendarViewType) => {
    if (onTimeScaleChange) {
      onTimeScaleChange(newType);
    }
    setInternalViewType(newType);
    try {
      localStorage.setItem('struktur_filter_timescale', newType);
      localStorage.setItem('struktur_calendar_viewtype', newType);
      localStorage.setItem('struktur_timeline_timescale', newType);
    } catch {
      // ignore
    }
  };

  // Selected date reference (Defaults to today, synced with localStorage and shared prop)
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

  // Controls & Dropdown States
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);
  
  // Local fallbacks if props are not provided
  const [internalSelectedProjectId, setInternalSelectedProjectId] = useState<string>('all');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');

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

  const handleSearchInputChange = (query: string) => {
    if (onSearchChange) {
      onSearchChange(query);
    } else {
      setInternalSearchQuery(query);
    }
  };

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

  // Popover for "+N more" events
  const [popoverDay, setPopoverDay] = useState<{ date: Date; dateKey: string; tasks: MonthDayTask[] } | null>(null);

  // DatePicker state
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(() => new Date());

  // Time grid scroll ref
  const timeGridScrollRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const projectFilterRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsViewDropdownOpen(false);
      }
      if (projectFilterRef.current && !projectFilterRef.current.contains(e.target as Node)) {
        setIsProjectFilterOpen(false);
      }
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard navigation shortcuts (D, W, M, Y, T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      const key = e.key.toUpperCase();
      if (key === 'D') setViewType('day');
      else if (key === 'W') setViewType('week');
      else if (key === 'M') setViewType('month');
      else if (key === 'Y') setViewType('year');
      else if (key === 'T') setCurrentDate(new Date());
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll time grid to 08:00 on Day/Week view mount
  useEffect(() => {
    if ((viewType === 'day' || viewType === 'week') && timeGridScrollRef.current) {
      // 8 AM = 8 * 56px = 448px
      timeGridScrollRef.current.scrollTop = 448;
    }
  }, [viewType]);

  // Extract all active projects
  const activeProjects = useMemo(() => {
    return appData.projects.filter((p) => p.status === 'active');
  }, [appData.projects]);

  // Extract and flatten reportable tasks into calendar events
  const allEvents = useMemo(() => {
    const flatItems = getReportableFlatItems(activeProjects);
    const events: CalendarEvent[] = [];

    for (const { item, project } of flatItems) {
      const projectColor = project.color || '#f97316';

      // 1. Gather all sessions (direct + descendant sessions rolled up to this item)
      const allItemSessions = getAllItemSessionsRecursive(
        item,
        appData.settings.activeTimer?.itemId,
        appData.settings.activeTimer?.startedAt
      );

      if (allItemSessions.length > 0) {
        for (const sess of allItemSessions) {
          const startD = parseDateSafe(sess.startedAt);
          if (!startD) continue;

          const isManualRange = sess.type === 'manual-range' || (!sess.loggedSeconds && sess.endedAt && sess.endedAt !== sess.startedAt);

          if (isManualRange) {
            const endD = parseDateSafe(sess.endedAt || sess.startedAt);
            events.push({
              id: `event-sess-${sess.id}`,
              itemId: item.id,
              item,
              project,
              title: item.name,
              dateKey: formatDateKey(startD),
              endDateKey: endD ? formatDateKey(endD) : undefined,
              isAllDay: true,
              durationSeconds: 0,
              status: item.status,
              isSession: false,
              sessionTitle: sess.title || 'Realization Period',
              color: projectColor,
            });
            continue;
          }

          const startHour = startD.getHours() + startD.getMinutes() / 60;
          let endHour = startHour + (sess.loggedSeconds || 3600) / 3600;
          if (endHour > 24) endHour = 24;

          const startTimeStr = `${pad2(startD.getHours())}:${pad2(startD.getMinutes())}`;
          const endD = sess.endedAt ? parseDateSafe(sess.endedAt) : new Date(startD.getTime() + (sess.loggedSeconds || 0) * 1000);
          const endTimeStr = endD ? `${pad2(endD.getHours())}:${pad2(endD.getMinutes())}` : undefined;

          events.push({
            id: `event-sess-${sess.id}`,
            itemId: item.id,
            item,
            project,
            title: item.name,
            dateKey: formatDateKey(startD),
            isAllDay: false,
            startTimeStr,
            endTimeStr,
            startHour,
            endHour,
            durationSeconds: sess.loggedSeconds,
            status: item.status,
            isSession: true,
            sessionTitle: sess.title || `Realization (${formatDuration(sess.loggedSeconds)})`,
            color: projectColor,
          });
        }
      }

      // 2. Check Target Date (Deadline / Scheduled task date)
      if (item.targetDate) {
        const targetD = parseDateSafe(item.targetDate);
        if (targetD) {
          events.push({
            id: `event-target-${item.id}`,
            itemId: item.id,
            item,
            project,
            title: item.name,
            dateKey: formatDateKey(targetD),
            isAllDay: true,
            durationSeconds: item.estimatedSeconds || 0,
            status: item.status,
            isSession: false,
            color: projectColor,
          });
        }
      }

      // 3. Check Actual Start / End Date (Multi-day date range)
      if (item.actualStartDate && (!allItemSessions || allItemSessions.length === 0)) {
        const startD = parseDateSafe(item.actualStartDate);
        const endD = parseDateSafe(item.actualEndDate || item.actualStartDate);

        if (startD) {
          events.push({
            id: `event-actual-${item.id}`,
            itemId: item.id,
            item,
            project,
            title: item.name,
            dateKey: formatDateKey(startD),
            endDateKey: endD ? formatDateKey(endD) : undefined,
            isAllDay: true,
            durationSeconds: 0,
            status: item.status,
            isSession: false,
            color: projectColor,
          });
        }
      }
    }

    return events;
  }, [activeProjects, appData.settings.activeTimer]);

  // Filter events based on active filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (currentProjectId !== 'all' && ev.project.id !== currentProjectId) {
        return false;
      }
      if (selectedPersonId && selectedPersonId !== 'all') {
        const matchAssignee = ev.item.assigneeId === selectedPersonId;
        const matchReviewer = ev.item.reviewerId === selectedPersonId;
        if (!matchAssignee && !matchReviewer) return false;
      }
      if (!showCompleted && ev.status === 'completed') {
        return false;
      }
      if (currentSearchQuery.trim()) {
        const q = currentSearchQuery.toLowerCase();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchProj = ev.project.title.toLowerCase().includes(q);
        if (!matchTitle && !matchProj) return false;
      }
      return true;
    });
  }, [allEvents, currentProjectId, selectedPersonId, showCompleted, currentSearchQuery]);

  // Map events by dateKey for fast lookup
  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of filteredEvents) {
      // If multi-day event spanning start to end
      if (ev.endDateKey && ev.endDateKey !== ev.dateKey) {
        const start = parseDateSafe(ev.dateKey);
        const end = parseDateSafe(ev.endDateKey);
        if (start && end) {
          const curr = new Date(start);
          while (curr <= end) {
            const key = formatDateKey(curr);
            const list = map.get(key) || [];
            list.push(ev);
            map.set(key, list);
            curr.setDate(curr.getDate() + 1);
          }
          continue;
        }
      }

      const list = map.get(ev.dateKey) || [];
      list.push(ev);
      map.set(ev.dateKey, list);
    }
    return map;
  }, [filteredEvents]);

  // Consolidate events by reportable task on each date for Month & Year views
  const monthTasksByDateKey = useMemo(() => {
    const map = new Map<string, MonthDayTask[]>();

    eventsByDateKey.forEach((events, dateKey) => {
      const itemGroupMap = new Map<string, CalendarEvent[]>();
      for (const ev of events) {
        const key = ev.itemId || ev.item.id;
        const list = itemGroupMap.get(key) || [];
        list.push(ev);
        itemGroupMap.set(key, list);
      }

      const tasksForDay: MonthDayTask[] = [];

      itemGroupMap.forEach((itemEvents, itemId) => {
        const firstEv = itemEvents[0];
        const totalDuration = itemEvents.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
        const sessionEvents = itemEvents.filter((e) => e.isSession);
        const sessionCount = sessionEvents.length;

        // Determine earliest & latest times if any timed sessions exist
        const timedSessions = sessionEvents.filter((e) => !e.isAllDay && e.startTimeStr);
        let timeRangeStr: string | undefined;
        if (timedSessions.length > 0) {
          timedSessions.sort((a, b) => (a.startHour ?? 0) - (b.startHour ?? 0));
          const earliest = timedSessions[0].startTimeStr;
          const latest = timedSessions[timedSessions.length - 1].endTimeStr || timedSessions[timedSessions.length - 1].startTimeStr;
          timeRangeStr =
            timedSessions.length === 1 && timedSessions[0].endTimeStr
              ? `${timedSessions[0].startTimeStr}-${timedSessions[0].endTimeStr}`
              : timedSessions.length === 1
              ? earliest
              : `${earliest}-${latest}`;
        }

        const isAllDay = itemEvents.every((e) => e.isAllDay) || timedSessions.length === 0;

        // Calculate earliest session start timestamp on this date for accurate chronological ordering
        let earliestStartMs: number | undefined;
        for (const ev of itemEvents) {
          if (ev.isSession && ev.item.sessions) {
            for (const sess of ev.item.sessions) {
              if (sess.startedAt) {
                const sDate = new Date(sess.startedAt);
                if (formatDateKey(sDate) === dateKey) {
                  const ms = sDate.getTime();
                  if (earliestStartMs === undefined || ms < earliestStartMs) {
                    earliestStartMs = ms;
                  }
                }
              }
            }
          } else if (!ev.isAllDay && ev.startHour !== undefined) {
            const ms = ev.startHour * 3600 * 1000;
            if (earliestStartMs === undefined || ms < earliestStartMs) {
              earliestStartMs = ms;
            }
          }
        }

        tasksForDay.push({
          id: `month-task-${dateKey}-${itemId}`,
          itemId,
          item: firstEv.item,
          project: firstEv.project,
          title: firstEv.item.name,
          status: firstEv.item.status,
          color: firstEv.color,
          isAllDay,
          totalDurationSeconds: totalDuration,
          sessionCount,
          timeRangeStr,
          earliestStartMs,
        });
      });

      // Sort tasks chronologically: tasks starting earlier in the day appear first
      tasksForDay.sort((a, b) => {
        if (a.earliestStartMs !== undefined && b.earliestStartMs !== undefined) {
          return a.earliestStartMs - b.earliestStartMs;
        }
        if (a.earliestStartMs !== undefined) return -1;
        if (b.earliestStartMs !== undefined) return 1;
        return 0;
      });

      map.set(dateKey, tasksForDay);
    });

    return map;
  }, [eventsByDateKey]);

  // Consolidated events for Week and Day views (merging sessions for summary tasks on each date)
  const weekEventsByDateKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    eventsByDateKey.forEach((events, dateKey) => {
      const itemGroupMap = new Map<string, CalendarEvent[]>();
      for (const ev of events) {
        const key = ev.itemId || ev.item.id;
        const list = itemGroupMap.get(key) || [];
        list.push(ev);
        itemGroupMap.set(key, list);
      }

      const consolidatedList: CalendarEvent[] = [];

      itemGroupMap.forEach((itemEvents, itemId) => {
        const firstEv = itemEvents[0];
        const isSummaryTask = firstEv.item.showInSummary === true;

        // If the task has summary enabled or multiple sessions on this date, consolidate its sessions
        if (isSummaryTask || itemEvents.length > 1) {
          const sessionEvents = itemEvents.filter((e) => e.isSession);
          const nonSessionEvents = itemEvents.filter((e) => !e.isSession);

          if (sessionEvents.length > 0) {
            const timedSessions = sessionEvents.filter((e) => !e.isAllDay && e.startTimeStr);
            const totalDuration = sessionEvents.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);

            if (timedSessions.length > 0) {
              timedSessions.sort((a, b) => (a.startHour ?? 0) - (b.startHour ?? 0));
              const earliest = timedSessions[0];
              const latest = timedSessions[timedSessions.length - 1];

              const earliestStartHour = earliest.startHour ?? 0;
              const latestEndHour = latest.endHour ?? earliestStartHour + 1;
              const earliestStartTimeStr = earliest.startTimeStr;
              const latestEndTimeStr = latest.endTimeStr || latest.startTimeStr;

              consolidatedList.push({
                id: `week-merged-sess-${dateKey}-${itemId}`,
                itemId,
                item: firstEv.item,
                project: firstEv.project,
                title: firstEv.item.name,
                dateKey,
                isAllDay: false,
                startTimeStr: earliestStartTimeStr,
                endTimeStr: latestEndTimeStr,
                startHour: earliestStartHour,
                endHour: Math.max(earliestStartHour + totalDuration / 3600, latestEndHour),
                durationSeconds: totalDuration,
                status: firstEv.item.status,
                isSession: true,
                sessionCount: sessionEvents.length,
                sessionTitle: sessionEvents.length > 1 ? `${sessionEvents.length} Sessions (Summary)` : firstEv.sessionTitle,
                color: firstEv.color,
              });
            } else {
              // All-day sessions
              consolidatedList.push({
                id: `week-merged-allday-${dateKey}-${itemId}`,
                itemId,
                item: firstEv.item,
                project: firstEv.project,
                title: firstEv.item.name,
                dateKey,
                isAllDay: true,
                durationSeconds: totalDuration,
                status: firstEv.item.status,
                isSession: true,
                sessionCount: sessionEvents.length,
                sessionTitle: sessionEvents.length > 1 ? `${sessionEvents.length} Sessions (Summary)` : firstEv.sessionTitle,
                color: firstEv.color,
              });
            }
          }

          // If there are non-session events (such as deadline or target date)
          if (sessionEvents.length === 0 && nonSessionEvents.length > 0) {
            consolidatedList.push(nonSessionEvents[0]);
          }
        } else {
          // Regular single event
          consolidatedList.push(...itemEvents);
        }
      });

      // Sort consolidated items chronologically
      consolidatedList.sort((a, b) => {
        const hourA = a.startHour ?? (a.isAllDay ? 99 : 0);
        const hourB = b.startHour ?? (b.isAllDay ? 99 : 0);
        return hourA - hourB;
      });

      map.set(dateKey, consolidatedList);
    });

    return map;
  }, [eventsByDateKey]);

  // Navigation handlers
  const handlePrev = () => {
    const newD = new Date(currentDate);
    if (viewType === 'day') {
      newD.setDate(newD.getDate() - 1);
    } else if (viewType === 'week') {
      newD.setDate(newD.getDate() - 7);
    } else if (viewType === 'month') {
      newD.setMonth(newD.getMonth() - 1);
    } else if (viewType === 'year') {
      newD.setFullYear(newD.getFullYear() - 1);
    }
    setCurrentDate(newD);
  };

  const handleNext = () => {
    const newD = new Date(currentDate);
    if (viewType === 'day') {
      newD.setDate(newD.getDate() + 1);
    } else if (viewType === 'week') {
      newD.setDate(newD.getDate() + 7);
    } else if (viewType === 'month') {
      newD.setMonth(newD.getMonth() + 1);
    } else if (viewType === 'year') {
      newD.setFullYear(newD.getFullYear() + 1);
    }
    setCurrentDate(newD);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Header Title formatted according to viewType
  const headerTitle = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = MONTH_NAMES[currentDate.getMonth()];
    const day = currentDate.getDate();

    if (viewType === 'day') {
      const dayName = DAYS_OF_WEEK_MON[(currentDate.getDay() + 6) % 7];
      return `${dayName}, ${day} ${month} ${year}`;
    }

    if (viewType === 'week') {
      // Find Monday of current week
      const dayOfWeek = (currentDate.getDay() + 6) % 7; // 0 for Monday
      const monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() - dayOfWeek);
      const endDay = new Date(monday);
      endDay.setDate(monday.getDate() + (showWeekends ? 6 : 4));

      if (monday.getMonth() === endDay.getMonth()) {
        return `${monday.getDate()} – ${endDay.getDate()} ${MONTH_NAMES[monday.getMonth()]} ${year}`;
      } else {
        return `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()].substring(0, 3)} – ${endDay.getDate()} ${MONTH_NAMES[endDay.getMonth()].substring(0, 3)} ${year}`;
      }
    }

    if (viewType === 'month') {
      return `${month} ${year}`;
    }

    if (viewType === 'year') {
      return `${year}`;
    }

    return '';
  }, [currentDate, viewType, showWeekends]);

  // Today comparison helper
  const isTodayDate = (d: Date): boolean => {
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

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
          className={`w-7 h-7 rounded-lg text-xs font-mono flex items-center justify-center transition-all cursor-pointer ${
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

  // --- RENDER MONTH VIEW ---
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of current month
    const firstDayOfMonth = new Date(year, month, 1);
    // Determine starting Monday (0 = Mon, 6 = Sun)
    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;

    // Start date for the calendar grid
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startDayIndex);

    // Generate 5 or 6 weeks of 7 (or 5) days
    const weeks: Date[][] = [];
    const curr = new Date(startDate);

    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(curr);
        const dayOfWeek = (dayDate.getDay() + 6) % 7; // 0=Mon, 5=Sat, 6=Sun
        if (showWeekends || (dayOfWeek !== 5 && dayOfWeek !== 6)) {
          week.push(dayDate);
        }
        curr.setDate(curr.getDate() + 1);
      }
      if (week.length > 0) {
        weeks.push(week);
      }
      // If the next week starts in the next month and we've already rendered at least 5 weeks, we can stop
      if (w >= 4 && curr.getMonth() !== month) {
        break;
      }
    }

    const dayHeadersShort = showWeekends ? DAYS_OF_WEEK_SHORT : DAYS_OF_WEEK_SHORT.slice(0, 5);
    const dayHeadersMon = showWeekends ? DAYS_OF_WEEK_MON : DAYS_OF_WEEK_MON.slice(0, 5);

    return (
      <div className="flex flex-col flex-1 bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl">
        {/* Column Day Header (Monday to Sunday or Monday to Friday) */}
        <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} border-b border-[#27272a] bg-[#18181b]/80`}>
          {dayHeadersShort.map((dayName, idx) => {
            const isWeekend = idx >= 5;
            return (
              <div
                key={dayName}
                className={`py-2.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-[#27272a] last:border-r-0 ${
                  isWeekend ? 'text-[#71717a] bg-[#141417]/50' : 'text-[#a1a1aa]'
                }`}
              >
                <span className="hidden sm:inline">{dayHeadersMon[idx]}</span>
                <span className="sm:hidden">{dayName}</span>
              </div>
            );
          })}
        </div>

        {/* Weeks Grid */}
        <div
          className="grid flex-1 divide-y divide-[#27272a]"
          style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(135px, 1fr))` }}
        >
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} divide-x divide-[#27272a] min-h-[135px]`}>
              {week.map((date) => {
                const dateKey = formatDateKey(date);
                const isCurrentMonth = date.getMonth() === month;
                const isToday = isTodayDate(date);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isFirstDayOfMonth = date.getDate() === 1;
                const dayTasks = monthTasksByDateKey.get(dateKey) || [];

                return (
                  <div
                    key={dateKey}
                    onClick={() => {
                      // Click on cell background allows adding a task for this date
                    }}
                    className={`group relative p-1.5 sm:p-2 flex flex-col transition-colors ${
                      !isCurrentMonth || isWeekend
                        ? 'bg-[#141418]/40'
                        : 'bg-[#121215]'
                    } hover:bg-[#18181f]/70`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between mb-1.5 select-none">
                      <div className="flex items-center gap-1">
                        {isToday ? (
                          <div className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-xs flex items-center justify-center shadow-md">
                            {date.getDate()}
                          </div>
                        ) : (
                          <span
                            className={`text-xs font-medium ${
                              isCurrentMonth ? 'text-[#f4f4f5]' : 'text-[#71717a]'
                            }`}
                          >
                            {isFirstDayOfMonth
                              ? `${MONTH_NAMES[date.getMonth()].substring(0, 3)} ${date.getDate()}`
                              : date.getDate()}
                          </span>
                        )}
                      </div>

                      {/* Quick Add Button on Hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenAddItemModal) {
                            const targetProj = currentProjectId !== 'all' ? currentProjectId : (activeProjects[0]?.id || appData.projects[0]?.id);
                            onOpenAddItemModal(undefined, targetProj, dateKey);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-all cursor-pointer"
                        title={`Add task on ${dateKey}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Task Events List inside Date Cell */}
                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                      {dayTasks.slice(0, 3).map((task) => {
                        const isCompleted = task.status === 'completed';
                        const statusConfig = getStatusConfig(task.status);

                        const fullTooltip = [
                          task.title,
                          `• ${task.project.title}`,
                          `• ${statusConfig.label}`,
                        ]
                          .filter(Boolean)
                          .join(' ');

                        return (
                          <div
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenEditItemModal) onOpenEditItemModal(task.item);
                            }}
                            style={{
                              borderLeftColor: task.color,
                              backgroundColor: `${task.color}15`,
                            }}
                            className="px-1.5 py-1 rounded border-l-[3px] border border-[#27272a]/60 text-[10.5px] font-medium text-[#f4f4f5] truncate cursor-pointer hover:brightness-125 hover:border-[#3f3f46] transition-all flex items-center justify-between gap-1 shadow-2xs group/card select-none"
                            title={fullTooltip}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                              {isCompleted ? (
                                <Check className="w-3 h-3 text-[#10b981] shrink-0" />
                              ) : (
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dotBg}`} />
                              )}
                              <span className={`truncate ${isCompleted ? 'text-[#a1a1aa]' : 'text-[#f4f4f5]'}`}>
                                {task.title}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* "+N more" button */}
                      {dayTasks.length > 3 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopoverDay({ date, dateKey, tasks: dayTasks });
                          }}
                          className="text-[10px] font-medium text-orange-400 hover:text-orange-300 text-left px-1.5 py-0.5 rounded hover:bg-orange-500/10 transition-colors cursor-pointer"
                        >
                          +{dayTasks.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- RENDER DAY & WEEK VIEW ---
  const renderDayOrWeekView = () => {
    // Generate day columns for current week or single day
    const isWeek = viewType === 'week';
    const dayColumns: Date[] = [];

    if (isWeek) {
      const dayOfWeek = (currentDate.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() - dayOfWeek);

      const daysCount = showWeekends ? 7 : 5;
      for (let i = 0; i < daysCount; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dayColumns.push(d);
      }
    } else {
      dayColumns.push(new Date(currentDate));
    }

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const hourHeight = 56; // px per hour

    return (
      <div className="flex flex-col flex-1 bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl min-h-[640px]">
        {/* Top Header: Date Columns + All-Day Task Row */}
        <div className="flex border-b border-[#27272a] bg-[#18181b]/95 z-20">
          {/* Time Gutter Header (Left) */}
          <div className="w-16 sm:w-20 border-r border-[#27272a] flex flex-col items-center justify-center p-2 shrink-0">
            <span className="text-[10px] uppercase font-mono text-[#71717a]">GMT+7</span>
          </div>

          {/* Date Columns */}
          <div className={`grid flex-1 ${isWeek ? (showWeekends ? 'grid-cols-7' : 'grid-cols-5') : 'grid-cols-1'} divide-x divide-[#27272a]`}>
            {dayColumns.map((d, idx) => {
              const isToday = isTodayDate(d);
              const dayName = isWeek
                ? (showWeekends ? DAYS_OF_WEEK_SHORT : DAYS_OF_WEEK_SHORT.slice(0, 5))[idx]
                : DAYS_OF_WEEK_MON[(d.getDay() + 6) % 7];

              return (
                <div key={d.toISOString()} className="p-2 sm:p-2.5 text-center flex flex-col items-center justify-center gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                    {dayName}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                      isToday
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'text-[#f4f4f5]'
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* All-Day Events Sub-Bar */}
        <div className="flex border-b border-[#27272a] bg-[#141417] min-h-[38px] z-10">
          <div className="w-16 sm:w-20 border-r border-[#27272a] px-2 py-1.5 text-[10px] font-medium text-[#71717a] flex items-center justify-center shrink-0">
            all-day
          </div>
          <div className={`grid flex-1 ${isWeek ? (showWeekends ? 'grid-cols-7' : 'grid-cols-5') : 'grid-cols-1'} divide-x divide-[#27272a] p-1 gap-1`}>
            {dayColumns.map((d) => {
              const dKey = formatDateKey(d);
              const allDayEvents = (weekEventsByDateKey.get(dKey) || []).filter((e) => e.isAllDay);

              return (
                <div key={dKey} className="flex flex-col gap-1 min-h-[30px] p-0.5">
                  {allDayEvents.map((ev) => {
                    const isCompleted = ev.status === 'completed';
                    const statusConfig = getStatusConfig(ev.status);
                    const durationText = ev.durationSeconds > 0 ? formatDuration(ev.durationSeconds) : '';

                    return (
                      <div
                        key={ev.id}
                        onClick={() => onOpenEditItemModal && onOpenEditItemModal(ev.item)}
                        style={{
                          borderLeftColor: ev.color,
                          backgroundColor: `${ev.color}22`,
                        }}
                        className="px-2 py-1 rounded border-l-[3px] border border-transparent text-[11px] font-medium text-[#f4f4f5] truncate cursor-pointer hover:brightness-125 transition-all flex items-center justify-between gap-1 shadow-xs"
                        title={`${ev.title} (${ev.project.title})${durationText ? ` • ${durationText}` : ''}${ev.sessionCount && ev.sessionCount > 1 ? ` • ${ev.sessionCount} sessions` : ''} • Status: ${statusConfig.label}`}
                      >
                        <div className="flex items-center gap-1 min-w-0 truncate">
                          <span className={`truncate ${isCompleted ? 'text-[#71717a]' : 'text-[#f4f4f5]'}`}>{ev.title}</span>
                          {ev.sessionCount && ev.sessionCount > 1 && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#27272a] text-orange-300 border border-orange-500/30 shrink-0 font-sans">
                              {ev.sessionCount} sess
                            </span>
                          )}
                        </div>
                        {isCompleted ? (
                          <Check className="w-3 h-3 text-[#10b981] shrink-0" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dotBg}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable 24-Hour Time Grid */}
        <div
          ref={timeGridScrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden relative max-h-[700px] flex"
        >
          {/* Left Column: Hours (00:00 - 23:00) */}
          <div className="w-16 sm:w-20 border-r border-[#27272a] bg-[#141418]/60 shrink-0 select-none">
            {hours.map((hr) => (
              <div
                key={hr}
                style={{ height: `${hourHeight}px` }}
                className="relative border-b border-[#27272a]/50 text-right pr-2.5 pt-1 text-[11px] font-mono text-[#71717a]"
              >
                <span>{pad2(hr)}:00</span>
              </div>
            ))}
          </div>

          {/* Time Grid Columns for Days */}
          <div className={`grid flex-1 ${isWeek ? (showWeekends ? 'grid-cols-7' : 'grid-cols-5') : 'grid-cols-1'} divide-x divide-[#27272a] relative`}>
            {dayColumns.map((d) => {
              const dKey = formatDateKey(d);
              const isToday = isTodayDate(d);
              const timedEvents = (weekEventsByDateKey.get(dKey) || []).filter((e) => !e.isAllDay);

              return (
                <div
                  key={dKey}
                  style={{ height: `${24 * hourHeight}px` }}
                  className="relative group bg-[#121215]"
                  onClick={(e) => {
                    // Click to add event at hour
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    const clickedHour = Math.floor(clickY / hourHeight);
                    if (onOpenAddItemModal) {
                      const targetProj = currentProjectId !== 'all' ? currentProjectId : (activeProjects[0]?.id || appData.projects[0]?.id);
                      onOpenAddItemModal(undefined, targetProj, dKey);
                    }
                  }}
                >
                  {/* Horizontal Hour Grid Lines */}
                  {hours.map((hr) => (
                    <div
                      key={hr}
                      style={{ top: `${hr * hourHeight}px`, height: `${hourHeight}px` }}
                      className="absolute inset-x-0 border-b border-[#27272a]/40 pointer-events-none"
                    />
                  ))}

                  {/* Red / Orange Current Time Line if Today */}
                  {isToday && (
                    <div
                      style={{
                        top: `${(14.5) * hourHeight}px`, // 14:30 indicator for demo
                      }}
                      className="absolute inset-x-0 border-t-2 border-orange-500 z-30 flex items-center pointer-events-none"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500 -ml-1.5 shadow-sm" />
                    </div>
                  )}

                  {/* Render Timed Events (Non-overlapping layout) */}
                  {calculateNonOverlappingLayout(timedEvents, hourHeight, 44, 4).map(({ event: ev, topPx, heightPx }) => {
                    const isCompleted = ev.status === 'completed';
                    const statusConfig = getStatusConfig(ev.status);
                    const durationText = ev.durationSeconds > 0 ? formatDuration(ev.durationSeconds) : '';
                    const timeRangeStr = ev.startTimeStr
                      ? (ev.endTimeStr ? `${ev.startTimeStr}-${ev.endTimeStr}` : ev.startTimeStr)
                      : '';
                    const timeWithDur = timeRangeStr
                      ? (durationText ? `${timeRangeStr} (${durationText})` : timeRangeStr)
                      : (durationText ? `(${durationText})` : '');

                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenEditItemModal) onOpenEditItemModal(ev.item);
                        }}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          borderLeftColor: ev.color,
                        }}
                        className="absolute inset-x-1 border-l-[3.5px] border-t border-r border-b border-[#27272a] bg-[#18181b] rounded-lg p-1.5 text-xs text-[#f4f4f5] shadow-lg cursor-pointer hover:border-orange-500/50 hover:bg-[#202025] transition-all overflow-hidden z-10 flex flex-col justify-between group/card select-none"
                        title={`${ev.title}${timeWithDur ? ` | ${timeWithDur}` : ''} • ${ev.project.title} • Status: ${statusConfig.label}${ev.sessionCount && ev.sessionCount > 1 ? ` • ${ev.sessionCount} sessions consolidated` : ''}`}
                      >
                        {/* Background subtle color wash */}
                        <div
                          className="absolute inset-0 pointer-events-none opacity-15 transition-opacity group-hover/card:opacity-25"
                          style={{ backgroundColor: ev.color }}
                        />

                        <div className="flex items-start justify-between gap-1 min-w-0 relative z-10">
                          <span className={`font-semibold truncate text-[11px] leading-tight ${isCompleted ? 'text-[#71717a]' : 'text-[#f4f4f5]'}`}>
                            {ev.title}
                          </span>
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                          ) : (
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 mt-0.5 shadow-xs ${statusConfig.dotBg}`}
                              title={`Status: ${statusConfig.label}`}
                            />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[#a1a1aa] font-mono mt-0.5 relative z-10 leading-none">
                          <span className="truncate">
                            {timeWithDur || formatDuration(ev.durationSeconds)}
                          </span>
                          {ev.isSession && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-orange-500/15 text-orange-400 font-sans shrink-0 ml-1">
                              {ev.sessionCount && ev.sessionCount > 1 ? `${ev.sessionCount} sess` : 'Log'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER YEAR VIEW ---
  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i);

    return (
      <div className="flex flex-col flex-1 bg-[#121215] border border-[#27272a] rounded-2xl p-4 sm:p-6 shadow-xl overflow-y-auto max-h-[800px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {months.map((mIdx) => {
            const firstDay = new Date(year, mIdx, 1);
            const startDayIndex = (firstDay.getDay() + 6) % 7; // Monday = 0
            const daysInMonth = new Date(year, mIdx + 1, 0).getDate();

            // Calculate total tasks / sessions in this month
            let monthTaskCount = 0;
            let monthLoggedSeconds = 0;

            for (let d = 1; d <= daysInMonth; d++) {
              const dKey = `${year}-${pad2(mIdx + 1)}-${pad2(d)}`;
              const dayTasks = monthTasksByDateKey.get(dKey) || [];
              monthTaskCount += dayTasks.length;
              monthLoggedSeconds += dayTasks.reduce((acc, t) => acc + t.totalDurationSeconds, 0);
            }

            return (
              <div
                key={mIdx}
                className="bg-[#18181b]/70 border border-[#27272a] rounded-xl p-3.5 hover:border-[#3f3f46] transition-all"
              >
                {/* Month Title */}
                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#27272a]">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentDate(new Date(year, mIdx, 1));
                      setViewType('month');
                    }}
                    className="font-bold text-sm text-[#f4f4f5] hover:text-orange-400 transition-colors"
                  >
                    {MONTH_NAMES[mIdx]}
                  </button>
                  {monthTaskCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
                      {monthTaskCount} tasks
                    </span>
                  )}
                </div>

                {/* Day Header (M T W T F S S or M T W T F) */}
                <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} text-center text-[10px] font-semibold text-[#71717a] mb-1.5`}>
                  {(showWeekends ? DAYS_OF_WEEK_SHORT : DAYS_OF_WEEK_SHORT.slice(0, 5)).map((s) => (
                    <span key={s}>{s[0]}</span>
                  ))}
                </div>

                {/* Days Grid */}
                <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} gap-1 text-center text-xs`}>
                  {/* Empty cells before 1st day */}
                  {Array.from({
                    length: showWeekends
                      ? startDayIndex
                      : firstDay.getDay() === 0 || firstDay.getDay() === 6
                      ? 0
                      : firstDay.getDay() - 1,
                  }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-6" />
                  ))}

                  {/* Month days */}
                  {Array.from({ length: daysInMonth })
                    .map((_, i) => i + 1)
                    .filter((dayNum) => {
                      if (showWeekends) return true;
                      const dObj = new Date(year, mIdx, dayNum);
                      return dObj.getDay() !== 0 && dObj.getDay() !== 6;
                    })
                    .map((dayNum) => {
                      const dKey = `${year}-${pad2(mIdx + 1)}-${pad2(dayNum)}`;
                      const hasEvents = (eventsByDateKey.get(dKey) || []).length > 0;
                      const now = new Date();
                      const isToday =
                        year === now.getFullYear() &&
                        mIdx === now.getMonth() &&
                        dayNum === now.getDate();

                      return (
                        <button
                          key={dayNum}
                          type="button"
                          onClick={() => {
                            setCurrentDate(new Date(year, mIdx, dayNum));
                            setViewType('day');
                          }}
                          className={`h-6 w-6 mx-auto rounded-full flex flex-col items-center justify-center text-[11px] font-medium transition-all ${
                            isToday
                              ? 'bg-orange-500 text-white font-bold shadow-xs'
                              : hasEvents
                              ? 'bg-orange-500/20 text-orange-300 font-semibold hover:bg-orange-500 hover:text-white'
                              : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
                          }`}
                        >
                          <span>{dayNum}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Time-Based Unified Toolbar */}
      <TimeBasedToolbar
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
        timeScale={viewType}
        onTimeScaleChange={setViewType}
      />

      {/* Main Calendar View Area */}
      {viewType === 'month' && renderMonthView()}
      {(viewType === 'day' || viewType === 'week') && renderDayOrWeekView()}
      {viewType === 'year' && renderYearView()}

      {/* Popover for "+N more" items on a date */}
      {popoverDay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 w-full max-w-sm shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
              <div>
                <h4 className="font-bold text-sm text-[#f4f4f5]">
                  {popoverDay.date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </h4>
                <p className="text-[11px] text-[#71717a]">
                  {popoverDay.tasks.length} task{popoverDay.tasks.length !== 1 ? 's' : ''} scheduled
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPopoverDay(null)}
                className="p-1 rounded-lg hover:bg-[#27272a] text-[#a1a1aa] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {popoverDay.tasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const statusConfig = getStatusConfig(task.status);
                const durationText = task.totalDurationSeconds > 0 ? formatDuration(task.totalDurationSeconds) : null;

                let timeDurationPart = '';
                if (task.timeRangeStr && durationText) {
                  timeDurationPart = `${task.timeRangeStr} (${durationText})`;
                } else if (task.timeRangeStr) {
                  timeDurationPart = task.timeRangeStr;
                } else if (durationText) {
                  timeDurationPart = `(${durationText})`;
                }

                const fullTooltip = [
                  task.title,
                  timeDurationPart ? `| ${timeDurationPart}` : '',
                  `• ${task.project.title}`,
                  `• ${statusConfig.label}`,
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      setPopoverDay(null);
                      if (onOpenEditItemModal) onOpenEditItemModal(task.item);
                    }}
                    style={{
                      borderLeftColor: task.color,
                      backgroundColor: `${task.color}15`,
                    }}
                    className="px-2.5 py-2 rounded-lg border-l-4 border border-[#27272a] text-xs font-medium text-[#f4f4f5] cursor-pointer hover:brightness-125 transition-all flex items-center justify-between gap-2"
                    title={fullTooltip}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-semibold ${isCompleted ? 'text-[#71717a]' : 'text-[#f4f4f5]'}`}>
                          {task.title}
                        </span>
                        {timeDurationPart && (
                          <>
                            <span className="text-[#52525b] font-mono text-[11px]">|</span>
                            <span className="text-orange-400 font-mono text-[11px]">
                              {timeDurationPart}
                            </span>
                          </>
                        )}
                        <span className="text-[#52525b]">•</span>
                        <span className="text-[#a1a1aa] text-[11px]">{task.project.title}</span>
                        <span className="text-[#52525b]">•</span>
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotBg}`} />
                          <span className={statusConfig.textColor}>{statusConfig.label}</span>
                        </span>
                        {task.sessionCount > 1 && (
                          <span className="px-1 py-0.2 rounded bg-[#27272a] text-[9px] text-[#d4d4d8]">
                            {task.sessionCount} sessions
                          </span>
                        )}
                      </div>
                    </div>
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                    ) : (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusConfig.dotBg}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#27272a] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const dKey = popoverDay.dateKey;
                  setPopoverDay(null);
                  if (onOpenAddItemModal) {
                    const targetProj = currentProjectId !== 'all' ? currentProjectId : (activeProjects[0]?.id || appData.projects[0]?.id);
                    onOpenAddItemModal(undefined, targetProj, dKey);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add task here
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

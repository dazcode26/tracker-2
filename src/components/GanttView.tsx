import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  Circle,
  AlertCircle,
  Play,
  Square,
  Plus,
  Filter,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Folder,
} from 'lucide-react';
import {
  AppData,
  ItemNode,
  ItemStatus,
  Person,
  ProjectNode,
  Session,
  TimeScale,
} from '../types';
import { TimeBasedToolbar } from './TimeBasedToolbar';
import { formatDuration } from '../utils/treeUtils';

interface GanttViewProps {
  appData: AppData;
  onOpenEditItemModal: (item: ItemNode) => void;
  onOpenAddItemModal?: (parentId?: string, projectId?: string) => void;
  onOpenProjectModal?: (project?: ProjectNode) => void;
  onUpdateItemStatus?: (itemId: string, newStatus: ItemStatus) => void;
  onStartTimer?: (itemId: string) => void;
  onStopTimer?: () => void;
  onToggleExpand?: (itemId: string) => void;
  onSetAllExpand?: (expand: boolean) => void;
  selectedProjectId?: string;
  onSelectProjectFilter?: (projectId: string) => void;
  selectedPersonId?: string;
  onSelectPersonFilter?: (personId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  timeScale?: TimeScale;
  onTimeScaleChange?: (timeScale: TimeScale) => void;
  currentDate?: Date;
  onCurrentDateChange?: (date: Date) => void;
  showWeekends?: boolean;
  onShowWeekendsChange?: (show: boolean) => void;
  showCompleted?: boolean;
  onShowCompletedChange?: (show: boolean) => void;
}

interface FlattenedGanttRow {
  id: string;
  isProject: boolean;
  depth: number;
  project: ProjectNode;
  item?: ItemNode;
  parentItemId?: string;
  hasChildren: boolean;
  isExpanded: boolean;
  title: string;
  status: ItemStatus;
  priority?: string;
  assignee?: Person;
  startDate: Date;
  endDate: Date;
  isMilestone: boolean;
  progressPercent: number;
  loggedSeconds: number;
  estimatedSeconds: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Helper to calculate total logged seconds
const calculateLoggedSeconds = (item: ItemNode, activeTimerItemId?: string, activeTimerStartedAt?: string): number => {
  let total = 0;
  if (Array.isArray(item.sessions)) {
    for (const sess of item.sessions) {
      if (sess.loggedSeconds) {
        total += sess.loggedSeconds;
      } else if (sess.startedAt && sess.endedAt) {
        const diff = Math.floor((new Date(sess.endedAt).getTime() - new Date(sess.startedAt).getTime()) / 1000);
        if (diff > 0) total += diff;
      }
    }
  }
  if (activeTimerItemId === item.id && activeTimerStartedAt) {
    const elapsed = Math.floor((Date.now() - new Date(activeTimerStartedAt).getTime()) / 1000);
    if (elapsed > 0) total += elapsed;
  }
  return total;
};

// Calculate progress percentage of an item
const calculateProgressPercent = (item: ItemNode, loggedSeconds: number): number => {
  if (item.subItems && item.subItems.length > 0) {
    const completedCount = item.subItems.filter((s) => s.status === 'completed').length;
    return Math.round((completedCount / item.subItems.length) * 100);
  }
  if (item.status === 'completed') return 100;
  if (item.status === 'review') return 85;
  if (item.status === 'in-progress') {
    if (item.estimatedSeconds && item.estimatedSeconds > 0) {
      const pct = Math.round((loggedSeconds / item.estimatedSeconds) * 100);
      return Math.min(95, Math.max(15, pct));
    }
    return 50;
  }
  return 0;
};

// Determine Start and End dates from existing item data
const determineItemDates = (item: ItemNode): { startDate: Date; endDate: Date; isMilestone: boolean } => {
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let isMilestone = false;

  // 1. Check actual start/end dates
  if (item.actualStartDate) {
    const d = new Date(item.actualStartDate);
    if (!isNaN(d.getTime())) startDate = d;
  }
  if (item.actualEndDate) {
    const d = new Date(item.actualEndDate);
    if (!isNaN(d.getTime())) endDate = d;
  }

  // 2. Check sessions for earlier/later timestamps
  if (Array.isArray(item.sessions) && item.sessions.length > 0) {
    for (const sess of item.sessions) {
      if (sess.startedAt) {
        const s = new Date(sess.startedAt);
        if (!isNaN(s.getTime())) {
          if (!startDate || s < startDate) startDate = s;
        }
      }
      if (sess.endedAt) {
        const e = new Date(sess.endedAt);
        if (!isNaN(e.getTime())) {
          if (!endDate || e > endDate) endDate = e;
        }
      }
    }
  }

  // 3. Target Date fallback
  if (item.targetDate) {
    const t = new Date(item.targetDate);
    if (!isNaN(t.getTime())) {
      if (!endDate) {
        endDate = t;
      }
      if (!startDate) {
        // If estimated time exists, project backwards; else standard 1-day milestone
        if (item.estimatedSeconds && item.estimatedSeconds > 0) {
          const days = Math.max(1, Math.ceil(item.estimatedSeconds / 28800)); // 8-hour workday
          const s = new Date(t);
          s.setDate(s.getDate() - days);
          startDate = s;
        } else {
          // Point-in-time milestone
          startDate = new Date(t);
          isMilestone = true;
        }
      }
    }
  }

  // 4. Default fallback if completely missing dates
  const today = new Date();
  if (!startDate && !endDate) {
    startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0);
    endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 18, 0, 0);
  } else if (!startDate && endDate) {
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 2);
  } else if (startDate && !endDate) {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2);
  }

  // Ensure end >= start
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    endDate = new Date(startDate.getTime() + 86400000);
  }

  return {
    startDate: startDate || today,
    endDate: endDate || today,
    isMilestone,
  };
};

export const GanttView: React.FC<GanttViewProps> = ({
  appData,
  onOpenEditItemModal,
  onOpenAddItemModal,
  onOpenProjectModal,
  onUpdateItemStatus,
  onStartTimer,
  onStopTimer,
  onToggleExpand,
  onSetAllExpand,
  selectedProjectId: controlledProjectId,
  onSelectProjectFilter,
  selectedPersonId: controlledPersonId,
  onSelectPersonFilter,
  searchQuery: controlledSearchQuery,
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
  // Local state fallbacks
  const [internalTimeScale, setInternalTimeScale] = useState<TimeScale>(() => {
    try {
      const saved = localStorage.getItem('struktur_filter_timescale');
      if (saved && ['day', 'week', 'month', 'year'].includes(saved)) {
        return saved as TimeScale;
      }
    } catch {}
    return 'month';
  });
  const timeScale = controlledTimeScale !== undefined ? controlledTimeScale : internalTimeScale;
  const setTimeScale = (val: TimeScale) => {
    if (onTimeScaleChange) onTimeScaleChange(val);
    setInternalTimeScale(val);
    try {
      localStorage.setItem('struktur_filter_timescale', val);
    } catch {}
  };

  const [internalCurrentDate, setInternalCurrentDate] = useState<Date>(() => {
    try {
      const saved = localStorage.getItem('struktur_filter_current_date');
      if (saved) {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    } catch {}
    return new Date();
  });
  const currentDate = controlledCurrentDate !== undefined ? controlledCurrentDate : internalCurrentDate;
  const setCurrentDate = (d: Date | ((prev: Date) => Date)) => {
    const nextDate = typeof d === 'function' ? d(currentDate) : d;
    if (onCurrentDateChange) onCurrentDateChange(nextDate);
    setInternalCurrentDate(nextDate);
    try {
      localStorage.setItem('struktur_filter_current_date', nextDate.toISOString());
    } catch {}
  };

  const [internalShowWeekends, setInternalShowWeekends] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('struktur_filter_show_weekends');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });
  const showWeekends = controlledShowWeekends !== undefined ? controlledShowWeekends : internalShowWeekends;
  const setShowWeekends = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(showWeekends) : val;
    if (onShowWeekendsChange) onShowWeekendsChange(nextVal);
    setInternalShowWeekends(nextVal);
    try {
      localStorage.setItem('struktur_filter_show_weekends', String(nextVal));
    } catch {}
  };

  const [internalShowCompleted, setInternalShowCompleted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('struktur_filter_show_completed');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });
  const showCompleted = controlledShowCompleted !== undefined ? controlledShowCompleted : internalShowCompleted;
  const setShowCompleted = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(showCompleted) : val;
    if (onShowCompletedChange) onShowCompletedChange(nextVal);
    setInternalShowCompleted(nextVal);
    try {
      localStorage.setItem('struktur_filter_show_completed', String(nextVal));
    } catch {}
  };

  const [internalProjectId, setInternalProjectId] = useState<string>('all');
  const selectedProjectId = controlledProjectId !== undefined ? controlledProjectId : internalProjectId;

  const [internalPersonId, setInternalPersonId] = useState<string>('all');
  const selectedPersonId = controlledPersonId !== undefined ? controlledPersonId : internalPersonId;

  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const searchQuery = controlledSearchQuery !== undefined ? controlledSearchQuery : internalSearchQuery;

  // Local collapse state for projects & items
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  // Hovered item tooltip state
  const [hoveredRow, setHoveredRow] = useState<FlattenedGanttRow | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Sync scrolling between left table and right canvas
  const leftTableRef = useRef<HTMLDivElement>(null);
  const rightCanvasRef = useRef<HTMLDivElement>(null);

  const handleLeftScroll = () => {
    if (leftTableRef.current && rightCanvasRef.current) {
      rightCanvasRef.current.scrollTop = leftTableRef.current.scrollTop;
    }
  };

  const handleRightScroll = () => {
    if (leftTableRef.current && rightCanvasRef.current) {
      leftTableRef.current.scrollTop = rightCanvasRef.current.scrollTop;
    }
  };

  // Keyboard shortcuts (D: Day, W: Week, M: Month, Y: Year, T: Today)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toUpperCase();
      if (key === 'D') setTimeScale('day');
      else if (key === 'W') setTimeScale('week');
      else if (key === 'M') setTimeScale('month');
      else if (key === 'Y') setTimeScale('year');
      else if (key === 'T') setCurrentDate(new Date());
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter projects
  const activeProjects = useMemo(() => {
    return appData.projects.filter((p) => p.status === 'active');
  }, [appData.projects]);

  const selectedProjectIds = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === 'all' || selectedProjectId === 'none') return [];
    return selectedProjectId.split(',').filter(Boolean);
  }, [selectedProjectId]);

  const selectedPersonIds = useMemo(() => {
    if (!selectedPersonId || selectedPersonId === 'all' || selectedPersonId === 'none') return [];
    return selectedPersonId.split(',').filter(Boolean);
  }, [selectedPersonId]);

  // Determine timeline window boundaries based on timeScale and currentDate
  const timelineRange = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const d = currentDate.getDate();

    if (timeScale === 'day') {
      const start = new Date(y, m, d, 0, 0, 0, 0);
      const end = new Date(y, m, d, 23, 59, 59, 999);
      const hours: { label: string; date: Date }[] = [];
      for (let h = 0; h < 24; h++) {
        hours.push({
          label: `${String(h).padStart(2, '0')}:00`,
          date: new Date(y, m, d, h, 0, 0),
        });
      }
      return { start, end, columns: hours, totalMs: end.getTime() - start.getTime() };
    }

    if (timeScale === 'week') {
      const dayOfWeek = currentDate.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const days: { label: string; subLabel: string; date: Date; isWeekend: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const cur = new Date(monday);
        cur.setDate(monday.getDate() + i);
        const dow = cur.getDay();
        const isWk = dow === 0 || dow === 6;
        if (!showWeekends && isWk) continue;
        days.push({
          label: DAY_NAMES[dow],
          subLabel: `${cur.getDate()}`,
          date: cur,
          isWeekend: isWk,
        });
      }

      const start = days[0].date;
      const end = new Date(days[days.length - 1].date);
      end.setHours(23, 59, 59, 999);
      return { start, end, columns: days, totalMs: end.getTime() - start.getTime() };
    }

    if (timeScale === 'year') {
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      const months: { label: string; date: Date }[] = [];
      for (let mi = 0; mi < 12; mi++) {
        months.push({
          label: SHORT_MONTH_NAMES[mi],
          date: new Date(y, mi, 1),
        });
      }
      return { start, end, columns: months, totalMs: end.getTime() - start.getTime() };
    }

    // Default: 'month'
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const days: { label: string; subLabel: string; date: Date; isWeekend: boolean }[] = [];
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const cur = new Date(y, m, dayNum);
      const dow = cur.getDay();
      const isWk = dow === 0 || dow === 6;
      if (!showWeekends && isWk) continue;
      days.push({
        label: DAY_NAMES[dow],
        subLabel: `${dayNum}`,
        date: cur,
        isWeekend: isWk,
      });
    }

    const start = days[0].date;
    const end = new Date(days[days.length - 1].date);
    end.setHours(23, 59, 59, 999);
    return { start, end, columns: days, totalMs: end.getTime() - start.getTime() };
  }, [currentDate, timeScale, showWeekends]);

  // Format Header Title
  const headerTitle = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = MONTH_NAMES[currentDate.getMonth()];
    const d = currentDate.getDate();

    if (timeScale === 'year') return `${y}`;
    if (timeScale === 'day') return `${d} ${m.substring(0, 3)} ${y}`;
    if (timeScale === 'week') {
      const s = timelineRange.start;
      const e = timelineRange.end;
      return `${s.getDate()} ${SHORT_MONTH_NAMES[s.getMonth()]} - ${e.getDate()} ${SHORT_MONTH_NAMES[e.getMonth()]} ${y}`;
    }
    return `${m} ${y}`;
  }, [currentDate, timeScale, timelineRange]);

  // Navigation handlers
  const handlePrev = () => {
    const newD = new Date(currentDate);
    if (timeScale === 'day') newD.setDate(newD.getDate() - 1);
    else if (timeScale === 'week') newD.setDate(newD.getDate() - 7);
    else if (timeScale === 'month') newD.setMonth(newD.getMonth() - 1);
    else if (timeScale === 'year') newD.setFullYear(newD.getFullYear() - 1);
    setCurrentDate(newD);
  };

  const handleNext = () => {
    const newD = new Date(currentDate);
    if (timeScale === 'day') newD.setDate(newD.getDate() + 1);
    else if (timeScale === 'week') newD.setDate(newD.getDate() + 7);
    else if (timeScale === 'month') newD.setMonth(newD.getMonth() + 1);
    else if (timeScale === 'year') newD.setFullYear(newD.getFullYear() + 1);
    setCurrentDate(newD);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Flatten Projects and Items into hierarchical Gantt Rows
  const flattenedRows: FlattenedGanttRow[] = useMemo(() => {
    const rows: FlattenedGanttRow[] = [];
    const query = (searchQuery || '').trim().toLowerCase();

    const activeTimerItemId = appData.settings?.activeTimer?.itemId;
    const activeTimerStartedAt = appData.settings?.activeTimer?.startedAt;

    for (const project of activeProjects) {
      if (selectedProjectId === 'none') continue;
      if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(project.id)) continue;

      const isProjCollapsed = !!collapsedMap[`proj-${project.id}`];

      // Recursively gather items
      const processItem = (
        item: ItemNode,
        depth: number,
        parentItemId?: string
      ): FlattenedGanttRow | null => {
        // Filter by completed status if hide completed
        if (!showCompleted && item.status === 'completed') {
          return null;
        }

        // Filter by person
        if (selectedPersonId === 'none') return null;
        if (selectedPersonIds.length > 0) {
          const matchesThis = item.assigneeId && selectedPersonIds.includes(item.assigneeId);
          const hasMatchingChild = (item.subItems || []).some((s) => s.assigneeId && selectedPersonIds.includes(s.assigneeId));
          if (!matchesThis && !hasMatchingChild) return null;
        }

        // Filter by search query
        if (query) {
          const matchesName = item.name.toLowerCase().includes(query);
          const matchesNotes = item.notes && item.notes.toLowerCase().includes(query);
          const hasMatchingChild = (item.subItems || []).some((s) => s.name.toLowerCase().includes(query));
          if (!matchesName && !matchesNotes && !hasMatchingChild) return null;
        }

        const dates = determineItemDates(item);
        const loggedSeconds = calculateLoggedSeconds(item, activeTimerItemId, activeTimerStartedAt);
        const progress = calculateProgressPercent(item, loggedSeconds);
        const assignee = appData.persons.find((p) => p.id === item.assigneeId);
        const isCollapsed = collapsedMap[`item-${item.id}`] ?? (item.isExpanded === false);
        const hasChildren = Array.isArray(item.subItems) && item.subItems.length > 0;

        const row: FlattenedGanttRow = {
          id: item.id,
          isProject: false,
          depth,
          project,
          item,
          parentItemId,
          hasChildren,
          isExpanded: !isCollapsed,
          title: item.name,
          status: item.status,
          priority: item.priority,
          assignee,
          startDate: dates.startDate,
          endDate: dates.endDate,
          isMilestone: dates.isMilestone,
          progressPercent: progress,
          loggedSeconds,
          estimatedSeconds: item.estimatedSeconds || 0,
        };

        return row;
      };

      // Collect items tree
      const projectItemRows: FlattenedGanttRow[] = [];
      const traverse = (items: ItemNode[], depth: number, parentId?: string) => {
        for (const item of items) {
          const row = processItem(item, depth, parentId);
          if (row) {
            projectItemRows.push(row);
            // If item has children and is NOT collapsed, traverse deeper
            if (row.hasChildren && row.isExpanded && item.subItems) {
              traverse(item.subItems, depth + 1, item.id);
            }
          }
        }
      };

      if (project.items) {
        traverse(project.items, 1);
      }

      // If project has no matching items and search query exists, skip project unless project name matches
      if (query && projectItemRows.length === 0 && !project.title.toLowerCase().includes(query)) {
        continue;
      }

      // Compute project start and end dates from children
      let projStart = new Date();
      let projEnd = new Date();
      let projProgress = 0;
      if (projectItemRows.length > 0) {
        const startTimes = projectItemRows.map((r) => r.startDate.getTime());
        const endTimes = projectItemRows.map((r) => r.endDate.getTime());
        projStart = new Date(Math.min(...startTimes));
        projEnd = new Date(Math.max(...endTimes));
        const totalProg = projectItemRows.reduce((acc, r) => acc + r.progressPercent, 0);
        projProgress = Math.round(totalProg / projectItemRows.length);
      }

      // Add project parent summary row
      rows.push({
        id: `proj-${project.id}`,
        isProject: true,
        depth: 0,
        project,
        hasChildren: (project.items && project.items.length > 0) || false,
        isExpanded: !isProjCollapsed,
        title: project.title,
        status: 'in-progress',
        startDate: projStart,
        endDate: projEnd,
        isMilestone: false,
        progressPercent: projProgress,
        loggedSeconds: 0,
        estimatedSeconds: 0,
      });

      // If project is expanded, add its items
      if (!isProjCollapsed) {
        rows.push(...projectItemRows);
      }
    }

    return rows;
  }, [
    activeProjects,
    selectedProjectId,
    selectedProjectIds,
    selectedPersonId,
    selectedPersonIds,
    searchQuery,
    showCompleted,
    collapsedMap,
    appData.persons,
    appData.settings?.activeTimer,
  ]);

  // Toggle Collapse row
  const toggleCollapse = (rowId: string, isProject: boolean) => {
    const key = isProject ? rowId : `item-${rowId}`;
    setCollapsedMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    if (!isProject && onToggleExpand) {
      onToggleExpand(rowId);
    }
  };

  // Convert Date Range to CSS position (% left, % width) relative to timelineRange
  const getBarPosition = (start: Date, end: Date) => {
    const winStart = timelineRange.start.getTime();
    const winEnd = timelineRange.end.getTime();
    const totalMs = timelineRange.totalMs;

    if (totalMs <= 0) return { left: 0, width: 0, isVisible: false };

    const sTime = start.getTime();
    const eTime = end.getTime();

    // Check visibility window
    if (eTime < winStart || sTime > winEnd) {
      return { left: 0, width: 0, isVisible: false };
    }

    const clampStart = Math.max(winStart, sTime);
    const clampEnd = Math.min(winEnd, eTime);

    const leftPct = ((clampStart - winStart) / totalMs) * 100;
    const widthPct = Math.max(0.6, ((clampEnd - clampStart) / totalMs) * 100);

    return {
      left: Math.max(0, Math.min(100, leftPct)),
      width: Math.max(0.8, Math.min(100 - leftPct, widthPct)),
      isVisible: true,
    };
  };

  // Status color styles
  const getStatusColor = (status: ItemStatus) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-emerald-500',
          border: 'border-emerald-600/60 dark:border-emerald-500/60',
          text: 'text-emerald-700 dark:text-emerald-400',
          barBg: 'bg-emerald-500/20 dark:bg-emerald-500/25',
          fillBg: 'bg-emerald-500/80',
        };
      case 'review':
        return {
          bg: 'bg-amber-500',
          border: 'border-amber-600/60 dark:border-amber-500/60',
          text: 'text-amber-700 dark:text-amber-400',
          barBg: 'bg-amber-500/20 dark:bg-amber-500/25',
          fillBg: 'bg-amber-500/80',
        };
      case 'in-progress':
        return {
          bg: 'bg-orange-500',
          border: 'border-orange-600/60 dark:border-orange-500/60',
          text: 'text-orange-700 dark:text-orange-400',
          barBg: 'bg-orange-500/20 dark:bg-orange-500/25',
          fillBg: 'bg-orange-500/80',
        };
      default:
        return {
          bg: 'bg-zinc-400 dark:bg-zinc-500',
          border: 'border-zinc-400/60 dark:border-zinc-600',
          text: 'text-zinc-700 dark:text-zinc-400',
          barBg: 'bg-zinc-400/20 dark:bg-zinc-700/30',
          fillBg: 'bg-zinc-400/70 dark:bg-zinc-600/80',
        };
    }
  };

  // Today indicator position
  const todayPosition = useMemo(() => {
    const now = new Date().getTime();
    const winStart = timelineRange.start.getTime();
    const winEnd = timelineRange.end.getTime();
    if (now < winStart || now > winEnd) return null;
    return ((now - winStart) / timelineRange.totalMs) * 100;
  }, [timelineRange]);

  const activeTimerItemId = appData.settings?.activeTimer?.itemId;

  return (
    <div className="space-y-3">
      {/* Standardized Time-Based Toolbar */}
      <TimeBasedToolbar
        projects={appData.projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(p) => (onSelectProjectFilter ? onSelectProjectFilter(p as string) : setInternalProjectId(p as string))}
        persons={appData.persons}
        selectedPersonId={selectedPersonId}
        onSelectPerson={(p) => (onSelectPersonFilter ? onSelectPersonFilter(p as string) : setInternalPersonId(p as string))}
        searchQuery={searchQuery}
        onSearchChange={(q) => (onSearchChange ? onSearchChange(q) : setInternalSearchQuery(q))}
        timeScale={timeScale}
        onTimeScaleChange={setTimeScale}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        onToday={handleToday}
        onPrev={handlePrev}
        onNext={handleNext}
        headerTitle={headerTitle}
        showWeekends={showWeekends}
        onToggleWeekends={() => setShowWeekends(!showWeekends)}
        showCompleted={showCompleted}
        onToggleCompleted={() => setShowCompleted(!showCompleted)}
      />

      {/* GANTT DUAL-PANE CONTAINER */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Top Information Strip & Quick Expand Controls */}
        <div className="px-3 sm:px-4 py-2 bg-[#141418]/60 border-b border-[#27272a] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 text-[#a1a1aa]">
            <span className="font-semibold text-[#f4f4f5] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-orange-500" />
              <span>Gantt Chart</span>
            </span>
            <span className="hidden sm:inline-block w-px h-3.5 bg-[#27272a]" />
            <span className="text-[11px] hidden sm:inline text-[#71717a]">
              {flattenedRows.filter((r) => !r.isProject).length} tasks ({flattenedRows.filter((r) => !r.isProject && r.status === 'completed').length} completed)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const nextMap: Record<string, boolean> = {};
                flattenedRows.forEach((r) => {
                  nextMap[r.isProject ? r.id : `item-${r.id}`] = false;
                });
                setCollapsedMap(nextMap);
                if (onSetAllExpand) onSetAllExpand(true);
              }}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
              title="Expand All"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => {
                const nextMap: Record<string, boolean> = {};
                flattenedRows.forEach((r) => {
                  nextMap[r.isProject ? r.id : `item-${r.id}`] = true;
                });
                setCollapsedMap(nextMap);
                if (onSetAllExpand) onSetAllExpand(false);
              }}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]/50 transition-colors cursor-pointer"
              title="Collapse All"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Dual Split Table & Gantt Canvas - Natural content height */}
        <div className="flex flex-1 max-h-[75vh] relative overflow-hidden">
          {/* LEFT PANE: WBS / HIERARCHY TREE LIST */}
          <div
            ref={leftTableRef}
            onScroll={handleLeftScroll}
            className="w-72 xs:w-80 sm:w-96 shrink-0 border-r border-[#27272a] bg-[#18181b] overflow-y-auto overflow-x-hidden select-none"
          >
            {/* Table Header */}
            <div className="sticky top-0 z-20 h-10 bg-[#16161a] border-b border-[#27272a] px-3 flex items-center justify-between text-[11px] font-bold text-[#71717a] uppercase tracking-wider">
              <span>WBS / Task Name</span>
              <span className="text-[10px] text-[#71717a]">Progress</span>
            </div>

            {/* Empty State */}
            {flattenedRows.length === 0 && (
              <div className="p-8 text-center text-xs text-[#71717a] space-y-2">
                <p>No tasks match current filters or search.</p>
                {onOpenAddItemModal && (
                  <button
                    type="button"
                    onClick={() => onOpenAddItemModal()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Task</span>
                  </button>
                )}
              </div>
            )}

            {/* Tree Rows */}
            {flattenedRows.map((row) => {
              const isItemTimerActive = activeTimerItemId === row.id;
              const statusStyle = getStatusColor(row.status);

              return (
                <div
                  key={row.id}
                  className={`h-11 px-3 border-b border-[#27272a]/40 flex items-center justify-between group transition-colors text-xs ${
                    row.isProject
                      ? 'bg-[#141418]/60 font-bold'
                      : 'hover:bg-[#27272a]/30 cursor-pointer'
                  }`}
                  style={{ paddingLeft: `${Math.max(12, row.depth * 18 + 12)}px` }}
                  onClick={() => {
                    if (!row.isProject && row.item) {
                      onOpenEditItemModal(row.item);
                    } else if (row.isProject) {
                      toggleCollapse(row.id, true);
                    }
                  }}
                >
                  {/* Left content: expand icon + title */}
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {row.hasChildren ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(row.id, row.isProject);
                        }}
                        className="p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors shrink-0"
                      >
                        {row.isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-orange-400" />
                        )}
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}

                    {row.isProject ? (
                      <Folder
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: row.project.color || '#f97316' }}
                      />
                    ) : (
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${statusStyle.bg}`}
                        title={`Status: ${row.status}`}
                      />
                    )}

                    <span
                      className={`truncate leading-snug ${
                        row.isProject
                          ? 'text-[#f4f4f5] text-xs font-bold'
                          : row.status === 'completed'
                          ? 'line-through text-[#71717a]'
                          : 'text-[#e4e4e7]'
                      }`}
                      title={row.title}
                    >
                      {row.title}
                    </span>
                  </div>

                  {/* Right content: Progress % badge or timer */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!row.isProject && isItemTimerActive && (
                      <span className="flex items-center gap-1 text-[10px] text-orange-400 font-mono font-bold animate-pulse">
                        <Clock className="w-3 h-3" />
                        <span>Live</span>
                      </span>
                    )}

                    {row.assignee && (
                      <div
                        className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/40 text-[9px] font-bold text-orange-400 flex items-center justify-center shrink-0"
                        title={`Assigned to: ${row.assignee.name}`}
                      >
                        {row.assignee.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}

                    <span className="text-[11px] font-mono text-[#71717a] min-w-[28px] text-right">
                      {row.progressPercent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT PANE: GANTT CHART CANVAS & TIMELINE GRID */}
          <div
            ref={rightCanvasRef}
            onScroll={handleRightScroll}
            className="flex-1 overflow-x-auto overflow-y-auto bg-[#0e0e10] relative select-none"
          >
            {/* Timeline Header Row (Sticky top) */}
            <div className="sticky top-0 z-20 h-10 bg-[#16161a] border-b border-[#27272a] flex min-w-[700px] w-full">
              {timelineRange.columns.map((col, idx) => {
                const isCurrent =
                  timeScale === 'month' &&
                  col.date.getDate() === new Date().getDate() &&
                  col.date.getMonth() === new Date().getMonth() &&
                  col.date.getFullYear() === new Date().getFullYear();

                return (
                  <div
                    key={idx}
                    className={`flex-1 min-w-[32px] border-r border-[#27272a]/40 flex flex-col items-center justify-center text-[10px] ${
                      isCurrent
                        ? 'bg-orange-500/15 text-orange-500 font-bold'
                        : 'text-[#71717a]'
                    }`}
                  >
                    <span className="leading-none">{col.label}</span>
                    {'subLabel' in col && (
                      <span className="text-[9px] font-mono opacity-80 mt-0.5">
                        {col.subLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rows & Grid Background */}
            <div className="relative min-w-[700px] w-full">
              {/* Vertical Grid Lines */}
              <div className="absolute inset-0 flex pointer-events-none z-0">
                {timelineRange.columns.map((_, idx) => (
                  <div
                    key={idx}
                    className="flex-1 min-w-[32px] border-r border-[#27272a]/20 h-full"
                  />
                ))}
              </div>

              {/* Vertical Today Line */}
              {todayPosition !== null && (
                <div
                  className="absolute top-0 bottom-0 z-15 pointer-events-none border-l-2 border-dashed border-red-500"
                  style={{ left: `${todayPosition}%` }}
                >
                  <span className="absolute top-1 -left-4 px-1 py-0.2 bg-red-500 text-white rounded text-[9px] font-bold tracking-tight shadow-md">
                    Today
                  </span>
                </div>
              )}

              {/* Gantt Bars for Each Row */}
              {flattenedRows.map((row) => {
                const pos = getBarPosition(row.startDate, row.endDate);
                const statusStyle = getStatusColor(row.status);
                const projColor = row.project.color || '#f97316';

                return (
                  <div
                    key={row.id}
                    className="h-11 border-b border-[#27272a]/40 relative flex items-center z-10 px-1"
                  >
                    {pos.isVisible ? (
                      row.isMilestone ? (
                        /* MILESTONE DIAMOND MARKER */
                        <div
                          style={{ left: `${pos.left}%` }}
                          className="absolute -translate-x-1/2 flex items-center gap-1.5 cursor-pointer group"
                          onClick={() => row.item && onOpenEditItemModal(row.item)}
                          onMouseEnter={(e) => {
                            setHoveredRow(row);
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <div className="w-4 h-4 rotate-45 bg-amber-500 border-2 border-amber-300 shadow-md shadow-amber-500/30 group-hover:scale-125 transition-transform" />
                          <span className="text-[11px] font-medium text-amber-500 dark:text-amber-300 drop-shadow-xs whitespace-nowrap hidden sm:inline">
                            {row.title}
                          </span>
                        </div>
                      ) : row.isProject ? (
                        /* PROJECT SUMMARY BRACKET BAR */
                        <div
                          className="absolute h-5 rounded-md bg-[#27272a]/40 border shadow-xs flex items-center overflow-hidden cursor-pointer group hover:brightness-105 transition-all"
                          style={{
                            left: `${pos.left}%`,
                            width: `${pos.width}%`,
                            borderColor: projColor,
                          }}
                          onClick={() => toggleCollapse(row.id, true)}
                          onMouseEnter={(e) => {
                            setHoveredRow(row);
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          {/* Inner Progress Fill */}
                          <div
                            className="h-full opacity-40 transition-all duration-300"
                            style={{
                              width: `${row.progressPercent}%`,
                              backgroundColor: projColor,
                            }}
                          />
                          <span
                            className="absolute left-2 text-[10px] font-bold truncate pr-2"
                            style={{ color: projColor }}
                          >
                            {row.title} ({row.progressPercent}%)
                          </span>
                        </div>
                      ) : (
                        /* REGULAR TASK BAR */
                        <div
                          style={{ left: `${pos.left}%`, width: `${pos.width}%` }}
                          className={`absolute h-7 rounded-lg border shadow-xs flex items-center overflow-hidden transition-all hover:brightness-105 hover:shadow-md cursor-pointer group ${statusStyle.barBg} ${statusStyle.border}`}
                          onClick={() => row.item && onOpenEditItemModal(row.item)}
                          onMouseEnter={(e) => {
                            setHoveredRow(row);
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          {/* Progress Fill inside the bar */}
                          <div
                            className={`h-full ${statusStyle.fillBg} transition-all duration-300`}
                            style={{ width: `${row.progressPercent}%` }}
                          />

                          {/* Task Bar Label: High contrast in both light & dark mode */}
                          <div className="absolute inset-0 px-2 flex items-center justify-between pointer-events-none text-[11px] font-semibold text-zinc-900 dark:text-white">
                            <span className="truncate pr-1 drop-shadow-xs">{row.title}</span>
                            <span className="text-[10px] font-mono shrink-0 drop-shadow-xs">
                              {row.progressPercent}%
                            </span>
                          </div>
                        </div>
                      )
                    ) : (
                      /* If bar is outside visible timeline, show small directional marker */
                      <div className="text-[10px] text-[#71717a] italic pl-2">
                        {row.endDate < timelineRange.start ? '← Completed earlier' : 'Scheduled later →'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING HOVER TOOLTIP */}
      {hoveredRow && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none bg-[#18181b]/95 backdrop-blur-md border border-[#27272a] p-3 rounded-xl shadow-2xl text-xs space-y-1.5 max-w-xs animate-in fade-in zoom-in-95"
          style={{
            left: `${Math.min(window.innerWidth - 260, tooltipPos.x + 12)}px`,
            top: `${Math.min(window.innerHeight - 180, tooltipPos.y + 12)}px`,
          }}
        >
          <div className="font-bold text-[#f4f4f5] flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: hoveredRow.project.color || '#f97316' }}
            />
            <span className="truncate">{hoveredRow.title}</span>
          </div>
          <div className="text-[11px] text-[#a1a1aa] flex items-center gap-1">
            <Folder className="w-3 h-3 text-orange-400" />
            <span>Project: {hoveredRow.project.title}</span>
          </div>
          <div className="text-[11px] text-[#a1a1aa] flex items-center gap-1">
            <Calendar className="w-3 h-3 text-orange-400" />
            <span>
              {hoveredRow.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {' — '}
              {hoveredRow.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="text-[11px] text-[#a1a1aa] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Status: <strong className="capitalize">{hoveredRow.status}</strong> ({hoveredRow.progressPercent}%)</span>
          </div>
          {hoveredRow.assignee && (
            <div className="text-[11px] text-[#a1a1aa] flex items-center gap-1">
              <User className="w-3 h-3 text-blue-400" />
              <span>Assignee: {hoveredRow.assignee.name}</span>
            </div>
          )}
          {hoveredRow.loggedSeconds > 0 && (
            <div className="text-[11px] text-[#a1a1aa] flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Logged: {formatDuration(hoveredRow.loggedSeconds)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

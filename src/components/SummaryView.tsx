import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Search,
  Folder,
  X,
  Check,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { TimeBasedToolbar } from './TimeBasedToolbar';
import { AppData, ItemNode, ProjectNode } from '../types';
import {
  formatDuration,
  getReportableFlatItems,
  getAllItemSessionsRecursive,
} from '../utils/treeUtils';

interface SummaryViewProps {
  appData: AppData;
  onOpenEditItemModal?: (item: ItemNode) => void;
  onStopTimer?: () => void;
  selectedProjectId?: string;
  onSelectProjectFilter?: (projectId: string) => void;
  selectedPersonId?: string;
  onSelectPersonFilter?: (personId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  timeScale?: SummaryGranularity;
  onTimeScaleChange?: (scale: SummaryGranularity) => void;
  currentDate?: Date;
  onCurrentDateChange?: (date: Date) => void;
}

export type SummaryGranularity = 'day' | 'week' | 'month' | 'year';

interface DayTaskSummary {
  itemId: string;
  item: ItemNode;
  itemName: string;
  fullPath: string;
  projectId: string;
  projectTitle: string;
  projectColor?: string;
  assigneeName?: string;
  reviewerName?: string;
  status: string;
  loggedSeconds: number;
  hasExplicitSession?: boolean;
  earliestStartMs?: number;
}

interface DailyGroup {
  dateKey: string; // YYYY-MM-DD
  dateLabel: string; // e.g. "Mon, 17 Aug 2026"
  totalSeconds: number;
  tasks: DayTaskSummary[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const SummaryView: React.FC<SummaryViewProps> = ({
  appData,
  onOpenEditItemModal,
  onStopTimer,
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
}) => {
  // Local fallback state for granularity with localStorage sync
  const [internalGranularity, setInternalGranularity] = useState<SummaryGranularity>(() => {
    try {
      const saved =
        localStorage.getItem('struktur_filter_timescale') ||
        localStorage.getItem('struktur_calendar_viewtype') ||
        localStorage.getItem('struktur_timeline_timescale') ||
        localStorage.getItem('struktur_summary_timescale');
      if (saved && ['day', 'week', 'month', 'year'].includes(saved)) {
        return saved as SummaryGranularity;
      }
    } catch {
      // ignore
    }
    return 'month';
  });

  const granularity = controlledTimeScale !== undefined ? controlledTimeScale : internalGranularity;

  const setGranularity = (newScale: SummaryGranularity) => {
    if (onTimeScaleChange) {
      onTimeScaleChange(newScale);
    }
    setInternalGranularity(newScale);
    try {
      localStorage.setItem('struktur_filter_timescale', newScale);
      localStorage.setItem('struktur_calendar_viewtype', newScale);
      localStorage.setItem('struktur_timeline_timescale', newScale);
      localStorage.setItem('struktur_summary_timescale', newScale);
    } catch {
      // ignore
    }
  };

  // Synced reference date across Timeline, Calendar, and Summary
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

  // Dropdowns state
  const [isGranularityDropdownOpen, setIsGranularityDropdownOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(() => new Date());
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);

  // Search local fallback if props not provided
  const [localSearch, setLocalSearch] = useState('');
  const currentSearchQuery = onSearchChange ? searchQuery : localSearch;
  const handleSearchInputChange = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    else setLocalSearch(val);
  };

  // Refs for click outside
  const granularityDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const projectFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (granularityDropdownRef.current && !granularityDropdownRef.current.contains(e.target as Node)) {
        setIsGranularityDropdownOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
      }
      if (projectFilterRef.current && !projectFilterRef.current.contains(e.target as Node)) {
        setIsProjectFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update pickerDate whenever currentDate changes
  useEffect(() => {
    setPickerDate(new Date(currentDate));
  }, [currentDate]);

  const isNoneProjects = selectedProjectId === 'none';
  const isNonePersons = selectedPersonId === 'none';

  const selectedProjectIds = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === 'all' || selectedProjectId === 'none') return [];
    return selectedProjectId.split(',').filter(Boolean);
  }, [selectedProjectId]);

  const selectedPersonIds = useMemo(() => {
    if (!selectedPersonId || selectedPersonId === 'all' || selectedPersonId === 'none') return [];
    return selectedPersonId.split(',').filter(Boolean);
  }, [selectedPersonId]);

  // Project filtering
  const activeProjects = useMemo(() => {
    if (isNoneProjects) return [];
    const active = appData.projects.filter((p) => p.status === 'active');
    if (selectedProjectIds.length > 0) {
      return active.filter((p) => selectedProjectIds.includes(p.id));
    }
    return active;
  }, [appData.projects, isNoneProjects, selectedProjectIds]);

  // Navigation handlers
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (granularity === 'day') {
      d.setDate(d.getDate() - 1);
    } else if (granularity === 'week') {
      d.setDate(d.getDate() - 7);
    } else if (granularity === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (granularity === 'year') {
      d.setFullYear(d.getFullYear() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (granularity === 'day') {
      d.setDate(d.getDate() + 1);
    } else if (granularity === 'week') {
      d.setDate(d.getDate() + 7);
    } else if (granularity === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (granularity === 'year') {
      d.setFullYear(d.getFullYear() + 1);
    }
    setCurrentDate(d);
  };

  // Header Title generation based on granularity (Matches GanttView format)
  const headerTitle = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = MONTH_NAMES[currentDate.getMonth()];
    const day = currentDate.getDate();

    if (granularity === 'year') return `${year}`;
    if (granularity === 'day') return `${day} ${month.substring(0, 3)} ${year}`;
    if (granularity === 'week') {
      // Find Monday of current week
      const dayOfWeek = (currentDate.getDay() + 6) % 7; // 0 for Monday
      const monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() - dayOfWeek);
      const endDay = new Date(monday);
      endDay.setDate(monday.getDate() + 6);

      const sMonth = MONTH_NAMES[monday.getMonth()].substring(0, 3);
      const eMonth = MONTH_NAMES[endDay.getMonth()].substring(0, 3);
      if (monday.getFullYear() !== endDay.getFullYear()) {
        return `${monday.getDate()} ${sMonth} ${monday.getFullYear()} - ${endDay.getDate()} ${eMonth} ${endDay.getFullYear()}`;
      }
      return `${monday.getDate()} ${sMonth} - ${endDay.getDate()} ${eMonth} ${year}`;
    }

    return `${month} ${year}`;
  }, [currentDate, granularity]);

  // Date Range Bounds based on granularity
  const { startBound, endBound } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();

    if (granularity === 'day') {
      const s = new Date(year, month, day, 0, 0, 0, 0);
      const e = new Date(year, month, day, 23, 59, 59, 999);
      return { startBound: s, endBound: e };
    }

    if (granularity === 'week') {
      const curr = new Date(currentDate);
      const d = curr.getDay();
      const diff = curr.getDate() - d + (d === 0 ? -6 : 1);
      const monday = new Date(curr.setDate(diff));
      const s = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
      const e = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
      return { startBound: s, endBound: e };
    }

    if (granularity === 'year') {
      const s = new Date(year, 0, 1, 0, 0, 0, 0);
      const e = new Date(year, 11, 31, 23, 59, 59, 999);
      return { startBound: s, endBound: e };
    }

    // Month
    const s = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const e = new Date(year, month, lastDay, 23, 59, 59, 999);
    return { startBound: s, endBound: e };
  }, [currentDate, granularity]);

  // Helper duration formatter
  const formatHoursDisplay = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (hrs > 0 && mins > 0) {
      return `${hrs}h ${mins}m`;
    } else if (hrs > 0) {
      return `${hrs}h`;
    } else if (mins > 0) {
      return `${mins}m`;
    } else {
      const secs = seconds % 60;
      return `${secs}s`;
    }
  };

  // Aggregate daily tasks for the active period & filters
  const dailyGroups = useMemo<DailyGroup[]>(() => {
    const dayMap = new Map<string, Map<string, DayTaskSummary>>();
    const searchFilter = currentSearchQuery.trim().toLowerCase();

    // Helper to add task duration to a date
    const addSession = (
      dateStr: string,
      item: ItemNode,
      project: ProjectNode,
      seconds: number,
      fullPath: string
    ) => {
      if (seconds <= 0) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;

      if (d >= startBound && d <= endBound) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;

        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, new Map());
        }

        const taskMap = dayMap.get(dateKey)!;
        const assignee = appData.persons.find((p) => p.id === item.assigneeId);
        const sStartMs = d.getTime();

        if (taskMap.has(item.id)) {
          const existing = taskMap.get(item.id)!;
          existing.loggedSeconds += seconds;
          existing.hasExplicitSession = true;
          existing.fullPath = fullPath;
          existing.item = item;
          if (existing.earliestStartMs === undefined || sStartMs < existing.earliestStartMs) {
            existing.earliestStartMs = sStartMs;
          }
        } else {
          taskMap.set(item.id, {
            itemId: item.id,
            item,
            itemName: item.name,
            fullPath,
            projectId: project.id,
            projectTitle: project.title,
            projectColor: project.color,
            assigneeName: assignee?.name,
            status: item.status,
            loggedSeconds: seconds,
            hasExplicitSession: true,
            earliestStartMs: sStartMs,
          });
        }
      }
    };

    // Person filter helper matching TreeView / CalendarView recursive logic
    const matchesPerson = (node: ItemNode): boolean => {
      if (isNonePersons) return false;
      if (selectedPersonIds.length === 0) return true;
      const hasPerson =
        (node.assigneeId && selectedPersonIds.includes(node.assigneeId)) ||
        (node.reviewerId && selectedPersonIds.includes(node.reviewerId)) ||
        (node.assigneeId && selectedPersonIds.some((id) => id.toLowerCase() === node.assigneeId?.toLowerCase())) ||
        (node.reviewerId && selectedPersonIds.some((id) => id.toLowerCase() === node.reviewerId?.toLowerCase()));
      if (hasPerson) return true;
      if (node.subItems && node.subItems.length > 0) {
        return node.subItems.some((child) => matchesPerson(child));
      }
      return false;
    };

    // Traverse all reportable items across active projects
    const reportableFlat = getReportableFlatItems(activeProjects);

    reportableFlat.forEach(({ item, project, parentPath }) => {
      // Search filter check
      const pathSegments = [...parentPath, item.name];
      const fullPath = pathSegments.join(' > ');

      if (searchFilter) {
        const matchName = item.name.toLowerCase().includes(searchFilter);
        const matchPath = fullPath.toLowerCase().includes(searchFilter);
        const matchProject = project.title.toLowerCase().includes(searchFilter);
        if (!matchName && !matchPath && !matchProject) return;
      }

      // Person filter check (supports parent or subItem matching)
      if (selectedPersonIds.length > 0) {
        if (!matchesPerson(item)) return;
      }

      // Gather all sessions
      const allItemSessions = getAllItemSessionsRecursive(
        item,
        appData.settings.activeTimer?.itemId,
        appData.settings.activeTimer?.startedAt
      );

      if (allItemSessions.length > 0) {
        allItemSessions.forEach((sess) => {
          if (sess.loggedSeconds && sess.loggedSeconds > 0) {
            if (sess.startedAt) {
              addSession(sess.startedAt, item, project, sess.loggedSeconds, fullPath);
            }
          } else if (sess.startedAt) {
            const sStart = new Date(sess.startedAt);
            const sEnd = sess.endedAt ? new Date(sess.endedAt) : sStart;
            if (!isNaN(sStart.getTime()) && !isNaN(sEnd.getTime())) {
              const curr = new Date(sStart.getFullYear(), sStart.getMonth(), sStart.getDate());
              const finalEnd = new Date(sEnd.getFullYear(), sEnd.getMonth(), sEnd.getDate());
              const maxRangeDays = 366;
              let dayCount = 0;

              while (curr <= finalEnd && dayCount < maxRangeDays) {
                if (curr >= startBound && curr <= endBound) {
                  const yyyy = curr.getFullYear();
                  const mm = String(curr.getMonth() + 1).padStart(2, '0');
                  const dd = String(curr.getDate()).padStart(2, '0');
                  const dateKey = `${yyyy}-${mm}-${dd}`;

                  if (!dayMap.has(dateKey)) {
                    dayMap.set(dateKey, new Map());
                  }

                  const taskMap = dayMap.get(dateKey)!;
                  const sStartMs = sStart.getTime();
                  if (!taskMap.has(item.id)) {
                    const assignee = appData.persons.find((p) => p.id === item.assigneeId);
                    taskMap.set(item.id, {
                      itemId: item.id,
                      item,
                      itemName: item.name,
                      fullPath,
                      projectId: project.id,
                      projectTitle: project.title,
                      projectColor: project.color,
                      assigneeName: assignee?.name,
                      status: item.status,
                      loggedSeconds: 0,
                      hasExplicitSession: true,
                      earliestStartMs: sStartMs,
                    });
                  } else {
                    const existing = taskMap.get(item.id)!;
                    if (existing.earliestStartMs === undefined || sStartMs < existing.earliestStartMs) {
                      existing.earliestStartMs = sStartMs;
                    }
                  }
                }
                curr.setDate(curr.getDate() + 1);
                dayCount++;
              }
            }
          }
        });
      } else {
        // Fallback for tasks with NO recorded sessions
        const startDateObj = item.actualStartDate ? new Date(item.actualStartDate) : null;
        const endDateObj = item.actualEndDate ? new Date(item.actualEndDate) : null;

        const validStart = startDateObj && !isNaN(startDateObj.getTime())
          ? new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate())
          : null;
        const validEnd = endDateObj && !isNaN(endDateObj.getTime())
          ? new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate())
          : null;

        const rangeStart = validStart || validEnd;
        const rangeEnd = validEnd && validStart && validEnd >= validStart ? validEnd : (validEnd || validStart);

        if (rangeStart) {
          const curr = new Date(rangeStart);
          const finalEnd = rangeEnd || rangeStart;
          const maxRangeDays = 366;
          let dayCount = 0;

          while (curr <= finalEnd && dayCount < maxRangeDays) {
            if (curr >= startBound && curr <= endBound) {
              const yyyy = curr.getFullYear();
              const mm = String(curr.getMonth() + 1).padStart(2, '0');
              const dd = String(curr.getDate()).padStart(2, '0');
              const dateKey = `${yyyy}-${mm}-${dd}`;

              if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, new Map());
              }

              const taskMap = dayMap.get(dateKey)!;
              if (!taskMap.has(item.id)) {
                const assignee = appData.persons.find((p) => p.id === item.assigneeId);
                taskMap.set(item.id, {
                  itemId: item.id,
                  item,
                  itemName: item.name,
                  fullPath,
                  projectId: project.id,
                  projectTitle: project.title,
                  projectColor: project.color,
                  assigneeName: assignee?.name,
                  status: item.status,
                  loggedSeconds: 0,
                  hasExplicitSession: false,
                });
              }
            }
            curr.setDate(curr.getDate() + 1);
            dayCount++;
          }
        }
      }
    });

    // Convert map to sorted array of DailyGroup (chronological order: 1st of month at top, 31st at bottom)
    const groups: DailyGroup[] = [];
    const sortedDateKeys = Array.from(dayMap.keys()).sort((a, b) => a.localeCompare(b));

    sortedDateKeys.forEach((dateKey) => {
      const taskMap = dayMap.get(dateKey)!;
      const tasks = Array.from(taskMap.values());

      // Sort tasks chronologically by earliestStartMs (earlier sessions appear first)
      tasks.sort((a, b) => {
        if (a.earliestStartMs !== undefined && b.earliestStartMs !== undefined) {
          return a.earliestStartMs - b.earliestStartMs;
        }
        if (a.earliestStartMs !== undefined) return -1;
        if (b.earliestStartMs !== undefined) return 1;
        return 0;
      });

      const totalSeconds = tasks.reduce((sum, t) => sum + t.loggedSeconds, 0);

      const [y, m, d] = dateKey.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);

      const dateLabel = dateObj.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      groups.push({
        dateKey,
        dateLabel,
        totalSeconds,
        tasks,
      });
    });

    return groups;
  }, [appData, activeProjects, currentSearchQuery, selectedPersonId, startBound, endBound]);

  // Aggregated Summary Stats
  const totalPeriodSeconds = useMemo(() => {
    return dailyGroups.reduce((acc, g) => acc + g.totalSeconds, 0);
  }, [dailyGroups]);

  const totalPeriodTasksWorked = useMemo(() => {
    const set = new Set<string>();
    dailyGroups.forEach((g) => {
      g.tasks.forEach((t) => set.add(t.itemId));
    });
    return set.size;
  }, [dailyGroups]);

  // Date Picker Grid Renderer
  const renderPickerGrid = () => {
    const year = pickerDate.getFullYear();
    const month = pickerDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
    const adjustedFirstDay = (firstDayIndex + 6) % 7; // Mon is 0
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const cells = [];
    for (let i = 0; i < adjustedFirstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-7 w-7" />);
    }

    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const isSelected =
        currentDate.getFullYear() === year &&
        currentDate.getMonth() === month &&
        currentDate.getDate() === dayNum;

      const isToday =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === dayNum;

      cells.push(
        <button
          key={`day-${dayNum}`}
          type="button"
          onClick={() => {
            const chosen = new Date(year, month, dayNum);
            setCurrentDate(chosen);
            setIsDatePickerOpen(false);
          }}
          className={`h-7 w-7 rounded-lg text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
            isSelected
              ? 'bg-orange-500 text-white font-bold shadow-xs'
              : isToday
              ? 'border border-orange-500/50 text-orange-400 font-semibold'
              : 'text-[#f4f4f5] hover:bg-[#27272a]'
          }`}
        >
          {dayNum}
        </button>
      );
    }
    return cells;
  };

  const toInputDateString = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDateRange = (startStr?: string, endStr?: string) => {
    if (!startStr && !endStr) return null;
    const s = startStr ? new Date(startStr) : null;
    const e = endStr ? new Date(endStr) : null;
    const validS = s && !isNaN(s.getTime()) ? s : null;
    const validE = e && !isNaN(e.getTime()) ? e : null;

    if (validS && validE) {
      const sDate = validS.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const eDate = validE.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      if (sDate === eDate) return sDate;
      // Start date always displayed first
      return `${sDate} – ${eDate}`;
    }
    if (validS) return validS.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (validE) return validE.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return null;
  };

  return (
    <div className="w-full max-w-[1366px] mx-auto space-y-2 pb-16">
      {/* Time-Based Unified Toolbar */}
      <TimeBasedToolbar
        projects={appData.projects}
        selectedProjectId={selectedProjectId || 'all'}
        onSelectProject={(id) => {
          if (onSelectProjectFilter) onSelectProjectFilter(id);
        }}
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
        timeScale={granularity}
        onTimeScaleChange={(scale) => {
          setGranularity(scale);
          if (onTimeScaleChange) onTimeScaleChange(scale);
        }}
        hasActiveTimer={!!appData.settings.activeTimer}
        appData={appData}
        onStopTimer={onStopTimer}
        onOpenEditItemModal={onOpenEditItemModal}
      />

      <div className="w-full space-y-4 pt-1">
        {/* Summary Stat Badges (Flat, rounded-lg, clean metrics) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-[#141417] border border-[#27272a] rounded-lg p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Total Logged</span>
            <span className="text-sm font-bold font-mono text-orange-400 mt-1">
              {formatHoursDisplay(totalPeriodSeconds)}
            </span>
          </div>
          <div className="bg-[#141417] border border-[#27272a] rounded-lg p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Active Days</span>
            <span className="text-sm font-bold font-mono text-[#f4f4f5] mt-1">
              {dailyGroups.length} {dailyGroups.length === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="bg-[#141417] border border-[#27272a] rounded-lg p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Tasks Worked</span>
            <span className="text-sm font-bold font-mono text-[#10b981] mt-1">
              {totalPeriodTasksWorked} {totalPeriodTasksWorked === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <div className="bg-[#141417] border border-[#27272a] rounded-lg p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Daily Average</span>
            <span className="text-sm font-bold font-mono text-[#38bdf8] mt-1">
              {dailyGroups.length > 0 ? formatHoursDisplay(Math.round(totalPeriodSeconds / dailyGroups.length)) : '0h 00m'}
            </span>
          </div>
        </div>

      {/* Daily Grouped List */}
      {dailyGroups.length > 0 ? (
        <div className="space-y-6 pt-1">
          {dailyGroups.map((group) => (
            <div
              key={group.dateKey}
              className="space-y-0"
            >
              {/* Date Header */}
              <div className="px-1 py-2.5 border-b border-[#27272a] flex items-center justify-between select-none">
                <h4 className="text-sm font-bold text-[#f4f4f5] flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-orange-500" />
                  <span>{group.dateLabel}</span>
                </h4>
                <span className="text-xs font-mono font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full">
                  Total: {formatHoursDisplay(group.totalSeconds)}
                </span>
              </div>

              {/* List of Tasks for this Day */}
              <div className="flex flex-col">
                {group.tasks.map((task) => (
                  <div
                    key={task.itemId}
                    onClick={() => {
                      if (onOpenEditItemModal && task.item) {
                        onOpenEditItemModal(task.item);
                      }
                    }}
                    className="px-2 sm:px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[#18181b]/70 border-b border-[#27272a]/60 text-xs transition-colors cursor-pointer group"
                  >
                    {/* Left: Task Name with Project Info */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs group-hover:scale-125 transition-transform"
                        style={{ backgroundColor: task.projectColor || '#f97316' }}
                      />
                      <div
                        className="text-[13px] font-medium flex items-center min-w-0 flex-wrap overflow-hidden"
                        title={task.fullPath || task.itemName}
                      >
                        {(() => {
                          const pathText = task.fullPath || task.itemName;
                          const parts = pathText.split(' > ');
                          if (parts.length <= 1) {
                            return (
                              <span className="text-[#f4f4f5] group-hover:text-orange-400 font-medium transition-colors truncate">
                                {pathText}
                              </span>
                            );
                          }
                          return parts.map((part, idx) => {
                            const isLast = idx === parts.length - 1;
                            return (
                              <React.Fragment key={idx}>
                                {idx > 0 && (
                                  <ChevronRight className="w-3.5 h-3.5 mx-1 text-[#71717a] shrink-0 inline-block" />
                                )}
                                <span
                                  className={
                                    isLast
                                      ? 'text-[#f4f4f5] group-hover:text-orange-400 font-semibold transition-colors truncate'
                                      : 'text-[#a1a1aa] group-hover:text-[#d4d4d8] transition-colors truncate'
                                  }
                                >
                                  {part}
                                </span>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Right: Date Range, Assignee/Reviewer Avatars, and Formatted Hours */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Date Range formatted with Start Date first */}
                      {(() => {
                        const dateRangeText = formatDateRange(task.item.actualStartDate, task.item.actualEndDate);
                        if (!dateRangeText) return null;
                        return (
                          <span className="text-[11px] font-mono text-[#a1a1aa] hidden md:inline-block">
                            {dateRangeText}
                          </span>
                        );
                      })()}

                      {/* Circular Avatars for Assignee & Reviewer (no pill/border) */}
                      {(() => {
                        const personsList = appData.persons || [];
                        const assignee = personsList.find(
                          (u) => u.id === task.item.assigneeId || u.name.toLowerCase() === task.item.assigneeId?.toLowerCase()
                        );
                        const reviewer = personsList.find(
                          (u) => u.id === task.item.reviewerId || u.name.toLowerCase() === task.item.reviewerId?.toLowerCase()
                        );

                        if (!assignee && !reviewer && !task.item.assigneeId) return null;

                        return (
                          <div
                            className="flex items-center -space-x-1.5"
                            title={`Assignee: ${assignee?.name || task.item.assigneeId || 'Unassigned'}${
                              reviewer ? `\nReviewer: ${reviewer.name}` : ''
                            }`}
                          >
                            {assignee ? (
                              <div className="relative shrink-0">
                                {assignee.avatar ? (
                                  <img
                                    src={assignee.avatar}
                                    alt={assignee.name}
                                    className="w-5 h-5 rounded-full object-cover ring-1 ring-[#101010]"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white uppercase ring-1 ring-[#101010]">
                                    {assignee.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ) : task.item.assigneeId ? (
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white uppercase ring-1 ring-[#101010] shrink-0">
                                {task.item.assigneeId.charAt(0).toUpperCase()}
                              </div>
                            ) : null}

                            {reviewer && (
                              <div className="relative shrink-0" title={`Reviewer: ${reviewer.name}`}>
                                {reviewer.avatar ? (
                                  <img
                                    src={reviewer.avatar}
                                    alt={reviewer.name}
                                    className="w-5 h-5 rounded-full object-cover ring-1 ring-[#101010]"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-[9px] font-bold text-white uppercase ring-1 ring-[#101010]">
                                    {reviewer.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Formatted hours only if session exists */}
                      {task.hasExplicitSession && task.loggedSeconds > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#52525b] font-mono">|</span>
                          <span className="text-xs font-mono font-semibold text-orange-400">
                            {formatHoursDisplay(task.loggedSeconds)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 px-4 bg-[#121215] border border-dashed border-[#27272a] rounded-xl space-y-3 shadow-md">
          <div className="w-12 h-12 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto text-[#71717a]">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#f4f4f5]">
              No Logged Tasks in {headerTitle}
            </h4>
            <p className="text-xs text-[#71717a] max-w-sm mx-auto">
              No time sessions were recorded for this period. Use the navigation controls above to view other dates or switch project filter.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={handleToday}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa] hover:text-[#f4f4f5] bg-[#18181b] border border-[#27272a] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Jump to Current Date
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

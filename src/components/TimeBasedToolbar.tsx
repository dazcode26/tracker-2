import React, { useState, useRef, useEffect } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  Search,
  X,
  Calendar as CalendarIcon,
  Users,
  Check,
} from 'lucide-react';
import { Person, ProjectNode } from '../types';
import { useHeadroom } from '../hooks/useHeadroom';
import { PortalMenu } from './PortalMenu';

export type TimeScaleOption = 'day' | 'week' | 'month' | 'year';

export interface TimeBasedToolbarProps {
  // Project Filter
  projects: ProjectNode[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;

  // Team Member Filter (Assignee & Reviewer)
  persons?: Person[];
  selectedPersonId?: string;
  onSelectPerson?: (personId: string) => void;

  // Search Input
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Date Navigation
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;

  // Header Date Title (e.g. "Sep 2026", "3-9 Aug 2026")
  headerTitle: string;

  // TimeScale Switcher
  timeScale: TimeScaleOption;
  onTimeScaleChange: (scale: TimeScaleOption) => void;
  allowedTimeScales?: TimeScaleOption[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const TimeBasedToolbar: React.FC<TimeBasedToolbarProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  persons = [],
  selectedPersonId = 'all',
  onSelectPerson,
  searchQuery,
  onSearchChange,
  currentDate,
  onDateChange,
  onToday,
  onPrev,
  onNext,
  headerTitle,
  timeScale,
  onTimeScaleChange,
  allowedTimeScales = ['day', 'week', 'month', 'year'],
}) => {
  // Portal Menu Anchors
  const [projectAnchor, setProjectAnchor] = useState<{ rect: DOMRect; el: HTMLElement } | null>(null);
  const [personAnchor, setPersonAnchor] = useState<{ rect: DOMRect; el: HTMLElement } | null>(null);
  const [datePickerAnchor, setDatePickerAnchor] = useState<{ rect: DOMRect; el: HTMLElement } | null>(null);
  const [timeScaleAnchor, setTimeScaleAnchor] = useState<{ rect: DOMRect; el: HTMLElement } | null>(null);

  const isProjectFilterOpen = Boolean(projectAnchor);
  const isPersonFilterOpen = Boolean(personAnchor);
  const isDatePickerOpen = Boolean(datePickerAnchor);
  const isTimeScaleOpen = Boolean(timeScaleAnchor);

  // Picker Month/Year calendar navigation state
  const [pickerDate, setPickerDate] = useState<Date>(new Date(currentDate));
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Headroom hook for sticky auto-hide with identical behavior to StructureToolbar
  const isAnyMenuOpen = isProjectFilterOpen || isPersonFilterOpen || isDatePickerOpen || isTimeScaleOpen;
  const { isSticky, isVisible } = useHeadroom({ forceVisible: isAnyMenuOpen });

  // Sync picker date when currentDate changes or picker opens
  useEffect(() => {
    setPickerDate(new Date(currentDate));
  }, [currentDate, isDatePickerOpen]);

  // Active projects list
  const activeProjects = projects.filter((p) => p.status === 'active');

  // Multi-select projects parsing (comma-separated, 'none', or 'all')
  const isNoneProjects = selectedProjectId === 'none';
  const selectedProjectIds = React.useMemo(() => {
    if (!selectedProjectId || selectedProjectId === 'all' || selectedProjectId === 'none') return [];
    return selectedProjectId.split(',').filter(Boolean);
  }, [selectedProjectId]);

  const isAllProjectsSelected =
    !isNoneProjects &&
    (!selectedProjectId ||
      selectedProjectId === 'all' ||
      (activeProjects.length > 0 && selectedProjectIds.length === activeProjects.length));

  // Multi-select team parsing (comma-separated, 'none', or 'all')
  const isNonePersons = selectedPersonId === 'none';
  const selectedPersonIds = React.useMemo(() => {
    if (!selectedPersonId || selectedPersonId === 'all' || selectedPersonId === 'none') return [];
    return selectedPersonId.split(',').filter(Boolean);
  }, [selectedPersonId]);

  const isAllPersonsSelected =
    !isNonePersons &&
    (!selectedPersonId ||
      selectedPersonId === 'all' ||
      (persons.length > 0 && selectedPersonIds.length === persons.length));

  // Toggle dropdown helpers
  const handleToggleProjectDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isProjectFilterOpen) {
      setProjectAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setProjectAnchor({ rect, el: e.currentTarget });
      setPersonAnchor(null);
      setDatePickerAnchor(null);
      setTimeScaleAnchor(null);
    }
  };

  const handleTogglePersonDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isPersonFilterOpen) {
      setPersonAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setPersonAnchor({ rect, el: e.currentTarget });
      setProjectAnchor(null);
      setDatePickerAnchor(null);
      setTimeScaleAnchor(null);
    }
  };

  const handleToggleDatePicker = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDatePickerOpen) {
      setDatePickerAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setDatePickerAnchor({ rect, el: e.currentTarget });
      setProjectAnchor(null);
      setPersonAnchor(null);
      setTimeScaleAnchor(null);
    }
  };

  const handleToggleTimeScale = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isTimeScaleOpen) {
      setTimeScaleAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setTimeScaleAnchor({ rect, el: e.currentTarget });
      setProjectAnchor(null);
      setPersonAnchor(null);
      setDatePickerAnchor(null);
    }
  };

  // Project select helpers
  const handleToggleProject = (projId: string) => {
    let next: string[];
    if (isAllProjectsSelected) {
      next = activeProjects.map((p) => p.id).filter((id) => id !== projId);
    } else if (isNoneProjects) {
      next = [projId];
    } else if (selectedProjectIds.includes(projId)) {
      next = selectedProjectIds.filter((id) => id !== projId);
    } else {
      next = [...selectedProjectIds, projId];
    }
    if (next.length === activeProjects.length) {
      onSelectProject('all');
    } else if (next.length === 0) {
      onSelectProject('none');
    } else {
      onSelectProject(next.join(','));
    }
  };

  const handleToggleAllProjects = () => {
    if (isAllProjectsSelected) {
      onSelectProject('none');
    } else {
      onSelectProject('all');
    }
  };

  const handleSelectAllProjects = () => {
    onSelectProject('all');
  };

  // Person select helpers
  const handleTogglePerson = (uId: string) => {
    if (!onSelectPerson) return;
    let next: string[];
    if (isAllPersonsSelected) {
      next = persons.map((u) => u.id).filter((id) => id !== uId);
    } else if (isNonePersons) {
      next = [uId];
    } else if (selectedPersonIds.includes(uId)) {
      next = selectedPersonIds.filter((id) => id !== uId);
    } else {
      next = [...selectedPersonIds, uId];
    }
    if (next.length === persons.length) {
      onSelectPerson('all');
    } else if (next.length === 0) {
      onSelectPerson('none');
    } else {
      onSelectPerson(next.join(','));
    }
  };

  const handleToggleAllPersons = () => {
    if (!onSelectPerson) return;
    if (isAllPersonsSelected) {
      onSelectPerson('none');
    } else {
      onSelectPerson('all');
    }
  };

  const handleSelectAllPersons = () => {
    if (onSelectPerson) {
      onSelectPerson('all');
    }
  };

  // Date format & calculations
  const toInputDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const isTodayDate = (d: Date): boolean => {
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const handlePickerPrevMonth = () => {
    const d = new Date(pickerDate);
    d.setMonth(d.getMonth() - 1);
    setPickerDate(d);
  };

  const handlePickerNextMonth = () => {
    const d = new Date(pickerDate);
    d.setMonth(d.getMonth() + 1);
    setPickerDate(d);
  };

  const allTimeScaleModes: { id: TimeScaleOption; label: string; shortcut: string }[] = [
    { id: 'day', label: 'Day', shortcut: 'D' },
    { id: 'week', label: 'Week', shortcut: 'W' },
    { id: 'month', label: 'Month', shortcut: 'M' },
    { id: 'year', label: 'Year', shortcut: 'Y' },
  ];
  const timeScaleModes = allTimeScaleModes.filter((m) => allowedTimeScales.includes(m.id));

  // Render Date Picker Grid (Monday-based)
  const renderPickerGrid = () => {
    const pYear = pickerDate.getFullYear();
    const pMonth = pickerDate.getMonth();
    const daysInMonth = new Date(pYear, pMonth + 1, 0).getDate();

    // Monday-based offset (0 = Mon, 6 = Sun)
    const firstDay = new Date(pYear, pMonth, 1).getDay();
    const startOffset = (firstDay + 6) % 7;
    const daysInPrevMonth = new Date(pYear, pMonth, 0).getDate();
    const cells: React.ReactNode[] = [];

    // Prev month trailing days
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const cellDate = new Date(pYear, pMonth - 1, dayNum);
      cells.push(
        <button
          key={`prev-${dayNum}`}
          type="button"
          onClick={() => {
            onDateChange(cellDate);
            setDatePickerAnchor(null);
          }}
          className="h-7 w-full flex items-center justify-center text-[11px] text-[#52525b] [data-theme=light]:text-slate-400 hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 rounded transition-colors cursor-pointer"
        >
          {dayNum}
        </button>
      );
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(pYear, pMonth, d);
      const isSelected =
        currentDate.getFullYear() === pYear &&
        currentDate.getMonth() === pMonth &&
        currentDate.getDate() === d;
      const isToday = isTodayDate(cellDate);

      cells.push(
        <button
          key={`curr-${d}`}
          type="button"
          onClick={() => {
            onDateChange(cellDate);
            setDatePickerAnchor(null);
          }}
          className={`h-7 w-full flex items-center justify-center text-[11px] font-medium rounded transition-all cursor-pointer relative ${
            isSelected
              ? 'bg-orange-500 text-white font-bold shadow-xs'
              : isToday
              ? 'bg-orange-500/10 text-orange-400 font-semibold border border-orange-500/30'
              : 'text-[#f4f4f5] [data-theme=light]:text-slate-800 hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100'
          }`}
        >
          {d}
        </button>
      );
    }

    return cells;
  };

  const hasActiveFilters = !isAllProjectsSelected || !isAllPersonsSelected;

  return (
    <div
      className={`sticky top-0 z-30 transition-opacity duration-200 ease-out ${
        isSticky
          ? `py-2 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 bg-[#101010]/95 dark:bg-[#101010]/95 [data-theme=light]:bg-[#f8fafc]/95 backdrop-blur-md border-b border-[#27272a] [data-theme=light]:border-[#e2e8f0] shadow-lg shadow-black/25 ${
              isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`
          : 'opacity-100 py-0'
      }`}
    >
      <div className="max-w-[1400px] mx-auto w-full">
        <div
          className={`flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2 gap-x-2 md:gap-3 ${
            isSticky ? 'py-1 md:py-0 md:h-9' : 'pb-2 border-b border-[#27272a] [data-theme=light]:border-[#e2e8f0]'
          } relative w-full`}
        >
          {/* SEARCH & CONTROLS: ROW 1 ON MOBILE (order-1 w-full), RIGHT SIDE ON DESKTOP (order-2 md:w-auto md:ml-auto) */}
          <div className="order-1 w-full md:w-auto md:order-2 flex items-center gap-2 md:ml-auto shrink-0">
            {/* Search Input: Expands full remaining width on mobile, compact fixed width on desktop */}
            <div className="relative flex-1 md:flex-none min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717a] [data-theme=light]:text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full md:w-36 lg:w-44 h-8 pl-8 pr-7 rounded-lg bg-[#18181b] [data-theme=light]:bg-white border border-[#27272a] [data-theme=light]:border-[#e2e8f0] text-xs text-[#f4f4f5] [data-theme=light]:text-[#0f172a] placeholder-[#71717a] [data-theme=light]:placeholder-slate-400 focus:outline-none focus:border-orange-500/50 shadow-xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] [data-theme=light]:text-slate-400 hover:text-white [data-theme=light]:hover:text-slate-700 cursor-pointer p-0.5 rounded-full hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* TimeScale Switcher Button: Sized and aligned identically to StructureToolbar's action button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={handleToggleTimeScale}
                className={`h-8 w-[108px] sm:w-32 flex items-center justify-center gap-1.5 px-2 sm:px-3 rounded-lg border text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  isTimeScaleOpen
                    ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                    : 'border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400'
                }`}
                title="Change timescale view"
              >
                <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2] shrink-0" />
                <span className="capitalize">{timeScale}</span>
                <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
              </button>

              {/* TimeScale Portal Menu */}
              <PortalMenu
                isOpen={isTimeScaleOpen}
                onClose={() => setTimeScaleAnchor(null)}
                anchorRect={timeScaleAnchor?.rect || null}
                triggerElement={timeScaleAnchor?.el || null}
                align="right"
                className="w-44 bg-[#18181b] [data-theme=light]:bg-white border border-[#27272a] [data-theme=light]:border-[#e2e8f0] rounded-xl shadow-2xl [data-theme=light]:shadow-lg p-1.5 z-50 flex flex-col gap-0.5"
              >
                {timeScaleModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      onTimeScaleChange(mode.id);
                      setTimeScaleAnchor(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      timeScale === mode.id
                        ? 'bg-orange-500/15 text-orange-400 font-bold'
                        : 'text-[#a1a1aa] [data-theme=light]:text-slate-600 hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 hover:text-[#f4f4f5] [data-theme=light]:hover:text-slate-900'
                    }`}
                  >
                    <span>{mode.label}</span>
                    <span className="text-[10px] font-mono opacity-50">{mode.shortcut}</span>
                  </button>
                ))}
              </PortalMenu>
            </div>
          </div>

          {/* FILTERS & DATE NAVIGATION: ROW 2 ON MOBILE (order-2 w-full), LEFT SIDE ON DESKTOP (order-1 md:w-auto md:flex-1) */}
          <div
            className="order-2 w-full md:w-auto md:order-1 md:flex-1 md:min-w-0 flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto scrollbar-none py-0.5"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Project Filter Multi-select Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={handleToggleProjectDropdown}
                className={`h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-lg border text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0 max-w-[150px] xs:max-w-[180px] sm:max-w-[200px] md:max-w-[210px] ${
                  !isAllProjectsSelected
                    ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                    : 'bg-[#18181b] [data-theme=light]:bg-white border-[#27272a] [data-theme=light]:border-[#e2e8f0] hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 text-[#f4f4f5] [data-theme=light]:text-slate-800 hover:border-orange-500/40'
                }`}
                title="Filter by Project"
              >
                {isAllProjectsSelected ? (
                  <>
                    <Folder className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="truncate">All Projects</span>
                  </>
                ) : isNoneProjects || selectedProjectIds.length === 0 ? (
                  <>
                    <Folder className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                    <span className="truncate text-[#a1a1aa]">0 Projects</span>
                  </>
                ) : selectedProjectIds.length === 1 ? (
                  <>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          activeProjects.find((p) => p.id === selectedProjectIds[0])?.color || '#f97316',
                      }}
                    />
                    <span className="truncate">
                      {activeProjects.find((p) => p.id === selectedProjectIds[0])?.title || '1 Project'}
                    </span>
                  </>
                ) : (
                  <>
                    <Folder className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="truncate">{selectedProjectIds.length} Projects</span>
                    <span className="px-1.5 py-0.2 bg-orange-500/20 text-orange-400 text-[10px] font-mono font-bold rounded-full shrink-0">
                      {selectedProjectIds.length}
                    </span>
                  </>
                )}
                <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0 ml-auto" />
              </button>

              <PortalMenu
                isOpen={isProjectFilterOpen}
                onClose={() => setProjectAnchor(null)}
                anchorRect={projectAnchor?.rect || null}
                triggerElement={projectAnchor?.el || null}
                align="left"
                className="w-64 max-h-72 overflow-y-auto flex flex-col gap-1"
              >
                {/* Header row with quick actions */}
                <div className="flex items-center justify-between px-1.5 py-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#71717a]">
                    Filter Projects
                  </span>
                  {!isAllProjectsSelected && (
                    <button
                      type="button"
                      onClick={handleSelectAllProjects}
                      className="text-[11px] text-orange-400 hover:text-orange-300 font-medium cursor-pointer transition-colors"
                    >
                      Reset to All
                    </button>
                  )}
                </div>

                {/* Master All Projects Checkbox */}
                <button
                  type="button"
                  onClick={handleToggleAllProjects}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isAllProjectsSelected
                      ? 'bg-orange-500/15 text-orange-400 font-semibold'
                      : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                      isAllProjectsSelected
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-[#3f3f46] bg-[#27272a]/50'
                    }`}
                  >
                    {isAllProjectsSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <Folder className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="truncate flex-1">All Projects</span>
                  <span className="text-[10px] text-[#71717a] font-mono shrink-0">
                    {activeProjects.length}
                  </span>
                </button>

                <div className="h-px bg-[#27272a] my-0.5" />

                {/* Project List with individual checkboxes */}
                <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-0.5">
                  {activeProjects.map((p) => {
                    const isChecked = !isNoneProjects && (isAllProjectsSelected || selectedProjectIds.includes(p.id));
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleToggleProject(p.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-orange-500/15 text-orange-400 font-semibold'
                            : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'border-[#3f3f46] bg-[#27272a]/50'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color || '#f97316' }}
                        />
                        <span className="truncate flex-1">{p.title}</span>
                        {p.items && p.items.length > 0 && (
                          <span className="text-[10px] text-[#71717a] font-mono shrink-0">
                            {p.items.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </PortalMenu>
            </div>

            {/* Team Filter Multi-select Dropdown */}
            {persons && persons.length > 0 && onSelectPerson && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={handleTogglePersonDropdown}
                  className={`h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-lg border text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0 max-w-[130px] xs:max-w-[160px] sm:max-w-[180px] md:max-w-[190px] ${
                    !isAllPersonsSelected
                      ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                      : 'bg-[#18181b] [data-theme=light]:bg-white border-[#27272a] [data-theme=light]:border-[#e2e8f0] hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 text-[#f4f4f5] [data-theme=light]:text-slate-800 hover:border-orange-500/40'
                  }`}
                  title="Filter by Team Member"
                >
                  {isAllPersonsSelected ? (
                    <>
                      <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">All Team</span>
                    </>
                  ) : isNonePersons || selectedPersonIds.length === 0 ? (
                    <>
                      <Users className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                      <span className="truncate text-[#a1a1aa]">0 Members</span>
                    </>
                  ) : selectedPersonIds.length === 1 ? (
                    <>
                      {(() => {
                        const u = persons.find((user) => user.id === selectedPersonIds[0]);
                        return (
                          <>
                            {u?.avatar ? (
                              <img
                                src={u.avatar}
                                alt={u.name}
                                className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                              />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white uppercase shrink-0">
                                {u?.name?.charAt(0).toUpperCase() || 'U'}
                              </span>
                            )}
                            <span className="truncate">{u?.name || '1 Member'}</span>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{selectedPersonIds.length} Members</span>
                      <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-400 text-[10px] font-mono font-bold rounded-full shrink-0">
                        {selectedPersonIds.length}
                      </span>
                    </>
                  )}
                  <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0 ml-auto" />
                </button>

                <PortalMenu
                  isOpen={isPersonFilterOpen}
                  onClose={() => setPersonAnchor(null)}
                  anchorRect={personAnchor?.rect || null}
                  triggerElement={personAnchor?.el || null}
                  align="left"
                  className="w-64 max-h-72 overflow-y-auto flex flex-col gap-1"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between px-1.5 py-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#71717a]">
                      Filter Team Members
                    </span>
                    {!isAllPersonsSelected && (
                      <button
                        type="button"
                        onClick={handleSelectAllPersons}
                        className="text-[11px] text-orange-400 hover:text-orange-300 font-medium cursor-pointer transition-colors"
                      >
                        Reset to All
                      </button>
                    )}
                  </div>

                  {/* Master All Team Members Checkbox */}
                  <button
                    type="button"
                    onClick={handleToggleAllPersons}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isAllPersonsSelected
                        ? 'bg-orange-500/15 text-orange-400 font-semibold'
                        : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                        isAllPersonsSelected
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-[#3f3f46] bg-[#27272a]/50'
                      }`}
                    >
                      {isAllPersonsSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate flex-1">All Team Members</span>
                    <span className="text-[10px] text-[#71717a] font-mono shrink-0">
                      {persons.length}
                    </span>
                  </button>

                  <div className="h-px bg-[#27272a] my-0.5" />

                  {/* Team Members List with Checkboxes */}
                  <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-0.5">
                    {persons.map((u) => {
                      const isChecked = !isNonePersons && (isAllPersonsSelected || selectedPersonIds.includes(u.id));
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleTogglePerson(u.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-orange-500/15 text-orange-400 font-semibold'
                              : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 truncate">
                            <div
                              className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                                isChecked
                                  ? 'bg-orange-500 border-orange-500 text-white'
                                  : 'border-[#3f3f46] bg-[#27272a]/50'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            {u.avatar ? (
                              <img
                                src={u.avatar}
                                alt={u.name}
                                className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                              />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="truncate">{u.name}</span>
                          </div>
                          {u.role && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#27272a] text-[#71717a] font-mono shrink-0">
                              {u.role}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PortalMenu>
              </div>
            )}

            {/* Reset Filters Shortcut (directly beside Team filter) */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  onSelectProject('all');
                  if (onSelectPerson) onSelectPerson('all');
                }}
                className="h-8 px-2.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Contextual Information H2 & Navigation on all viewports (Mobile & Desktop) */}
        <div className="pt-2.5 pb-0.5 flex items-center justify-between gap-2">
          {/* Interactive Date Header with Date Picker Popover */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={handleToggleDatePicker}
              className="group flex items-center gap-1.5 text-left rounded-lg p-1 -m-1 hover:bg-[#18181b] [data-theme=light]:hover:bg-slate-100 transition-colors cursor-pointer select-none"
              title="Click to open Date Picker & jump to any date"
            >
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#f4f4f5] [data-theme=light]:text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2 min-w-0 truncate">
                <CalendarIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-orange-400 shrink-0" />
                <span className="truncate">{headerTitle}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#71717a] group-hover:text-orange-400 transition-transform duration-200 shrink-0 ${
                    isDatePickerOpen ? 'rotate-180 text-orange-400' : ''
                  }`}
                />
              </h2>
            </button>

            {/* Date Picker Popover Menu (Portaled directly to document.body) */}
            <PortalMenu
              isOpen={isDatePickerOpen}
              onClose={() => setDatePickerAnchor(null)}
              anchorRect={datePickerAnchor?.rect || null}
              triggerElement={datePickerAnchor?.el || null}
              align="left"
              className="w-64 sm:w-72 bg-[#18181b] [data-theme=light]:bg-white border border-[#27272a] [data-theme=light]:border-[#e2e8f0] rounded-2xl shadow-2xl [data-theme=light]:shadow-lg p-3 z-50 space-y-3"
            >
              {/* Header: Month/Year navigation */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#f4f4f5] [data-theme=light]:text-slate-800">
                  {MONTH_NAMES[pickerDate.getMonth()]} {pickerDate.getFullYear()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePickerPrevMonth}
                    className="p-1 rounded hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 text-[#a1a1aa] [data-theme=light]:text-slate-600 hover:text-white [data-theme=light]:hover:text-slate-900 transition-colors cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePickerNextMonth}
                    className="p-1 rounded hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 text-[#a1a1aa] [data-theme=light]:text-slate-600 hover:text-white [data-theme=light]:hover:text-slate-900 transition-colors cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day of week labels */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono text-[#71717a] [data-theme=light]:text-slate-500">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              {/* Grid of Days */}
              <div className="grid grid-cols-7 gap-1">{renderPickerGrid()}</div>

              {/* Footer Quick Jump Controls */}
              <div className="pt-2 border-t border-[#27272a] [data-theme=light]:border-[#e2e8f0] flex items-center justify-between gap-2 text-xs">
                <input
                  type="date"
                  value={toInputDateString(currentDate)}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-').map(Number);
                      onDateChange(new Date(y, m - 1, d));
                      setDatePickerAnchor(null);
                    }
                  }}
                  className="bg-[#09090b] [data-theme=light]:bg-slate-50 border border-[#27272a] [data-theme=light]:border-[#e2e8f0] rounded-lg px-2 py-1 text-[11px] text-[#f4f4f5] [data-theme=light]:text-slate-800 focus:outline-none focus:border-orange-500/50 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => {
                    onToday();
                    setDatePickerAnchor(null);
                  }}
                  className="px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Today
                </button>
              </div>
            </PortalMenu>
          </div>

          {/* Date Navigation (Prev, Today, Next) positioned at the right corner of H2 */}
          <div className="h-8 flex items-center bg-[#18181b] [data-theme=light]:bg-white border border-[#27272a] [data-theme=light]:border-[#e2e8f0] rounded-lg p-0.5 shrink-0 shadow-xs">
            <button
              type="button"
              onClick={onPrev}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 text-[#a1a1aa] [data-theme=light]:text-slate-600 hover:text-white [data-theme=light]:hover:text-slate-900 transition-colors cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="h-7 px-2.5 flex items-center justify-center rounded hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 text-xs font-semibold text-[#f4f4f5] [data-theme=light]:text-slate-800 hover:text-orange-400 transition-colors cursor-pointer"
              title="Jump to Today"
            >
              Today
            </button>
            <button
              type="button"
              onClick={onNext}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-[#27272a] [data-theme=light]:hover:bg-slate-100 text-[#a1a1aa] [data-theme=light]:text-slate-600 hover:text-white [data-theme=light]:hover:text-slate-900 transition-colors cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

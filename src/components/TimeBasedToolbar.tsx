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
} from 'lucide-react';
import { Person, ProjectNode } from '../types';

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

  // Header Date Title
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
  // Dropdown & Popover States
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);
  const [isPersonFilterOpen, setIsPersonFilterOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Picker Month/Year state
  const [pickerDate, setPickerDate] = useState<Date>(new Date(currentDate));

  const projectFilterRef = useRef<HTMLDivElement>(null);
  const personFilterRef = useRef<HTMLDivElement>(null);
  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when mobile search is opened
  useEffect(() => {
    if (isMobileSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  // Sync picker date when currentDate changes or picker opens
  useEffect(() => {
    setPickerDate(new Date(currentDate));
  }, [currentDate, isDatePickerOpen]);

  // Click outside listener & Escape key handler
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      if (
        projectFilterRef.current &&
        !projectFilterRef.current.contains(target)
      ) {
        setIsProjectFilterOpen(false);
      }
      if (
        personFilterRef.current &&
        !personFilterRef.current.contains(target)
      ) {
        setIsPersonFilterOpen(false);
      }
      if (
        viewDropdownRef.current &&
        !viewDropdownRef.current.contains(target)
      ) {
        setIsViewDropdownOpen(false);
      }
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(target)
      ) {
        setIsDatePickerOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProjectFilterOpen(false);
        setIsPersonFilterOpen(false);
        setIsViewDropdownOpen(false);
        setIsDatePickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleCloseMobileSearch = () => {
    onSearchChange('');
    setIsMobileSearchOpen(false);
  };

  const handleClearSearch = () => {
    onSearchChange('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleCloseMobileSearch();
    }
  };

  const activeProjects = projects.filter((p) => p.status === 'active');
  const selectedProject = activeProjects.find((p) => p.id === selectedProjectId);
  const selectedPerson = persons.find((u) => u.id === selectedPersonId);

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

    // Prev month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const cellDate = new Date(pYear, pMonth - 1, dayNum);
      cells.push(
        <button
          key={`prev-${dayNum}`}
          type="button"
          onClick={() => {
            onDateChange(cellDate);
            setIsDatePickerOpen(false);
          }}
          className="h-7 w-full flex items-center justify-center text-[11px] text-[#52525b] hover:bg-[#27272a] rounded transition-colors cursor-pointer"
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
            setIsDatePickerOpen(false);
          }}
          className={`h-7 w-full flex items-center justify-center text-[11px] font-medium rounded transition-all cursor-pointer relative ${
            isSelected
              ? 'bg-orange-500 text-white font-bold shadow-sm'
              : isToday
              ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/40'
              : 'text-[#f4f4f5] hover:bg-[#27272a]'
          }`}
        >
          {d}
        </button>
      );
    }

    // Next month fill to complete 42 cells grid
    const totalCells = cells.length;
    const remaining = 42 - totalCells;
    for (let n = 1; n <= remaining; n++) {
      const cellDate = new Date(pYear, pMonth + 1, n);
      cells.push(
        <button
          key={`next-${n}`}
          type="button"
          onClick={() => {
            onDateChange(cellDate);
            setIsDatePickerOpen(false);
          }}
          className="h-7 w-full flex items-center justify-center text-[11px] text-[#52525b] hover:bg-[#27272a] rounded transition-colors cursor-pointer"
        >
          {n}
        </button>
      );
    }

    return cells;
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* MAIN TOOLBAR ROW */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 pb-2 border-b border-[#27272a] h-10 relative">
      {/* MOBILE / TABLET FULL-WIDTH SEARCH BAR (Spans the entire toolbar on < md) */}
      {isMobileSearchOpen && (
        <div className="md:hidden flex items-center gap-2 w-full h-8 animate-in fade-in duration-150">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search timeline, tasks, milestones..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-8 pl-8.5 pr-8 rounded-xl bg-[#18181b] border border-orange-500/50 text-xs text-[#f4f4f5] placeholder-[#71717a] focus:outline-none shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white cursor-pointer p-0.5 rounded-full hover:bg-[#27272a] transition-colors"
                title="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleCloseMobileSearch}
            className="h-8 px-2.5 rounded-xl text-xs font-semibold text-orange-400 hover:text-orange-300 hover:bg-[#27272a] transition-colors cursor-pointer shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* LEFT SECTION: Project Selector, Team Selector & Search (Hidden on < md when search is open) */}
      <div className={`items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 min-w-0 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
        {/* Project Selector Dropdown */}
        <div className="relative shrink-0" ref={projectFilterRef}>
          <button
            type="button"
            onClick={() => {
              setIsProjectFilterOpen(!isProjectFilterOpen);
              setIsPersonFilterOpen(false);
            }}
            className="h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5] text-xs font-semibold shadow-xs hover:border-orange-500/40 transition-all cursor-pointer max-w-[120px] xs:max-w-[135px] sm:max-w-[160px] md:max-w-[190px]"
            title="Filter by Project"
          >
            {selectedProjectId === 'all' || !selectedProject ? (
              <>
                <Folder className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">All Projects</span>
              </>
            ) : (
              <>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedProject.color || '#f97316' }}
                />
                <span className="truncate">{selectedProject.title}</span>
              </>
            )}
            <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0 ml-auto" />
          </button>

          {isProjectFilterOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsProjectFilterOpen(false)}
              />
              <div className="absolute left-0 mt-1.5 w-56 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  onSelectProject('all');
                  setIsProjectFilterOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                  selectedProjectId === 'all'
                    ? 'bg-orange-500/15 text-orange-400 font-bold'
                    : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">All Projects</span>
              </button>

              <div className="h-px bg-[#27272a] my-0.5" />

              {activeProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectProject(p.id);
                    setIsProjectFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                    selectedProjectId === p.id
                      ? 'bg-orange-500/15 text-orange-400 font-bold'
                      : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || '#f97316' }}
                  />
                  <span className="truncate">{p.title}</span>
                </button>
              ))}
            </div>
            </>
          )}
        </div>

        {/* TEAM Filter Dropdown (Assignee & Reviewer) */}
        {persons && persons.length > 0 && onSelectPerson && (
          <div className="relative shrink-0" ref={personFilterRef}>
            <button
              type="button"
              onClick={() => {
                setIsPersonFilterOpen(!isPersonFilterOpen);
                setIsProjectFilterOpen(false);
              }}
              className="h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5] text-xs font-semibold shadow-xs hover:border-orange-500/40 transition-all cursor-pointer max-w-[115px] xs:max-w-[130px] sm:max-w-[155px] md:max-w-[180px]"
              title="Filter by Team Member (Assignee & Reviewer)"
            >
              {selectedPersonId === 'all' || !selectedPerson ? (
                <>
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">All Team</span>
                </>
              ) : (
                <>
                  {selectedPerson.avatar ? (
                    <img
                      src={selectedPerson.avatar}
                      alt={selectedPerson.name}
                      className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                    />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white uppercase shrink-0">
                      {selectedPerson.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate">{selectedPerson.name}</span>
                </>
              )}
              <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0 ml-auto" />
            </button>

            {isPersonFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsPersonFilterOpen(false)}
                />
                <div className="absolute left-0 mt-1.5 w-60 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    onSelectPerson('all');
                    setIsPersonFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                    selectedPersonId === 'all'
                      ? 'bg-orange-500/15 text-orange-400 font-bold'
                      : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">All Team Members</span>
                </button>

                <div className="h-px bg-[#27272a] my-0.5" />

                {persons.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onSelectPerson(u.id);
                      setIsPersonFilterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      selectedPersonId === u.id
                        ? 'bg-orange-500/15 text-orange-400 font-bold'
                        : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
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
                ))}
              </div>
              </>
            )}
          </div>
        )}

        {/* Mobile / Tablet Search Trigger Button (shown on < md when search is collapsed) */}
        {!isMobileSearchOpen && (
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(true)}
            className="md:hidden h-8 w-8 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] hover:border-orange-500/40 flex items-center justify-center text-[#a1a1aa] hover:text-white transition-all cursor-pointer shrink-0"
            title="Search timeline items"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Desktop Search Input (Always visible on md+ screens) */}
        <div className="hidden md:flex relative items-center">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 pr-7 sm:pr-8 rounded-xl bg-[#18181b] border border-[#27272a] text-xs text-[#f4f4f5] placeholder-[#71717a] focus:outline-none focus:border-orange-500/50 w-28 sm:w-36 lg:w-44 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white cursor-pointer p-0.5 rounded-full hover:bg-[#27272a]"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: Date Nav, Title & Scale Switcher (Hidden on < md when search is open) */}
      <div className={`items-center gap-1.5 sm:gap-2.5 flex-nowrap shrink-0 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
        {/* Today Button (Hidden on mobile & tablet portrait, visible on lg+) */}
        <button
          type="button"
          onClick={onToday}
          className="hidden lg:inline-flex items-center h-8 px-3 rounded-xl border border-[#27272a] bg-[#18181b] hover:bg-[#27272a] text-[#f4f4f5] text-xs font-semibold shadow-xs hover:border-orange-500/40 transition-all cursor-pointer"
        >
          Today
        </button>

        {/* Date Title Header with Popover Trigger (Hidden on mobile & tablet portrait, visible on lg+) */}
        <div className="hidden lg:block relative" ref={datePickerRef}>
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="h-8 flex items-center gap-1.5 px-2 text-xs sm:text-sm font-bold text-[#f4f4f5] tracking-tight hover:text-orange-400 transition-colors cursor-pointer select-none group"
            title="Click to open Date Picker popup & jump to any date"
          >
            <span className="leading-none">{headerTitle}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#71717a] group-hover:text-orange-400 transition-transform duration-200 ${
                isDatePickerOpen ? 'rotate-180 text-orange-400' : ''
              }`}
            />
          </button>

          {/* Date Picker Popover */}
          {isDatePickerOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDatePickerOpen(false)}
              />
              <div className="absolute right-0 sm:right-auto sm:left-0 mt-1.5 w-64 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3">
              {/* Header: Month/Year navigation */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#f4f4f5]">
                  {MONTH_NAMES[pickerDate.getMonth()]} {pickerDate.getFullYear()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePickerPrevMonth}
                    className="p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePickerNextMonth}
                    className="p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono text-[#71717a]">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              {/* Grid of Days */}
              <div className="grid grid-cols-7 gap-1">{renderPickerGrid()}</div>

              {/* Footer Quick Jump */}
              <div className="pt-2 border-t border-[#27272a] flex items-center justify-between gap-2 text-xs">
                <input
                  type="date"
                  value={toInputDateString(currentDate)}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-').map(Number);
                      onDateChange(new Date(y, m - 1, d));
                      setIsDatePickerOpen(false);
                    }
                  }}
                  className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-[11px] text-[#f4f4f5] focus:outline-none focus:border-orange-500/50 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => {
                    onToday();
                    setIsDatePickerOpen(false);
                  }}
                  className="px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Today
                </button>
              </div>
            </div>
            </>
          )}
        </div>

        {/* Previous / Next Arrow Buttons */}
        <div className="h-8 flex items-center gap-0.5 bg-[#18181b] border border-[#27272a] rounded-xl p-0.5">
          <button
            type="button"
            onClick={onPrev}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[#27272a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* TimeScale Switcher Dropdown */}
        <div className="relative" ref={viewDropdownRef}>
          <button
            type="button"
            onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
            className="h-8 flex items-center gap-1.5 px-3 rounded-xl border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="capitalize">{timeScale}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {isViewDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsViewDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-44 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
              {timeScaleModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    onTimeScaleChange(mode.id);
                    setIsViewDropdownOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    timeScale === mode.id
                      ? 'bg-orange-500/15 text-orange-400 font-bold'
                      : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                  }`}
                >
                  <span>{mode.label}</span>
                  <span className="text-[10px] font-mono opacity-50">{mode.shortcut}</span>
                </button>
              ))}
            </div>
            </>
          )}
        </div>
      </div>
    </div>

      {/* MOBILE & TABLET PORTRAIT DATE INFO HEADER (Rendered below toolbar border line, hidden on lg+) */}
      <div className="lg:hidden flex items-center justify-between py-1 px-0.5 text-xs text-[#a1a1aa] animate-in fade-in duration-100">
        <div className="flex items-center gap-1.5 font-semibold text-[#f4f4f5] text-xs sm:text-sm">
          <CalendarIcon className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span>{headerTitle}</span>
        </div>

        {/* Quick jump to Today button for mobile & tablet */}
        <button
          type="button"
          onClick={onToday}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#18181b] border border-[#27272a] text-orange-400 hover:text-orange-300 hover:border-orange-500/40 hover:bg-[#27272a] transition-all cursor-pointer"
        >
          Today
        </button>
      </div>
    </div>
  );
};



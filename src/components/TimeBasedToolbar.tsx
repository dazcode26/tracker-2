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

  const isAnyMenuOpen = isProjectFilterOpen || isPersonFilterOpen || isDatePickerOpen || isViewDropdownOpen || isMobileSearchOpen;
  const { isSticky, isVisible } = useHeadroom({ forceVisible: isAnyMenuOpen });

  return (
    <div
      className={`sticky top-0 z-30 transition-opacity duration-200 ease-out ${
        isSticky
          ? `py-2.5 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 bg-[#101010]/95 dark:bg-[#101010]/95 [data-theme=light]:bg-[#f8fafc]/95 backdrop-blur-md border-b border-[#27272a] [data-theme=light]:border-[#e2e8f0] shadow-lg shadow-black/25 ${
              isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`
          : 'opacity-100 py-0'
      }`}
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col gap-1.5">
          {/* MAIN TOOLBAR ROW */}
          <div className={`flex items-center justify-between gap-2 sm:gap-3 ${isSticky ? 'h-8 sm:h-9' : 'pb-2 border-b border-[#27272a] h-10'} relative`}>
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
        {/* Project Selector Multi-select Dropdown with Checkboxes */}
        <div className="relative shrink-0" ref={projectFilterRef}>
          <button
            type="button"
            onClick={() => {
              setIsProjectFilterOpen(!isProjectFilterOpen);
              setIsPersonFilterOpen(false);
              setIsViewDropdownOpen(false);
              setIsDatePickerOpen(false);
            }}
            className="h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5] text-xs font-semibold shadow-xs hover:border-orange-500/40 transition-all cursor-pointer max-w-[130px] xs:max-w-[150px] sm:max-w-[180px] md:max-w-[210px]"
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

          {isProjectFilterOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsProjectFilterOpen(false)}
              />
              <div className="absolute left-0 mt-1.5 w-64 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
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
              </div>
            </>
          )}
        </div>

        {/* TEAM Filter Multi-select Dropdown with Checkboxes */}
        {persons && persons.length > 0 && onSelectPerson && (
          <div className="relative shrink-0" ref={personFilterRef}>
            <button
              type="button"
              onClick={() => {
                setIsPersonFilterOpen(!isPersonFilterOpen);
                setIsProjectFilterOpen(false);
                setIsViewDropdownOpen(false);
                setIsDatePickerOpen(false);
              }}
              className="h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5] text-xs font-semibold shadow-xs hover:border-orange-500/40 transition-all cursor-pointer max-w-[125px] xs:max-w-[145px] sm:max-w-[175px] md:max-w-[200px]"
              title="Filter by Team Member (Assignee & Reviewer)"
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
                    const u = persons.find((p) => p.id === selectedPersonIds[0]);
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
                            {u?.name ? u.name.charAt(0).toUpperCase() : 'U'}
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

            {isPersonFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsPersonFilterOpen(false)}
                />
                <div className="absolute left-0 mt-1.5 w-64 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between px-1.5 py-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#71717a]">
                      Filter Team
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

                  {/* Master All Team Checkbox */}
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
  </div>
</div>
);
};



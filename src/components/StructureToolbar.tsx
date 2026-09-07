import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  Search,
  X,
  ChevronDown,
  Plus,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Person, ProjectNode } from '../types';
import { TreeSortBy, TreeSortDirection, TREE_SORT_OPTIONS } from '../utils/treeSorting';
import { useHeadroom } from '../hooks/useHeadroom';

export interface StructureToolbarProps {
  // Project Filter
  projects: ProjectNode[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;

  // Team Member Filter (Assignee & Reviewer)
  persons?: Person[];
  selectedPersonId?: string;
  onSelectPerson?: (personId: string) => void;

  // Sorting Controls
  sortBy?: TreeSortBy;
  onSortByChange?: (sortBy: TreeSortBy) => void;
  sortDirection?: TreeSortDirection;
  onToggleSortDirection?: () => void;

  // Search Input
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Action Button
  onOpenProjectModal: () => void;
}

export const StructureToolbar: React.FC<StructureToolbarProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  persons = [],
  selectedPersonId = 'all',
  onSelectPerson,
  sortBy = 'default',
  onSortByChange,
  sortDirection = 'asc',
  onToggleSortDirection,
  searchQuery,
  onSearchChange,
  onOpenProjectModal,
}) => {
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);
  const [isPersonFilterOpen, setIsPersonFilterOpen] = useState(false);
  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const projectFilterRef = useRef<HTMLDivElement>(null);
  const personFilterRef = useRef<HTMLDivElement>(null);
  const sortFilterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when mobile search is opened
  useEffect(() => {
    if (isMobileSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

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
        sortFilterRef.current &&
        !sortFilterRef.current.contains(target)
      ) {
        setIsSortFilterOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProjectFilterOpen(false);
        setIsPersonFilterOpen(false);
        setIsSortFilterOpen(false);
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
  const activeSortOption = TREE_SORT_OPTIONS.find((opt) => opt.id === sortBy) || TREE_SORT_OPTIONS[0];
  const isNonDefaultSort = sortBy !== 'default';

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

  const isAnyMenuOpen = isProjectFilterOpen || isPersonFilterOpen || isSortFilterOpen || isMobileSearchOpen;
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
        <div className={`flex items-center justify-between gap-2 sm:gap-3 ${isSticky ? 'h-8 sm:h-9' : 'pb-2 border-b border-[#27272a] h-10'} relative`}>
          {/* MOBILE / TABLET FULL-WIDTH SEARCH BAR (Spans the entire toolbar on < md, covering filters on left & Add Project on right) */}
      {isMobileSearchOpen && (
        <div className="md:hidden flex items-center gap-2 w-full h-full animate-in fade-in duration-150">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search projects, tasks, milestones..."
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

      {/* NORMAL TOOLBAR CONTENT (Hidden on < md when search is open, always visible on md+) */}
      <div className={`items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 min-w-0 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
        {/* Project Selector Multi-select Dropdown with Checkboxes */}
        <div className="relative shrink-0" ref={projectFilterRef}>
          <button
            type="button"
            onClick={() => {
              setIsProjectFilterOpen(!isProjectFilterOpen);
              setIsPersonFilterOpen(false);
              setIsSortFilterOpen(false);
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
                setIsSortFilterOpen(false);
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

        {/* SORT Dropdown & Direction Toggle */}
        {onSortByChange && (
          <div className="relative shrink-0 flex items-center gap-1" ref={sortFilterRef}>
            <button
              type="button"
              onClick={() => {
                setIsSortFilterOpen(!isSortFilterOpen);
                setIsProjectFilterOpen(false);
                setIsPersonFilterOpen(false);
              }}
              className={`h-8 flex items-center gap-1.5 px-2.5 rounded-xl border text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                isNonDefaultSort
                  ? 'bg-orange-500/15 border-orange-500/50 text-orange-400 font-bold hover:bg-orange-500/25'
                  : 'bg-[#18181b] border-[#27272a] text-[#f4f4f5] hover:bg-[#27272a] hover:border-orange-500/40'
              }`}
              title="Sort Tasks"
            >
              <ArrowUpDown className={`w-3.5 h-3.5 shrink-0 ${isNonDefaultSort ? 'text-orange-400' : 'text-[#a1a1aa]'}`} />
              <span className="font-semibold tracking-wide">
                {activeSortOption.shortLabel}
              </span>
              <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0" />
            </button>

            {/* Ascending / Descending Direction Toggle Button */}
            {isNonDefaultSort && onToggleSortDirection && (
              <button
                type="button"
                onClick={onToggleSortDirection}
                className="h-8 w-8 rounded-xl bg-orange-500/15 border border-orange-500/40 hover:bg-orange-500/25 flex items-center justify-center text-orange-400 hover:text-orange-300 transition-all cursor-pointer shrink-0"
                title={`Order: ${
                  sortDirection === 'asc'
                    ? 'Ascending (A–Z / Low to High)'
                    : 'Descending (Z–A / High to Low)'
                } - Click to reverse`}
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {isSortFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSortFilterOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 flex items-center justify-between border-b border-[#27272a]">
                  <span className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">
                    Sort Tasks (Hierarchical)
                  </span>
                  {isNonDefaultSort && (
                    <button
                      type="button"
                      onClick={() => {
                        onSortByChange('default');
                        setIsSortFilterOpen(false);
                      }}
                      className="text-[10px] text-orange-400 hover:text-orange-300 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  {TREE_SORT_OPTIONS.map((opt) => {
                    const isSelected = sortBy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onSortByChange(opt.id);
                          setIsSortFilterOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-orange-500/15 text-orange-400 font-bold'
                            : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              isSelected
                                ? 'bg-orange-500/25 text-orange-300'
                                : 'bg-[#27272a] text-[#a1a1aa]'
                            }`}
                          >
                            {opt.shortLabel}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{opt.label}</div>
                            <div className="text-[10px] text-[#71717a] font-normal truncate">
                              {opt.description}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Direction segmented control inside dropdown */}
                {isNonDefaultSort && onToggleSortDirection && (
                  <div className="pt-1.5 border-t border-[#27272a] mt-0.5">
                    <div className="text-[10px] text-[#71717a] font-medium px-2 pb-1">
                      Sort Direction:
                    </div>
                    <div className="grid grid-cols-2 gap-1 bg-[#121215] p-1 rounded-lg border border-[#27272a]">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortDirection !== 'asc') onToggleSortDirection();
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          sortDirection === 'asc'
                            ? 'bg-orange-500 text-white shadow-xs font-bold'
                            : 'text-[#a1a1aa] hover:text-white'
                        }`}
                      >
                        <ArrowUp className="w-3 h-3" /> Ascending
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (sortDirection !== 'desc') onToggleSortDirection();
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          sortDirection === 'desc'
                            ? 'bg-orange-500 text-white shadow-xs font-bold'
                            : 'text-[#a1a1aa] hover:text-white'
                        }`}
                      >
                        <ArrowDown className="w-3 h-3" /> Descending
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        )}

        {/* Search Trigger Button (shown on < md when search is collapsed) */}
        {!isMobileSearchOpen && (
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(true)}
            className="md:hidden h-8 w-8 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] hover:border-orange-500/40 flex items-center justify-center text-[#a1a1aa] hover:text-white transition-all cursor-pointer shrink-0"
            title="Search items"
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

      {/* RIGHT SECTION: Action Button (+ Project on mobile, + New Project on desktop) */}
      <div className={`shrink-0 ${isMobileSearchOpen ? 'hidden md:block' : 'block'}`}>
        <button
          type="button"
          onClick={() => onOpenProjectModal()}
          className="h-8 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold px-3 sm:px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 hover:shadow-orange-500/30 cursor-pointer shrink-0 whitespace-nowrap"
          title="Create New Project"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          <span>
            <span className="hidden sm:inline">New </span>
            Project
          </span>
        </button>
      </div>
    </div>
  </div>
</div>
);
};


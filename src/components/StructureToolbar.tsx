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
import { Person, ProjectNode, AppData, ItemNode } from '../types';
import { TreeSortBy, TreeSortDirection, TREE_SORT_OPTIONS } from '../utils/treeSorting';
import { PortalMenu } from './PortalMenu';
import { ToolbarActiveTimer } from './ToolbarActiveTimer';

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

  // Active Timer status for sticky positioning & toolbar widget
  hasActiveTimer?: boolean;
  appData?: AppData;
  onStopTimer?: () => void;
  onOpenEditItemModal?: (item: ItemNode) => void;
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
  hasActiveTimer = false,
  appData,
  onStopTimer,
  onOpenEditItemModal,
}) => {
  const [projectAnchor, setProjectAnchor] = useState<{ rect: DOMRect; el: HTMLElement } | null>(null);
  const [personAnchor, setPersonAnchor] = useState<{ rect: DOMRect; el: HTMLElement } | null>(null);
  const [sortAnchor, setSortAnchor] = useState<{ rect: DOMRect; el: HTMLElement } | null>(null);

  const isProjectFilterOpen = Boolean(projectAnchor);
  const isPersonFilterOpen = Boolean(personAnchor);
  const isSortFilterOpen = Boolean(sortAnchor);

  const handleToggleProjectDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isProjectFilterOpen) {
      setProjectAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setProjectAnchor({ rect, el: e.currentTarget });
      setPersonAnchor(null);
      setSortAnchor(null);
    }
  };

  const handleTogglePersonDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isPersonFilterOpen) {
      setPersonAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setPersonAnchor({ rect, el: e.currentTarget });
      setProjectAnchor(null);
      setSortAnchor(null);
    }
  };

  const handleToggleSortDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isSortFilterOpen) {
      setSortAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setSortAnchor({ rect, el: e.currentTarget });
      setProjectAnchor(null);
      setPersonAnchor(null);
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

  const hasActiveFilters =
    !isAllProjectsSelected ||
    (persons.length > 0 && !isAllPersonsSelected) ||
    isNonDefaultSort ||
    Boolean(searchQuery.trim());

  const handleResetAllFilters = () => {
    onSelectProject('all');
    if (onSelectPerson) onSelectPerson('all');
    if (onSortByChange) onSortByChange('default');
    if (searchQuery) onSearchChange('');
  };

  return (
    <div
      className={`sticky ${
        hasActiveTimer ? 'max-lg:top-9 top-0' : 'top-0'
      } z-30 py-2 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 bg-[#101010] [data-theme=light]:bg-[#f8fafc] transition-[top] duration-200`}
    >
      <div className="w-full">
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2 gap-x-2 md:gap-3 py-1 md:py-0 md:h-9 relative w-full">
          {/* ACTIONS: ROW 1 ON MOBILE (order-1 w-full), RIGHT SIDE ON DESKTOP (order-2 md:w-auto md:ml-auto) */}
          <div className="order-1 w-full md:w-auto md:order-2 flex items-center gap-2 md:ml-auto shrink-0">
            {/* Active Timer Widget: Displayed in toolbar on lg+ screens */}
            {hasActiveTimer && appData && (
              <div className="hidden lg:flex items-center shrink-0">
                <ToolbarActiveTimer
                  appData={appData}
                  onStopTimer={onStopTimer}
                  onOpenItemModal={onOpenEditItemModal}
                />
              </div>
            )}

            {/* Search Input: Expands full remaining width on mobile, compact fixed width on desktop */}
            <div className="relative flex-1 md:flex-none min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717a] [data-theme=light]:text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full md:w-36 lg:w-44 h-8 pl-8 pr-7 rounded-lg bg-[#18181b] [data-theme=light]:bg-white border border-[#27272a] [data-theme=light]:border-[#e2e8f0] text-xs text-[#f4f4f5] [data-theme=light]:text-[#0f172a] placeholder-[#71717a] [data-theme=light]:placeholder-slate-400 focus:outline-none focus:border-orange-500/50 transition-all"
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

            {/* Primary Action Button: + New Project */}
            <button
              type="button"
              onClick={() => onOpenProjectModal()}
              className="h-8 text-white text-xs font-bold px-2.5 sm:px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap active:scale-95 hover:opacity-95"
              style={{
                backgroundColor: 'var(--accent-main, #f97316)',
              }}
              title="Create New Project"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>
                <span className="hidden sm:inline">New </span>Project
              </span>
            </button>
          </div>

          {/* FILTERS & SORTING: ROW 2 ON MOBILE (order-2 w-full), LEFT SIDE ON DESKTOP (order-1 md:w-auto md:flex-1) */}
          <div
            className="order-2 w-full md:w-auto md:order-1 md:flex-1 md:min-w-0 flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto scrollbar-none py-0.5"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Project Selector Multi-select Dropdown with Checkboxes */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={handleToggleProjectDropdown}
                className={`h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 max-w-[160px] xs:max-w-[190px] sm:max-w-[210px] md:max-w-[220px] ${
                  isProjectFilterOpen
                    ? 'bg-white/10 [data-theme=light]:bg-slate-200/70 text-orange-400'
                    : !isAllProjectsSelected
                    ? 'bg-transparent text-orange-400 hover:bg-orange-500/10'
                    : 'bg-transparent hover:bg-white/5 [data-theme=light]:hover:bg-slate-200/60 text-[#f4f4f5] [data-theme=light]:text-slate-800 hover:text-orange-400'
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

            {/* TEAM Filter Multi-select Dropdown with Checkboxes */}
            {persons && persons.length > 0 && onSelectPerson && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={handleTogglePersonDropdown}
                  className={`h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 max-w-[140px] xs:max-w-[170px] sm:max-w-[190px] md:max-w-[200px] ${
                    isPersonFilterOpen
                      ? 'bg-white/10 [data-theme=light]:bg-slate-200/70 text-orange-400'
                      : !isAllPersonsSelected
                      ? 'bg-transparent text-orange-400 hover:bg-orange-500/10'
                      : 'bg-transparent hover:bg-white/5 [data-theme=light]:hover:bg-slate-200/60 text-[#f4f4f5] [data-theme=light]:text-slate-800 hover:text-orange-400'
                  }`}
                  title="Filter by Team Member (Assignee & Reviewer)"
                >
                  {isAllPersonsSelected ? (
                    <>
                      <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate md:hidden">All</span>
                      <span className="truncate hidden md:inline">All Team</span>
                    </>
                  ) : isNonePersons || selectedPersonIds.length === 0 ? (
                    <>
                      <Users className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                      <span className="truncate md:hidden">0</span>
                      <span className="truncate hidden md:inline text-[#a1a1aa]">0 Members</span>
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
                            <span className="truncate md:hidden">{u?.name ? u.name.slice(0, 3) : 'Mem'}</span>
                            <span className="truncate hidden md:inline">{u?.name || '1 Member'}</span>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate md:hidden">{selectedPersonIds.length}</span>
                      <span className="truncate hidden md:inline">{selectedPersonIds.length} Members</span>
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
                </PortalMenu>
              </div>
            )}

            {/* Subtle Group Divider between Filters and Sort */}
            {onSortByChange && (
              <div className="h-4 w-px bg-[#27272a] hidden xs:block shrink-0 mx-0.5" />
            )}

            {/* UNIFIED SORT CONTROL */}
            {onSortByChange && (
              <div className="relative shrink-0">
                {isNonDefaultSort ? (
                  /* Active Sort: Segmented Unified Control */
                  <div
                    className={`inline-flex items-center h-8 rounded-lg transition-colors shrink-0 ${
                      isSortFilterOpen
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-transparent text-orange-400 hover:bg-orange-500/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={handleToggleSortDropdown}
                      className="h-full flex items-center gap-1.5 px-2 sm:px-2.5 text-xs font-bold transition-colors cursor-pointer hover:text-orange-300"
                      title="Change Sort Criteria"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
                      <span>{activeSortOption.shortLabel}</span>
                      <ChevronDown className="w-3 h-3 opacity-80 shrink-0" />
                    </button>
                    {onToggleSortDirection && (
                      <button
                        type="button"
                        onClick={onToggleSortDirection}
                        className="h-full px-1.5 sm:px-2 flex items-center justify-center transition-colors cursor-pointer hover:bg-orange-500/20 rounded-r-lg"
                        title={`Order: ${sortDirection === 'asc' ? 'Ascending' : 'Descending'} (Click to toggle)`}
                      >
                        {sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  /* Default Sort: Clean Borderless Neutral Button */
                  <button
                    type="button"
                    onClick={handleToggleSortDropdown}
                    className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      isSortFilterOpen
                        ? 'bg-white/10 [data-theme=light]:bg-slate-200/70 text-orange-400'
                        : 'bg-transparent hover:bg-white/5 [data-theme=light]:hover:bg-slate-200/60 text-[#f4f4f5] [data-theme=light]:text-slate-800 hover:text-orange-400'
                    }`}
                    title="Sort Tasks"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0" />
                    <span className="font-semibold tracking-wide">Sort</span>
                    <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0" />
                  </button>
                )}

                <PortalMenu
                  isOpen={isSortFilterOpen}
                  onClose={() => setSortAnchor(null)}
                  anchorRect={sortAnchor?.rect || null}
                  triggerElement={sortAnchor?.el || null}
                  align="left"
                  className="w-64 flex flex-col gap-1"
                >
                  <div className="px-2 py-1 flex items-center justify-between border-b border-[#27272a]">
                    <span className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider">
                      Sort Tasks
                    </span>
                    {isNonDefaultSort && (
                      <button
                        type="button"
                        onClick={() => {
                          onSortByChange('default');
                          setSortAnchor(null);
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
                            setSortAnchor(null);
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
                </PortalMenu>
              </div>
            )}

            {/* QUICK RESET BUTTON */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="h-8 px-2.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
                title="Reset all filters, search, and sorting"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


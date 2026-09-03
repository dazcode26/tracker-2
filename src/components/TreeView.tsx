import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Play,
  Square,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Check,
  Clock,
  AlertCircle,
  Folder,
  ArrowUp,
  ArrowDown,
  Copy,
  Archive,
  Target,
  Search,
  X,
  User,
  ShieldCheck,
} from 'lucide-react';
import { StructureToolbar } from './StructureToolbar';
import { AppData, ItemNode, ProjectNode, ItemStatus } from '../types';
import {
  getItemLoggedSeconds,
  formatDuration,
  formatTimerClock,
  formatDaysLeft,
  formatStartEndDateRange,
  getLeafFlatItems,
  getStatusConfig,
} from '../utils/treeUtils';

interface TreeViewProps {
  appData: AppData;
  selectedProjectId?: string | null;
  onSelectProjectFilter?: (projectId: string) => void;
  onSelectProject?: (projectId: string) => void;
  selectedPersonId?: string;
  onSelectPersonFilter?: (personId: string) => void;
  onStartTimer: (itemId: string) => void;
  onStopTimer: () => void;
  onUpdateItemStatus: (itemId: string, newStatus: ItemStatus) => void;
  onOpenAddItemModal: (parentItemId?: string, projectId?: string) => void;
  onOpenEditItemModal: (item: ItemNode) => void;
  onDeleteItem: (itemId: string) => void;
  onReorderItem?: (itemId: string, direction: 'up' | 'down') => void;
  onDuplicateItem?: (itemId: string) => void;
  onReorderProject?: (projectId: string, direction: 'up' | 'down') => void;
  onDuplicateProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onToggleExpand?: (itemId: string) => void;
  onOpenProjectModal: (project?: ProjectNode) => void;
  onArchiveProject: (projectId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  appData,
  selectedProjectId = 'all',
  onSelectProjectFilter,
  onSelectProject,
  selectedPersonId = 'all',
  onSelectPersonFilter,
  onStartTimer,
  onStopTimer,
  onUpdateItemStatus,
  onOpenAddItemModal,
  onOpenEditItemModal,
  onDeleteItem,
  onReorderItem,
  onDuplicateItem,
  onReorderProject,
  onDuplicateProject,
  onDeleteProject,
  onToggleExpand,
  onOpenProjectModal,
  onArchiveProject,
  searchQuery = '',
  onSearchChange,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeProjectMenuId, setActiveProjectMenuId] = useState<string | null>(null);

  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState<boolean>(false);
  const projectFilterRef = useRef<HTMLDivElement>(null);

  const currentProjectFilter = selectedProjectId || 'all';
  const currentSearchQuery = searchQuery || '';

  const handleFilterChange = (projId: string) => {
    if (onSelectProjectFilter) {
      onSelectProjectFilter(projId);
    } else if (onSelectProject) {
      onSelectProject(projId);
    }
    setIsProjectFilterOpen(false);
  };

  const handleSearchInputChange = (text: string) => {
    if (onSearchChange) {
      onSearchChange(text);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        projectFilterRef.current &&
        !projectFilterRef.current.contains(event.target as Node)
      ) {
        setIsProjectFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleExpand = (id: string) => {
    if (onToggleExpand) {
      onToggleExpand(id);
    }
  };

  const activeProjects = appData.projects.filter((p) => p.status === 'active');
  const activeTimer = appData.settings.activeTimer;

  const effectiveSearch = currentSearchQuery.trim().toLowerCase();

  const renderStatusBadge = (status: ItemStatus) => {
    const config = getStatusConfig(status);
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border ${config.badgeBorder} ${config.badgeBg} ${config.textColor} text-[10px] font-mono font-bold uppercase tracking-wider`}>
        {status === 'completed' ? (
          <Check className="w-3 h-3 text-[#10b981] shrink-0" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotBg}`} />
        )}
        <span>{config.label}</span>
      </span>
    );
  };

  // Helper to filter items if user typed a search query
  const matchesSearch = (item: ItemNode): boolean => {
    if (!effectiveSearch) return true;
    if (item.name.toLowerCase().includes(effectiveSearch)) return true;
    if (item.notes && item.notes.toLowerCase().includes(effectiveSearch)) return true;
    if (item.subItems) {
      return item.subItems.some((child) => matchesSearch(child));
    }
    return false;
  };

  // Helper to filter items if user selected a person
  const matchesPerson = (item: ItemNode): boolean => {
    if (!selectedPersonId || selectedPersonId === 'all') return true;
    if (item.assigneeId === selectedPersonId || item.reviewerId === selectedPersonId) return true;
    if (item.subItems) {
      return item.subItems.some((child) => matchesPerson(child));
    }
    return false;
  };

  // Filter projects by Project Filter dropdown, Person Filter, and Search
  const filteredProjects = activeProjects.filter((project) => {
    if (currentProjectFilter !== 'all' && project.id !== currentProjectFilter) {
      return false;
    }
    if (selectedPersonId && selectedPersonId !== 'all') {
      const hasMatchingPerson = (project.items || []).some((item) => matchesPerson(item));
      if (!hasMatchingPerson) return false;
    }
    if (!effectiveSearch) return true;
    if (project.title.toLowerCase().includes(effectiveSearch)) return true;
    if (project.description && project.description.toLowerCase().includes(effectiveSearch)) return true;
    return (project.items || []).some((item) => matchesSearch(item));
  });

  // Recursive Item Row Renderer
  const renderItemRow = (
    item: ItemNode,
    projectId: string,
    depth: number,
    isFirstChild: boolean,
    isLastChild: boolean,
    parentExpanded: boolean = true
  ) => {
    if (!parentExpanded) return null;
    if (searchQuery && !matchesSearch(item)) return null;
    if (selectedPersonId && selectedPersonId !== 'all' && !matchesPerson(item)) return null;

    const isExpanded = item.isExpanded !== false;
    const hasChildren = item.subItems && item.subItems.length > 0;
    const isTimerRunning = activeTimer?.itemId === item.id;

    // Calculate total logged seconds including subItems
    const totalLoggedSeconds = getItemLoggedSeconds(
      item,
      activeTimer?.itemId,
      activeTimer?.startedAt
    );

    const formattedTime = totalLoggedSeconds > 0 ? formatDuration(totalLoggedSeconds) : '-';

    return (
      <React.Fragment key={item.id}>
        <div
          className={`grid grid-cols-[1fr_44px] sm:grid-cols-[1fr_105px_44px] md:grid-cols-[1fr_105px_80px_44px_36px] lg:grid-cols-[1fr_105px_220px_80px_44px_36px] xl:grid-cols-[1fr_105px_240px_70px_80px_44px_36px] 2xl:grid-cols-[1fr_105px_260px_80px_80px_44px_36px] gap-2 px-3 sm:px-6 py-3 border-b border-[#27272a] hover:bg-[#27272a]/50 transition-colors items-center relative group text-xs ${
            isTimerRunning ? 'bg-orange-500/10 border-l-4 border-l-orange-500' : 'bg-[#18181b]'
          }`}
        >
          {/* Name & Indentation Tree Column */}
          <div className="flex items-center min-w-0 pr-2 relative">
            {/* Indent Spacing */}
            <div
              style={{ width: `${depth * 28}px` }}
              className="shrink-0 flex items-center relative h-full"
            >
              {/* Tree connecting lines */}
              {depth > 0 && (
                <div
                  className="tree-connector-line"
                  style={{ left: `${(depth - 1) * 28 + 12}px` }}
                />
              )}
              {depth > 0 && (
                <div
                  className="tree-connector-branch"
                  style={{ left: `${(depth - 1) * 28 + 12}px` }}
                />
              )}
            </div>

            {/* Expand / Collapse Toggle Button */}
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(item.id)}
                className="p-1 rounded text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors mr-1 shrink-0 z-10"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#f4f4f5]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#71717a]" />
                )}
              </button>
            ) : (
              <div className="w-7 shrink-0" />
            )}

            {/* Item Title */}
            <div
              onClick={() => onOpenEditItemModal(item)}
              className="flex flex-col min-w-0 truncate cursor-pointer group/title"
              title="Click to edit item details"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`truncate group-hover/title:text-white transition-colors text-sm font-normal ${
                    item.status === 'completed' ? 'text-[#71717a]' : 'text-[#f4f4f5]'
                  }`}
                >
                  {item.name}
                </span>
                {item.showInSummary && (
                  <span
                    className="inline-flex items-center justify-center p-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0"
                    title="Summary / Calendar Reporting Level"
                  >
                    <Target className="w-3 h-3" />
                  </span>
                )}
              </div>
              {item.notes && item.notes.trim().length > 0 && (
                <span
                  className="text-[11px] text-[#71717a] truncate"
                  title={item.notes}
                >
                  {item.notes.length > 30 ? `${item.notes.slice(0, 30)}...` : item.notes}
                </span>
              )}
            </div>
          </div>

          {/* Status Column (Visible on Landscape Mobile, Tablet & Desktop) */}
          <div className="hidden sm:flex items-center">
            <div className="relative">
              <button
                onClick={() =>
                  setActiveMenuId(activeMenuId === `status-${item.id}` ? null : `status-${item.id}`)
                }
                className="hover:opacity-80 transition-opacity"
              >
                {renderStatusBadge(item.status)}
              </button>

              {/* Status Picker Popover */}
              {activeMenuId === `status-${item.id}` && (
                <div
                  className={`absolute left-0 w-36 bg-[#18181b] border border-[#3f3f46] rounded-lg shadow-2xl z-50 p-1 ${
                    isLastChild ? 'bottom-full mb-1' : 'top-full mt-1'
                  }`}
                >
                  {(['not-started', 'in-progress', 'review', 'completed'] as ItemStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => {
                          onUpdateItemStatus(item.id, st);
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-2 py-1.5 text-[11px] rounded hover:bg-[#27272a] transition-colors flex items-center gap-2"
                      >
                        {renderStatusBadge(st)}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date Column (Start Date - End Date & Target Date) (Visible on lg+) */}
          {(() => {
            const dateRangeStr = formatStartEndDateRange(item);
            const dateInfo = formatDaysLeft(item.targetDate);
            const isCompleted = item.status === 'completed';
            return (
              <div
                onClick={() => onOpenEditItemModal(item)}
                className="hidden lg:flex font-mono text-[11px] cursor-pointer transition-colors flex-col justify-center min-w-0 hover:opacity-90 pr-2"
                title={`Realization Range: ${dateRangeStr || 'None'}${!isCompleted && item.targetDate ? `\nTarget: ${dateInfo.fullDate}` : ''}\nClick to edit details`}
              >
                {dateRangeStr ? (
                  <span className="text-[#f4f4f5] font-medium whitespace-nowrap">
                    {dateRangeStr}
                  </span>
                ) : (
                  <span className="text-[#52525b] text-[10px] italic">
                    -
                  </span>
                )}
                {!isCompleted && item.targetDate && (
                  <span
                    className={`whitespace-nowrap ${
                      dateInfo.isOverdue
                        ? 'text-[#ef4444] font-semibold'
                        : dateInfo.text === 'Today'
                        ? 'text-[#f59e0b] font-semibold'
                        : 'text-[#aeaeb8]'
                    }`}
                    style={{ fontSize: '11px' }}
                  >
                    {dateInfo.text}
                  </span>
                )}
              </div>
            );
          })()}

          {/* People Column (Assignee & Reviewer Avatar) (Hidden on tablet horizontal lg, visible on xl+) */}
          {(() => {
            const personsList = appData.persons || [];
            const assignee = personsList.find((u) => u.id === item.assigneeId || u.name.toLowerCase() === item.assigneeId?.toLowerCase());
            const reviewer = personsList.find((u) => u.id === item.reviewerId || u.name.toLowerCase() === item.reviewerId?.toLowerCase());
            return (
              <div
                onClick={() => onOpenEditItemModal(item)}
                className="hidden xl:flex items-center -space-x-1.5 cursor-pointer overflow-visible"
                title={`Assignee: ${assignee?.name || (item.assigneeId || 'Unassigned')}${reviewer ? `\nReviewer: ${reviewer.name}` : ''}\nClick to edit`}
              >
                {assignee ? (
                  <div className="relative group/avatar shrink-0">
                    {assignee.avatar ? (
                      <img
                        src={assignee.avatar}
                        alt={assignee.name}
                        className="w-7 h-7 rounded-full border-2 border-[#121215] object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-[#121215] flex items-center justify-center text-[10px] font-bold text-white uppercase ring-1 ring-white/10">
                        {assignee.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ) : item.assigneeId ? (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-[#121215] flex items-center justify-center text-[10px] font-bold text-white uppercase ring-1 ring-white/10 shrink-0">
                    {item.assigneeId.charAt(0).toUpperCase()}
                  </div>
                ) : !reviewer ? (
                  <span className="text-[#52525b] text-xs italic pl-1">-</span>
                ) : null}

                {reviewer && (
                  <div className="relative group/avatar shrink-0" title={`Reviewer: ${reviewer.name}`}>
                    {reviewer.avatar ? (
                      <img
                        src={reviewer.avatar}
                        alt={reviewer.name}
                        className="w-7 h-7 rounded-full border-2 border-[#121215] object-cover ring-2 ring-amber-400/80 shadow-sm"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border-2 border-[#121215] flex items-center justify-center text-[10px] font-bold text-white uppercase ring-2 ring-amber-400/80">
                        {reviewer.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-[#121215]" />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Timer Total Column */}
          <div className="hidden md:block font-mono text-[11px] text-right pr-2 font-medium">
            <span
              className={
                isTimerRunning ? 'text-orange-400 font-bold animate-pulse' : 'text-[#f4f4f5]'
              }
            >
              {formattedTime}
            </span>
          </div>

          {/* Action Column (Timer Start/Stop) */}
          <div className="flex justify-center">
            {isTimerRunning ? (
              <button
                onClick={onStopTimer}
                className="w-7 h-7 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center justify-center shadow-md shadow-orange-500/30 animate-bounce"
                title="Stop Timer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => onStartTimer(item.id)}
                className="w-7 h-7 rounded-full bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors flex items-center justify-center border border-orange-500/30"
                title="Start Timer for this item"
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </button>
            )}
          </div>

          {/* More Options Column */}
          <div className="hidden md:flex items-center justify-center gap-1 relative">
            <button
              onClick={() =>
                setActiveMenuId(activeMenuId === `more-${item.id}` ? null : `more-${item.id}`)
              }
              className="w-7 h-7 rounded-full hover:bg-[#27272a] transition-colors flex items-center justify-center text-[#71717a] hover:text-[#f4f4f5]"
              title="Task Options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Context Menu Dropdown */}
            {activeMenuId === `more-${item.id}` && (
              <div
                className={`absolute right-0 w-48 bg-[#18181b] border border-[#3f3f46] rounded-xl shadow-2xl z-50 p-1.5 text-xs ${
                  isLastChild ? 'bottom-8' : 'top-8'
                }`}
              >
                <button
                  onClick={() => {
                    onOpenAddItemModal(item.id, projectId);
                    setActiveMenuId(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-[#f4f4f5]" /> Add Sub-task
                </button>
                <button
                  onClick={() => {
                    onOpenEditItemModal(item);
                    setActiveMenuId(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#a1a1aa]" /> Edit Details
                </button>
                {onDuplicateItem && (
                  <button
                    onClick={() => {
                      onDuplicateItem(item.id);
                      setActiveMenuId(null);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2"
                    title="Duplicate task"
                  >
                    <Copy className="w-3.5 h-3.5 text-orange-400" /> Duplicate Task
                  </button>
                )}
                {onReorderItem && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onReorderItem(item.id, 'up');
                        setActiveMenuId(null);
                      }}
                      disabled={isFirstChild}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                        isFirstChild
                          ? 'text-[#52525b] cursor-not-allowed opacity-50'
                          : 'hover:bg-[#27272a] text-[#f4f4f5] cursor-pointer'
                      }`}
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Move Up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onReorderItem(item.id, 'down');
                        setActiveMenuId(null);
                      }}
                      disabled={isLastChild}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                        isLastChild
                          ? 'text-[#52525b] cursor-not-allowed opacity-50'
                          : 'hover:bg-[#27272a] text-[#f4f4f5] cursor-pointer'
                      }`}
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Move Down</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    onDeleteItem(item.id);
                    setActiveMenuId(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#ef4444]/20 text-[#ef4444] flex items-center gap-2 border-t border-[#27272a] mt-1 pt-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Item
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Render Child SubItems recursively */}
        {hasChildren &&
          isExpanded &&
          item.subItems.map((child, idx) =>
            renderItemRow(
              child,
              projectId,
              depth + 1,
              idx === 0,
              idx === item.subItems.length - 1,
              isExpanded
            )
          )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6 pb-16 max-w-[1400px] mx-auto">
      {/* Structural Toolbar */}
      <StructureToolbar
        projects={appData.projects}
        selectedProjectId={currentProjectFilter}
        onSelectProject={handleFilterChange}
        persons={appData.persons}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPersonFilter}
        searchQuery={currentSearchQuery}
        onSearchChange={handleSearchInputChange}
        onOpenProjectModal={onOpenProjectModal}
      />

      {activeProjects.length === 0 ? (
        <div className="bg-[#121215] rounded-xl border border-[#27272a] p-12 text-center text-[#71717a] space-y-4 shadow-2xl">
          <Folder className="w-12 h-12 mx-auto text-[#3f3f46]" />
          <h3 className="text-base font-bold text-[#f4f4f5]">No Active Projects Yet</h3>
          <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto">
            There are no active projects right now. Create a new project to start organizing your tasks.
          </p>
          <button
            onClick={() => onOpenProjectModal()}
            className="bg-[#f4f4f5] text-[#09090b] text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-[#e4e4e7] transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create New Project
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-[#121215] rounded-xl border border-[#27272a] p-12 text-center text-[#71717a] space-y-4 shadow-2xl">
          <Search className="w-10 h-10 mx-auto text-[#3f3f46]" />
          <h3 className="text-base font-bold text-[#f4f4f5]">No Tasks or Projects Found</h3>
          <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto">
            No projects or tasks match your current search & filter criteria.
          </p>
          <button
            type="button"
            onClick={() => {
              handleSearchInputChange('');
              handleFilterChange('all');
            }}
            className="bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] text-xs font-medium px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Clear Filters
          </button>
        </div>
      ) : (
        filteredProjects.map((project, pIdx) => {
          const isFirstProject = pIdx === 0;
          const isLastProject = pIdx === filteredProjects.length - 1;
          const projectItems = project.items || [];
          const leafTasks = getLeafFlatItems([project]);
          const pendingCount = leafTasks.filter((f) => f.item.status !== 'completed').length;
          const pendingTasksLabel =
            leafTasks.length === 0
              ? '0 tasks'
              : pendingCount === 1
              ? '1 task not yet completed'
              : `${pendingCount} tasks not yet completed`;

          return (
            <div key={project.id} className="space-y-3">
              {/* Project Header (Unboxed, styled like Kanban header) */}
              <div className="flex items-center justify-between gap-3 pt-1 pb-1">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  {/* Project Settings & More Menu replacing the color bullet */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveProjectMenuId(activeProjectMenuId === project.id ? null : project.id)
                      }
                      style={{ backgroundColor: project.color || '#f97316' }}
                      className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-lg flex items-center justify-center text-white shadow-sm hover:brightness-110 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ring-1 ring-white/20"
                      title="Project Settings & Options"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 text-white drop-shadow-xs" />
                    </button>

                    {activeProjectMenuId === project.id && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setActiveProjectMenuId(null)}
                        />
                        <div className="absolute left-0 mt-1.5 w-48 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1.5 z-40 text-xs flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveProjectMenuId(null);
                              onOpenProjectModal(project);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-orange-400" />
                            <span>Edit Project</span>
                          </button>
                          {onDuplicateProject && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveProjectMenuId(null);
                                onDuplicateProject(project.id);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-blue-400" />
                              <span>Duplicate Project</span>
                            </button>
                          )}
                          {onReorderProject && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveProjectMenuId(null);
                                  onReorderProject(project.id, 'up');
                                }}
                                disabled={isFirstProject}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                                  isFirstProject
                                    ? 'text-[#52525b] cursor-not-allowed'
                                    : 'hover:bg-[#27272a] text-[#f4f4f5] cursor-pointer'
                                }`}
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Move Up</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveProjectMenuId(null);
                                  onReorderProject(project.id, 'down');
                                }}
                                disabled={isLastProject}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                                  isLastProject
                                    ? 'text-[#52525b] cursor-not-allowed'
                                    : 'hover:bg-[#27272a] text-[#f4f4f5] cursor-pointer'
                                }`}
                              >
                                <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Move Down</span>
                              </button>
                            </>
                          )}
                          <div className="h-px bg-[#27272a] my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveProjectMenuId(null);
                              onArchiveProject(project.id);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-[#f59e0b] flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Archive Project</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-[#f4f4f5] tracking-tight">
                        {project.title}
                      </h2>
                      <span className="hidden lg:inline-flex text-[10px] font-mono text-[#a1a1aa] bg-[#27272a] px-2 py-0.5 rounded-full font-normal border border-[#3f3f46]/50">
                        {pendingTasksLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Table Tree Container */}
              <div className="bg-[#121215] rounded-xl border border-[#27272a] shadow-2xl relative overflow-hidden">
                {/* Table Column Headers */}
                <div
                  className="grid grid-cols-[1fr_44px] sm:grid-cols-[1fr_105px_44px] md:grid-cols-[1fr_105px_80px_44px_36px] lg:grid-cols-[1fr_105px_220px_80px_44px_36px] xl:grid-cols-[1fr_105px_240px_70px_80px_44px_36px] 2xl:grid-cols-[1fr_105px_260px_80px_80px_44px_36px] gap-2 px-3 sm:px-6 py-3 border-b border-[#27272a] bg-[#141417] text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider items-center"
                >
                  <div className="pl-2">NAME</div>
                  <div className="hidden sm:block">STATUS</div>
                  <div className="hidden lg:block">DATE</div>
                  <div className="hidden xl:block">TEAM</div>
                  <div className="hidden md:block text-right pr-2">TIMER</div>
                  <div className="text-center">ACTION</div>
                  <div className="hidden md:block text-center">MORE</div>
                </div>

                {/* Tree Body */}
                <div className="flex flex-col divide-y-0">
                  {projectItems.length > 0 ? (
                    projectItems.map((item, idx) =>
                      renderItemRow(
                        item,
                        project.id,
                        0,
                        idx === 0,
                        idx === projectItems.length - 1
                      )
                    )
                  ) : (
                    <div className="p-8 text-center text-[#71717a] space-y-3 border-b border-[#27272a]">
                      <Folder className="w-8 h-8 mx-auto text-[#3f3f46]" />
                      <p className="text-xs">No tasks found in this project yet.</p>
                      <button
                        onClick={() => onOpenAddItemModal(undefined, project.id)}
                        className="bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-[#3f3f46] transition-colors inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 text-orange-400" /> Create First Task
                      </button>
                    </div>
                  )}
                </div>

                {/* Trello-Style Add Task Bottom Row */}
                <div className="p-1.5 bg-[#121215]">
                  <button
                    type="button"
                    onClick={() => onOpenAddItemModal(undefined, project.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b] rounded-lg transition-all cursor-pointer group text-left"
                  >
                    <Plus className="w-4 h-4 text-[#71717a] group-hover:text-orange-400 transition-colors shrink-0" />
                    <span>Add Task</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

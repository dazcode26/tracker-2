import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Circle,
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
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { StructureToolbar } from './StructureToolbar';
import { PortalMenu } from './PortalMenu';
import { AppData, ItemNode, ProjectNode, ItemStatus } from '../types';
import {
  getItemLoggedSeconds,
  formatDuration,
  formatTimerClock,
  formatDaysLeft,
  formatStartEndDateRange,
  getLeafFlatItems,
  getStatusConfig,
  updateItemInProjects,
} from '../utils/treeUtils';
import {
  TreeSortBy,
  TreeSortDirection,
  sortProjectItemsTree,
  TREE_SORT_OPTIONS,
} from '../utils/treeSorting';

const NOTION_EMOJIS = [
  '📄', '📁', '🚀', '🔥', '⚡', '🎯', '💡', '🛠️',
  '🎨', '💻', '📊', '✅', '📦', '⭐', '🏷️', '📌',
];

// Calculate item progress and roll-up for parent nodes
function calculateItemProgress(item: ItemNode): { total: number; completed: number; percentage: number; isLeaf: boolean } {
  if (!item.subItems || item.subItems.length === 0) {
    const isDone = item.status === 'completed';
    const pct = isDone ? 100 : item.status === 'in-progress' ? 50 : item.status === 'review' ? 80 : 0;
    return { total: 1, completed: isDone ? 1 : 0, percentage: pct, isLeaf: true };
  }

  let total = 0;
  let completed = 0;

  function traverse(node: ItemNode) {
    if (!node.subItems || node.subItems.length === 0) {
      total += 1;
      if (node.status === 'completed') completed += 1;
    } else {
      node.subItems.forEach(traverse);
    }
  }

  item.subItems.forEach(traverse);
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percentage, isLeaf: false };
}

// Recursively update status of all descendant sub-items
function recursivelyUpdateStatus(items: ItemNode[], targetStatus: ItemStatus): ItemNode[] {
  return items.map((child) => ({
    ...child,
    status: targetStatus,
    subItems: child.subItems ? recursivelyUpdateStatus(child.subItems, targetStatus) : [],
  }));
}

interface TreeViewProps {
  appData: AppData;
  onSaveData?: (newData: AppData) => void;
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
  onSetAllExpand?: (expand: boolean) => void;
  onOpenProjectModal: (project?: ProjectNode) => void;
  onArchiveProject: (projectId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  appData,
  onSaveData,
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
  onSetAllExpand,
  onOpenProjectModal,
  onArchiveProject,
  searchQuery = '',
  onSearchChange,
}) => {
  interface MenuAnchorState {
    id: string;
    rect: DOMRect;
    el: HTMLElement;
  }
  const [activeStatusAnchor, setActiveStatusAnchor] = useState<MenuAnchorState | null>(null);
  const [activeMoreAnchor, setActiveMoreAnchor] = useState<MenuAnchorState | null>(null);
  const [activeProjectMenuAnchor, setActiveProjectMenuAnchor] = useState<MenuAnchorState | null>(null);
  const [activeEmojiAnchor, setActiveEmojiAnchor] = useState<MenuAnchorState | null>(null);
  const [activeProjectEmojiAnchor, setActiveProjectEmojiAnchor] = useState<MenuAnchorState | null>(null);
  const [activeProgressAnchor, setActiveProgressAnchor] = useState<MenuAnchorState | null>(null);
  const [activeAssigneeAnchor, setActiveAssigneeAnchor] = useState<MenuAnchorState | null>(null);

  const handleSetItemEmoji = (itemId: string, emoji: string) => {
    if (onSaveData) {
      const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
        ...item,
        icon: emoji,
      }));
      onSaveData({ ...appData, projects: updatedProjects });
    }
    setActiveEmojiAnchor(null);
  };

  const handleSetProjectEmoji = (projectId: string, emoji: string) => {
    if (onSaveData) {
      const updatedProjects = appData.projects.map((p) =>
        p.id === projectId ? { ...p, icon: emoji } : p
      );
      onSaveData({ ...appData, projects: updatedProjects });
    }
    setActiveProjectEmojiAnchor(null);
  };

  const handleBulkUpdateStatus = (itemId: string, targetStatus: ItemStatus) => {
    if (onSaveData) {
      const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
        ...item,
        status: targetStatus,
        subItems: item.subItems ? recursivelyUpdateStatus(item.subItems, targetStatus) : [],
      }));
      onSaveData({ ...appData, projects: updatedProjects });
    }
    setActiveProgressAnchor(null);
  };

  const handleSetAssignee = (itemId: string, assigneeId: string) => {
    if (onSaveData) {
      const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
        ...item,
        assigneeId,
      }));
      onSaveData({ ...appData, projects: updatedProjects });
    }
    setActiveAssigneeAnchor(null);
  };

  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState<boolean>(false);
  const projectFilterRef = useRef<HTMLDivElement>(null);

  // TreeView Sorting State (Persisted in localStorage for convenience)
  const [sortBy, setSortBy] = useState<TreeSortBy>(() => {
    try {
      return (localStorage.getItem('tracker_tree_sort_by') as TreeSortBy) || 'default';
    } catch {
      return 'default';
    }
  });

  const [sortDirection, setSortDirection] = useState<TreeSortDirection>(() => {
    try {
      return (localStorage.getItem('tracker_tree_sort_direction') as TreeSortDirection) || 'asc';
    } catch {
      return 'asc';
    }
  });

  const handleSortByChange = (newSort: TreeSortBy) => {
    setSortBy(newSort);
    try {
      localStorage.setItem('tracker_tree_sort_by', newSort);
    } catch {}
  };

  const handleToggleSortDirection = () => {
    const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(nextDir);
    try {
      localStorage.setItem('tracker_tree_sort_direction', nextDir);
    } catch {}
  };

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

  // Close active dropdowns on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveStatusAnchor(null);
        setActiveMoreAnchor(null);
        setActiveProjectMenuAnchor(null);
        setActiveEmojiAnchor(null);
        setActiveProjectEmojiAnchor(null);
        setIsProjectFilterOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.badgeBorder} ${config.badgeBg} ${config.textColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotBg}`} />
        <span className="capitalize whitespace-nowrap">{config.label}</span>
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

  const isNoneProjects = currentProjectFilter === 'none';
  const isNonePersons = selectedPersonId === 'none';

  const selectedProjectIds = useMemo(() => {
    if (!currentProjectFilter || currentProjectFilter === 'all' || currentProjectFilter === 'none') return [];
    return currentProjectFilter.split(',').filter(Boolean);
  }, [currentProjectFilter]);

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

  // Filter projects by Project Filter dropdown, Person Filter, and Search
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
    if (!effectiveSearch) return true;
    if (project.title.toLowerCase().includes(effectiveSearch)) return true;
    if (project.description && project.description.toLowerCase().includes(effectiveSearch)) return true;
    return (project.items || []).some((item) => matchesSearch(item));
  });

  // Apply non-destructive recursive sorting on projects' item tree
  const displayProjects = useMemo(() => {
    if (sortBy === 'default') return filteredProjects;
    return sortProjectItemsTree(filteredProjects, sortBy, sortDirection);
  }, [filteredProjects, sortBy, sortDirection]);

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
    if (selectedPersonIds.length > 0 && !matchesPerson(item)) return null;

    const isExpanded = item.isExpanded !== false;
    const hasChildren = item.subItems && item.subItems.length > 0;
    const isTimerRunning = activeTimer?.itemId === item.id;
    const itemEmoji = item.icon || (hasChildren ? '📁' : '📄');

    // Calculate total logged seconds including subItems
    const totalLoggedSeconds = getItemLoggedSeconds(
      item,
      activeTimer?.itemId,
      activeTimer?.startedAt
    );

    const formattedTime = totalLoggedSeconds > 0 ? formatDuration(totalLoggedSeconds) : '-';

    const progress = calculateItemProgress(item);
    const assignee = (appData.persons || []).find((p) => p.id === item.assigneeId || p.name.toLowerCase() === item.assigneeId?.toLowerCase());
    const reviewer = (appData.persons || []).find((p) => p.id === item.reviewerId || p.name.toLowerCase() === item.reviewerId?.toLowerCase());
    const dateRangeStr = formatStartEndDateRange(item);
    const dateInfo = formatDaysLeft(item.targetDate);
    const isCompleted = item.status === 'completed';

    return (
      <React.Fragment key={item.id}>
        <div
          className={`group flex items-center border-b border-[#27272a] hover:bg-[#18181b]/70 transition-colors text-sm text-[#f4f4f5] select-none min-h-[40px] relative ${
            isTimerRunning ? 'bg-orange-500/10' : ''
          }`}
        >
          {/* Column 1: NAME (Tree Indent + Connectors + Chevron/Bullet + Emoji + Title + Hover Actions) */}
          <div
            className="flex-1 flex items-center min-w-[200px] xl:min-w-[260px] 2xl:min-w-[320px] py-2 pr-2 xl:pr-4 relative"
            style={{ paddingLeft: `${Math.max(4, depth * 22 + 6)}px` }}
          >
            {/* Guide Lines for nested items */}
            {depth > 0 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: `${(depth - 1) * 22 + 14}px` }}
              >
                <div className="w-[1px] h-full bg-[#27272a]" />
                <div className="absolute top-[19px] left-0 w-2.5 h-[1px] bg-[#27272a]" />
              </div>
            )}

            {/* Chevron / Bullet */}
            <div className="w-5 h-5 flex items-center justify-center shrink-0 mr-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="w-4 h-4 rounded flex items-center justify-center text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-all cursor-pointer"
                  title={isExpanded ? 'Collapse sub-tasks' : 'Expand sub-tasks'}
                >
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isExpanded ? 'rotate-90 text-[#f4f4f5]' : ''
                    }`}
                  />
                </button>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-[#3f3f46] inline-block" />
              )}
            </div>

            {/* Topic / Page Emoji Icon */}
            <div className="relative shrink-0 mr-2" data-popover-root>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveEmojiAnchor(
                    activeEmojiAnchor?.id === item.id
                      ? null
                      : { id: item.id, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }
                  );
                }}
                className="text-base hover:scale-110 transition-transform p-0.5 rounded cursor-pointer select-none"
                title="Change task icon"
              >
                {itemEmoji}
              </button>

              <PortalMenu
                isOpen={activeEmojiAnchor?.id === item.id}
                onClose={() => setActiveEmojiAnchor(null)}
                anchorRect={activeEmojiAnchor?.id === item.id ? activeEmojiAnchor.rect : null}
                triggerElement={activeEmojiAnchor?.id === item.id ? activeEmojiAnchor.el : null}
                align="left"
                className="w-44 p-2.5 grid grid-cols-4 gap-1.5"
              >
                {NOTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSetItemEmoji(item.id, emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#27272a] text-lg cursor-pointer transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </PortalMenu>
            </div>

            {/* Title & Notes */}
            <div
              onClick={() => onOpenEditItemModal(item)}
              className="flex flex-col min-w-0 truncate cursor-pointer group/title flex-1"
              title="Click to edit item details"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`truncate group-hover/title:text-white transition-colors text-sm font-normal ${
                    isCompleted ? 'line-through text-[#71717a]' : 'text-[#f4f4f5]'
                  }`}
                >
                  {item.name}
                </span>
                {item.showInSummary && (
                  <Target
                    className="w-2.5 h-2.5 text-amber-400/90 shrink-0 inline-block self-center"
                    size={10}
                    strokeWidth={2.5}
                    title="Summary / Calendar Reporting Target"
                  />
                )}
              </div>
              {item.notes && item.notes.trim().length > 0 && (
                <span className="text-[11px] text-[#71717a] truncate" title={item.notes}>
                  {item.notes.length > 40 ? `${item.notes.slice(0, 40)}...` : item.notes}
                </span>
              )}
            </div>

            {/* Quick action button on hover: + Sub-task */}
            <div className="hidden group-hover:flex items-center ml-2 shrink-0 animate-in fade-in">
              <button
                type="button"
                onClick={() => onOpenAddItemModal(item.id, projectId)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-[#a1a1aa] hover:text-[#f4f4f5] bg-transparent hover:bg-[#27272a] border border-transparent hover:border-[#3f3f46] rounded transition-all cursor-pointer"
                title="Add sub-task"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Sub-task</span>
              </button>
            </div>

            {/* Timer active badge indicator */}
            {isTimerRunning && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400 font-mono flex items-center gap-1 animate-pulse shrink-0 border border-orange-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Active
              </span>
            )}
          </div>

          {/* Column 2: STATUS */}
          <div className="w-28 xl:w-36 2xl:w-40 px-2 xl:px-3 shrink-0 relative" data-popover-root>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveStatusAnchor(
                  activeStatusAnchor?.id === item.id
                    ? null
                    : { id: item.id, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }
                );
              }}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            >
              {renderStatusBadge(item.status)}
            </button>

            <PortalMenu
              isOpen={activeStatusAnchor?.id === item.id}
              onClose={() => setActiveStatusAnchor(null)}
              anchorRect={activeStatusAnchor?.id === item.id ? activeStatusAnchor.rect : null}
              triggerElement={activeStatusAnchor?.id === item.id ? activeStatusAnchor.el : null}
              align="left"
              className="w-36 flex flex-col gap-0.5"
            >
              {(['not-started', 'in-progress', 'review', 'completed'] as ItemStatus[]).map((s) => {
                const cfg = getStatusConfig(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      onUpdateItemStatus(item.id, s);
                      setActiveStatusAnchor(null);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#27272a] text-[#f4f4f5] cursor-pointer text-left transition-colors ${
                      item.status === s ? 'font-semibold bg-[#27272a]' : ''
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dotBg}`} />
                    <span className={item.status === s ? cfg.textColor : 'text-[#f4f4f5]'}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </PortalMenu>
          </div>

          {/* Column 3: PROGRESS (Interactive Roll-up & Quick Actions) */}
          <div className="w-24 xl:w-[106px] 2xl:w-32 px-2 xl:px-3 shrink-0 relative" data-popover-root>
            <button
              type="button"
              onClick={(e) => {
                if (progress.isLeaf) {
                  onUpdateItemStatus(item.id, isCompleted ? 'not-started' : 'completed');
                } else {
                  e.stopPropagation();
                  setActiveProgressAnchor(
                    activeProgressAnchor?.id === item.id
                      ? null
                      : { id: item.id, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }
                  );
                }
              }}
              className="w-full flex items-center gap-2 hover:bg-[#27272a]/60 p-1 rounded-md transition-colors cursor-pointer group/prog"
              title={
                progress.isLeaf
                  ? `Click to toggle completion (${progress.percentage}%)`
                  : `Click to view breakdown (${progress.completed}/${progress.total} sub-tasks completed)`
              }
            >
              <div className="flex-1 bg-[#27272a] h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progress.percentage === 100
                      ? 'bg-emerald-500'
                      : progress.percentage > 0
                      ? 'bg-orange-500'
                      : 'bg-transparent'
                  }`}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-[#a1a1aa] group-hover/prog:text-[#f4f4f5] font-medium shrink-0">
                {progress.percentage}%
              </span>
            </button>

            {!progress.isLeaf && (
              <PortalMenu
                isOpen={activeProgressAnchor?.id === item.id}
                onClose={() => setActiveProgressAnchor(null)}
                anchorRect={activeProgressAnchor?.id === item.id ? activeProgressAnchor.rect : null}
                triggerElement={activeProgressAnchor?.id === item.id ? activeProgressAnchor.el : null}
                align="left"
                className="w-56 p-3 flex flex-col gap-2"
              >
                <div className="text-xs font-semibold text-[#f4f4f5] flex items-center justify-between">
                  <span>Sub-items Rollup</span>
                  <span className="font-mono text-emerald-400">{progress.percentage}%</span>
                </div>
                <p className="text-[11px] text-[#a1a1aa]">
                  {progress.completed} of {progress.total} subordinate work items completed.
                </p>

                <div className="flex-1 bg-[#27272a] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>

                <div className="border-t border-[#27272a] pt-2 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus(item.id, 'completed')}
                    className="text-left px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/15 rounded font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark all sub-tasks completed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus(item.id, 'not-started')}
                    className="text-left px-2 py-1 text-xs text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Circle className="w-3.5 h-3.5" />
                    <span>Reset all to not started</span>
                  </button>
                </div>
              </PortalMenu>
            )}
          </div>

          {/* Column 4: DATE */}
          <div
            onClick={() => onOpenEditItemModal(item)}
            className="w-[186px] min-w-[186px] xl:w-56 2xl:w-64 px-2 xl:px-4 shrink-0 font-mono text-[11px] cursor-pointer hover:bg-[#27272a]/50 rounded py-1 transition-colors flex flex-col justify-center min-w-0"
            title={`Realization: ${dateRangeStr || 'None'}\nTarget: ${dateInfo.fullDate}\nClick to edit details`}
          >
            {dateRangeStr ? (
              <span className="text-[#71717a] font-mono whitespace-nowrap truncate">{dateRangeStr}</span>
            ) : (
              <span className="text-[#71717a] italic text-[11px] font-mono">-</span>
            )}
            {!isCompleted && item.targetDate && (
              <span
                className={`truncate font-mono text-[10px] ${
                  dateInfo.isOverdue
                    ? 'text-red-400 font-semibold'
                    : dateInfo.text === 'Today'
                    ? 'text-amber-400 font-semibold'
                    : 'text-[#71717a]'
                }`}
              >
                {dateInfo.text}
              </span>
            )}
          </div>

          {/* Column 5: TEAM */}
          <div className="w-16 xl:w-24 2xl:w-28 px-2 xl:px-3 shrink-0 flex items-center relative" data-popover-root>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveAssigneeAnchor(
                  activeAssigneeAnchor?.id === item.id
                    ? null
                    : { id: item.id, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }
                );
              }}
              className="flex items-center -space-x-1.5 hover:opacity-85 p-0.5 rounded cursor-pointer transition-all"
              title={
                assignee
                  ? `Assignee: ${assignee.name}${reviewer ? `\nReviewer: ${reviewer.name}` : ''}\nClick to change`
                  : 'Unassigned (click to assign)'
              }
            >
              {assignee ? (
                <img
                  src={assignee.avatar}
                  alt={assignee.name}
                  className="w-6 h-6 rounded-full object-cover border border-[#27272a] ring-1 ring-white/10 shrink-0"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full bg-[#27272a] border border-[#3f3f46] flex items-center justify-center text-[#71717a] hover:text-[#f4f4f5] transition-colors shrink-0"
                  title="Click to assign"
                >
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
              {reviewer && (
                <img
                  src={reviewer.avatar}
                  alt={`Reviewer: ${reviewer.name}`}
                  className="w-5 h-5 rounded-full object-cover border border-amber-400 ring-1 ring-amber-400/50 shrink-0"
                  title={`Reviewer: ${reviewer.name}`}
                />
              )}
            </button>

            <PortalMenu
              isOpen={activeAssigneeAnchor?.id === item.id}
              onClose={() => setActiveAssigneeAnchor(null)}
              anchorRect={activeAssigneeAnchor?.id === item.id ? activeAssigneeAnchor.rect : null}
              triggerElement={activeAssigneeAnchor?.id === item.id ? activeAssigneeAnchor.el : null}
              align="left"
              className="w-48 flex flex-col gap-0.5"
            >
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#71717a]">
                Assign Team Member
              </div>
              {(appData.persons || []).map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    handleSetAssignee(item.id, person.id);
                    setActiveAssigneeAnchor(null);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#27272a] text-[#f4f4f5] cursor-pointer text-left transition-colors ${
                    item.assigneeId === person.id ? 'font-semibold bg-[#27272a]' : ''
                  }`}
                >
                  <img src={person.avatar} alt={person.name} className="w-5 h-5 rounded-full object-cover" />
                  <div className="flex-1 truncate">
                    <div className="truncate">{person.name}</div>
                    <div className="text-[10px] text-[#71717a] truncate">{person.role}</div>
                  </div>
                </button>
              ))}
            </PortalMenu>
          </div>

          {/* Column 6: TIMER */}
          <div className="w-[130px] xl:w-36 2xl:w-40 px-2 xl:px-3 shrink-0 flex items-center justify-end gap-2 xl:gap-3">
            <span
              className={`font-mono text-[11px] whitespace-nowrap shrink-0 ${
                isTimerRunning ? 'text-orange-400 font-bold animate-pulse' : 'text-[#71717a]'
              }`}
            >
              {formattedTime}
            </span>
            {isTimerRunning ? (
              <button
                type="button"
                onClick={onStopTimer}
                className="w-6 h-6 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center justify-center shadow-xs cursor-pointer shrink-0"
                title="Stop timer"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStartTimer(item.id)}
                className="w-6 h-6 rounded-full bg-[#27272a] text-[#a1a1aa] hover:text-orange-400 hover:bg-orange-500/20 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                title="Start timer for this task"
              >
                <Play className="w-3 h-3 fill-current ml-0.5" />
              </button>
            )}
          </div>

          {/* Column 7: MORE */}
          <div className="w-10 xl:w-14 2xl:w-16 px-1 xl:px-2 shrink-0 flex items-center justify-center relative" data-popover-root>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMoreAnchor(
                  activeMoreAnchor?.id === item.id
                    ? null
                    : { id: item.id, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }
                );
              }}
              className="w-7 h-7 rounded hover:bg-[#27272a] text-[#71717a] hover:text-[#f4f4f5] flex items-center justify-center cursor-pointer transition-colors"
              title="Task options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Context Menu Dropdown via Portal - Never clipped */}
            <PortalMenu
              isOpen={activeMoreAnchor?.id === item.id}
              onClose={() => setActiveMoreAnchor(null)}
              anchorRect={activeMoreAnchor?.id === item.id ? activeMoreAnchor.rect : null}
              triggerElement={activeMoreAnchor?.id === item.id ? activeMoreAnchor.el : null}
              align="right"
              className="w-48 flex flex-col gap-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  onOpenAddItemModal(item.id, projectId);
                  setActiveMoreAnchor(null);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#f4f4f5]" /> Add Sub-task
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenEditItemModal(item);
                  setActiveMoreAnchor(null);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#a1a1aa]" /> Edit Details
              </button>
              {onDuplicateItem && (
                <button
                  type="button"
                  onClick={() => {
                    onDuplicateItem(item.id);
                    setActiveMoreAnchor(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2 cursor-pointer"
                  title="Duplicate task"
                >
                  <Copy className="w-3.5 h-3.5 text-orange-400" /> Duplicate Task
                </button>
              )}
              {onReorderItem && (
                sortBy !== 'default' ? (
                  <div className="px-3 py-1.5 text-[10px] text-[#71717a] border-t border-[#27272a] my-0.5">
                    <span className="italic">
                      Manual reordering is disabled while sort is active ({TREE_SORT_OPTIONS.find((o) => o.id === sortBy)?.shortLabel}).
                    </span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onReorderItem(item.id, 'up');
                        setActiveMoreAnchor(null);
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
                        setActiveMoreAnchor(null);
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
                )
              )}
              {onDeleteItem && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteItem(item.id);
                    setActiveMoreAnchor(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#ef4444]/20 text-[#ef4444] flex items-center gap-2 border-t border-[#27272a] mt-1 pt-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Item
                </button>
              )}
            </PortalMenu>
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
        sortBy={sortBy}
        onSortByChange={handleSortByChange}
        sortDirection={sortDirection}
        onToggleSortDirection={handleToggleSortDirection}
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
      ) : displayProjects.length === 0 ? (
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
        displayProjects.map((project, pIdx) => {
          const isFirstProject = pIdx === 0;
          const isLastProject = pIdx === displayProjects.length - 1;
          const projectItems = project.items || [];

          // Calculate project completion metrics
          let totalTasks = 0;
          let completedTasks = 0;
          function countProjectTasks(node: ItemNode) {
            if (!node.subItems || node.subItems.length === 0) {
              totalTasks++;
              if (node.status === 'completed') completedTasks++;
            } else {
              node.subItems.forEach(countProjectTasks);
            }
          }
          projectItems.forEach(countProjectTasks);
          const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          return (
            <div key={project.id} className="space-y-3 mb-10">
              {/* Project Header (Page Icon + Project Title + Description + Right-aligned Project Menu & Expand/Collapse) */}
              <div className="pt-2 pb-1 space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Emoji + Title + Description */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Big Page Icon with Popover */}
                    <div className="relative shrink-0 pt-0.5" data-popover-root>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveProjectEmojiAnchor(
                            activeProjectEmojiAnchor?.id === project.id
                              ? null
                              : { id: project.id, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }
                          );
                        }}
                        className="text-2xl sm:text-3xl hover:scale-105 transition-transform p-0.5 rounded-lg cursor-pointer select-none"
                        title="Click to change project icon"
                      >
                        {project.icon || '📁'}
                      </button>

                      <PortalMenu
                        isOpen={activeProjectEmojiAnchor?.id === project.id}
                        onClose={() => setActiveProjectEmojiAnchor(null)}
                        anchorRect={activeProjectEmojiAnchor?.id === project.id ? activeProjectEmojiAnchor.rect : null}
                        triggerElement={activeProjectEmojiAnchor?.id === project.id ? activeProjectEmojiAnchor.el : null}
                        align="left"
                        className="w-48 p-2.5 grid grid-cols-4 gap-1.5"
                      >
                        {NOTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleSetProjectEmoji(project.id, emoji)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#27272a] text-xl cursor-pointer transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </PortalMenu>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-xl sm:text-2xl font-bold text-[#f4f4f5] tracking-tight truncate">
                          {project.title}
                        </h2>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/20"
                          style={{ backgroundColor: project.color || '#f97316' }}
                          title={`Project color: ${project.color || '#f97316'}`}
                        />
                      </div>

                      {/* Project Description displayed below project name */}
                      <div className="mt-1">
                        {project.description && project.description.trim().length > 0 ? (
                          <p
                            onClick={() => onOpenProjectModal(project)}
                            className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed cursor-pointer hover:text-[#f4f4f5] transition-colors line-clamp-2"
                            title="Click to edit project details & description"
                          >
                            {project.description}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenProjectModal(project)}
                            className="text-xs text-[#71717a] hover:text-[#a1a1aa] cursor-pointer transition-colors inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add project description...</span>
                          </button>
                        )}
                      </div>

                      {/* Project Progress Bar & Completion Metrics */}
                      <div className="mt-2.5 flex items-center gap-3">
                        {/* Visual Progress Bar */}
                        <div className="w-32 sm:w-44 bg-[#27272a] h-2 rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              completionPct === 100
                                ? 'bg-emerald-500'
                                : completionPct > 0
                                ? 'bg-orange-500'
                                : 'bg-transparent'
                            }`}
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>

                        {/* Completed: X / Y */}
                        <span className="text-xs text-[#a1a1aa] shrink-0 font-medium">
                          Completed:{' '}
                          <strong className="text-[#f4f4f5] font-mono">
                            {completedTasks} / {totalTasks}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right (Pojok Kanan): Expand/Collapse and Project Menu Button */}
                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    {onSetAllExpand && (
                      <div className="hidden sm:flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSetAllExpand(true)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] border border-[#27272a] rounded-lg transition-colors cursor-pointer"
                          title="Expand all tasks"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span className="hidden md:inline">Expand All</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetAllExpand(false)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] border border-[#27272a] rounded-lg transition-colors cursor-pointer"
                          title="Collapse all tasks"
                        >
                          <Minimize2 className="w-3 h-3" />
                          <span className="hidden md:inline">Collapse</span>
                        </button>
                      </div>
                    )}

                    {/* Project Menu Button (moved to pojok kanan) */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveProjectMenuAnchor(
                            activeProjectMenuAnchor?.id === project.id
                              ? null
                              : { id: project.id, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }
                          );
                        }}
                        style={{ backgroundColor: project.color || '#f97316' }}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white shadow-sm hover:brightness-110 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-1 ring-white/20"
                        title="Project Settings & Options"
                      >
                        <MoreHorizontal className="w-4 h-4 text-white drop-shadow-xs" />
                      </button>

                      {/* Project Options Menu via Portal - Never clipped */}
                      <PortalMenu
                        isOpen={activeProjectMenuAnchor?.id === project.id}
                        onClose={() => setActiveProjectMenuAnchor(null)}
                        anchorRect={activeProjectMenuAnchor?.id === project.id ? activeProjectMenuAnchor.rect : null}
                        triggerElement={activeProjectMenuAnchor?.id === project.id ? activeProjectMenuAnchor.el : null}
                        align="right"
                        className="w-48 flex flex-col gap-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveProjectMenuAnchor(null);
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
                              setActiveProjectMenuAnchor(null);
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
                                setActiveProjectMenuAnchor(null);
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
                                setActiveProjectMenuAnchor(null);
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
                            setActiveProjectMenuAnchor(null);
                            onArchiveProject(project.id);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-[#f59e0b] flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive Project</span>
                        </button>
                      </PortalMenu>
                    </div>
                  </div>
                </div>
              </div>

              {/* UNBOXED TASK LIST TABLE (Consistent with Notion View layout & mobile/tablet rules) */}
              <div className="overflow-x-auto">
                <div className="min-w-[850px] min-h-[140px] pb-4">
                  {/* Table Column Headers */}
                  <div className="flex items-center border-b border-[#27272a] text-[11px] font-semibold text-[#71717a] select-none py-2.5 px-1 tracking-wider uppercase">
                    {/* 1. Name */}
                    <div className="flex-1 min-w-[200px] xl:min-w-[260px] 2xl:min-w-[320px] flex items-center gap-1 pl-2 xl:pl-4">
                      <span>Name</span>
                    </div>
                    {/* 2. Status */}
                    <div className="w-28 xl:w-36 2xl:w-40 px-2 xl:px-3 shrink-0">
                      <span>Status</span>
                    </div>
                    {/* 3. Progress */}
                    <div className="w-24 xl:w-[106px] 2xl:w-32 px-2 xl:px-3 shrink-0">
                      <span>Progress</span>
                    </div>
                    {/* 4. Date */}
                    <div className="w-[186px] min-w-[186px] xl:w-56 2xl:w-64 px-2 xl:px-4 shrink-0">
                      <span>Date</span>
                    </div>
                    {/* 5. Team */}
                    <div className="w-16 xl:w-24 2xl:w-28 px-2 xl:px-3 shrink-0">
                      <span>Team</span>
                    </div>
                    {/* 6. Timer */}
                    <div className="w-[130px] xl:w-36 2xl:w-40 px-2 xl:px-3 shrink-0 text-right pr-2 xl:pr-3">
                      <span>Timer</span>
                    </div>
                    {/* 7. More */}
                    <div className="w-10 xl:w-14 2xl:w-16 px-1 xl:px-2 shrink-0 text-center">
                      <span>More</span>
                    </div>
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
                      <div className="py-8 text-center text-[#71717a] text-xs border-b border-[#27272a]">
                        No tasks found in this project. Click{' '}
                        <button
                          type="button"
                          onClick={() => onOpenAddItemModal(undefined, project.id)}
                          className="font-semibold text-[#f4f4f5] hover:underline cursor-pointer"
                        >
                          + Add Task
                        </button>{' '}
                        below to start.
                      </div>
                    )}
                  </div>

                  {/* Unboxed Add Task Quick Row (Like Notion View) */}
                  <div
                    onClick={() => onOpenAddItemModal(undefined, project.id)}
                    className="flex items-center gap-2 py-2.5 px-2 text-xs font-medium text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#18181b]/70 cursor-pointer transition-colors border-b border-dashed border-[#27272a] mt-1 select-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronRight,
  Plus,
  Play,
  Square,
  MoreHorizontal,
  Edit2,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  User,
  X,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import { StructureToolbar } from './StructureToolbar';
import { PortalMenu } from './PortalMenu';
import { AppData, ItemNode, ProjectNode, ItemStatus, Person } from '../types';
import {
  updateItemInProjects,
  addSubItemInProjects,
  deleteItemFromProjects,
  duplicateItemInProjects,
  reorderItemInProjects,
  getItemLoggedSeconds,
  formatTimerClock,
  formatDaysLeft,
  formatStartEndDateRange,
  getStatusConfig,
} from '../utils/treeUtils';
import {
  TreeSortBy,
  TreeSortDirection,
  sortItemsRecursively,
} from '../utils/treeSorting';

interface NotionTreeViewProps {
  appData: AppData;
  onUpdateItemStatus: (itemId: string, newStatus: ItemStatus) => void;
  onOpenEditItemModal: (item: ItemNode) => void;
  onOpenAddItemModal: (parentItemId?: string, targetProjectId?: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onReorderItem?: (itemId: string, direction: 'up' | 'down') => void;
  onDuplicateItem?: (itemId: string) => void;
  onToggleExpand: (itemId: string) => void;
  onSetAllExpand: (expand: boolean) => void;
  onSaveData: (updatedData: AppData) => void;
  onStartTimer: (itemId: string) => void;
  onStopTimer: () => void;
  selectedProjectId: string;
  onSelectProjectFilter: (projectId: string) => void;
  selectedPersonId?: string;
  onSelectPersonFilter?: (personId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenProjectModal: (project?: ProjectNode) => void;
}

// Notion emoji palette
const NOTION_EMOJIS = ['🌳', '📁', '💻', '🎬', '📄', '📝', '⚡', '🚀', '🎯', '✨', '🔥', '📌', '🎨', '⚙️', '💡', '🏷️'];

// Calculate progress accurately
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

// Get smart default emoji for an item
function getDefaultItemEmoji(item: ItemNode, depth: number): string {
  if (item.icon) return item.icon;
  const name = item.name.toLowerCase();
  if (name.includes('video') || name.includes('editing') || name.includes('film') || name.includes('clip')) return '🎬';
  if (name.includes('code') || name.includes('dev') || name.includes('api') || name.includes('bug') || name.includes('app')) return '💻';
  if (name.includes('design') || name.includes('ui') || name.includes('mock') || name.includes('sketch')) return '🎨';
  if (name.includes('doc') || name.includes('spec') || name.includes('brief') || name.includes('review')) return '📄';
  if (name.includes('test') || name.includes('check') || name.includes('qa')) return '📝';
  if (name.includes('launch') || name.includes('ship') || name.includes('deploy')) return '🚀';
  if (item.subItems && item.subItems.length > 0) return depth === 0 ? '💻' : '📁';
  return '📄';
}

// Recursively update status of all descendant sub-items
function recursivelyUpdateStatus(items: ItemNode[], targetStatus: ItemStatus): ItemNode[] {
  return items.map((child) => ({
    ...child,
    status: targetStatus,
    subItems: child.subItems ? recursivelyUpdateStatus(child.subItems, targetStatus) : [],
  }));
}

export const NotionTreeView: React.FC<NotionTreeViewProps> = ({
  appData,
  onUpdateItemStatus,
  onOpenEditItemModal,
  onOpenAddItemModal,
  onDeleteItem,
  onReorderItem,
  onDuplicateItem,
  onToggleExpand,
  onSetAllExpand,
  onSaveData,
  onStartTimer,
  onStopTimer,
  selectedProjectId,
  onSelectProjectFilter,
  selectedPersonId = 'all',
  onSelectPersonFilter,
  searchQuery,
  onSearchChange,
  onOpenProjectModal,
}) => {
  // Project Emoji Popover State
  const [activeProjectEmojiPickerId, setActiveProjectEmojiPickerId] = useState<string | null>(null);

  // Sorting State (persisted in localStorage like TreeView)
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

  // Inline Sub-item Creation State: parentItemId -> string
  const [inlineSubItemParentId, setInlineSubItemParentId] = useState<string | null>(null);
  const [inlineSubItemName, setInlineSubItemName] = useState('');

  // Inline Root Item Creation State: targetProjectId -> boolean
  const [addingRootProjectId, setAddingRootProjectId] = useState<string | null>(null);
  const [inlineRootName, setInlineRootName] = useState('');

  // Editing Project Description inline
  const [editingDescriptionProjectId, setEditingDescriptionProjectId] = useState<string | null>(null);
  const [inlineDescriptionValue, setInlineDescriptionValue] = useState('');

  // Dropdown Popovers using Portal to completely prevent container clipping
  interface MenuAnchorState {
    id: string;
    rect: DOMRect;
    el: HTMLElement;
  }
  const [activeStatusAnchor, setActiveStatusAnchor] = useState<MenuAnchorState | null>(null);
  const [activeProgressAnchor, setActiveProgressAnchor] = useState<MenuAnchorState | null>(null);
  const [activeAssigneeAnchor, setActiveAssigneeAnchor] = useState<MenuAnchorState | null>(null);
  const [activeMoreAnchor, setActiveMoreAnchor] = useState<MenuAnchorState | null>(null);
  const [activeEmojiAnchor, setActiveEmojiAnchor] = useState<MenuAnchorState | null>(null);
  const [activeProjectEmojiAnchor, setActiveProjectEmojiAnchor] = useState<MenuAnchorState | null>(null);

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

  // Filter projects by selected project IDs and person IDs
  const displayedProjects = useMemo(() => {
    if (isNoneProjects) return [];
    const activeProjects = appData.projects.filter((p) => p.status === 'active');
    return activeProjects.filter((project) => {
      if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(project.id)) {
        return false;
      }
      if (isNonePersons) return false;
      if (selectedPersonIds.length > 0) {
        const hasMatchingPerson = (project.items || []).some((item) => {
          const matchItem = (node: ItemNode): boolean => {
            const matches =
              (node.assigneeId && selectedPersonIds.includes(node.assigneeId)) ||
              (node.reviewerId && selectedPersonIds.includes(node.reviewerId));
            if (matches) return true;
            return (node.subItems || []).some(matchItem);
          };
          return matchItem(item);
        });
        if (!hasMatchingPerson) return false;
      }
      return true;
    });
  }, [appData.projects, isNoneProjects, isNonePersons, selectedProjectIds, selectedPersonIds]);

  // Check if item matches search and person filter
  const itemMatchesFilter = (item: ItemNode): boolean => {
    if (isNonePersons) return false;
    // Person filter
    if (selectedPersonIds.length > 0) {
      const matchesSelf =
        (item.assigneeId && selectedPersonIds.includes(item.assigneeId)) ||
        (item.reviewerId && selectedPersonIds.includes(item.reviewerId));
      if (!matchesSelf) {
        const hasMatchingChild = (node: ItemNode): boolean => {
          if (
            (node.assigneeId && selectedPersonIds.includes(node.assigneeId)) ||
            (node.reviewerId && selectedPersonIds.includes(node.reviewerId))
          )
            return true;
          return (node.subItems || []).some(hasMatchingChild);
        };
        if (!hasMatchingChild(item)) return false;
      }
    }

    // Search query check
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSelf = item.name.toLowerCase().includes(q) || (item.notes && item.notes.toLowerCase().includes(q));
      if (!matchSelf) {
        const hasMatchingChild = (node: ItemNode): boolean => {
          if (node.name.toLowerCase().includes(q)) return true;
          return (node.subItems || []).some(hasMatchingChild);
        };
        if (!hasMatchingChild(item)) return false;
      }
    }

    return true;
  };

  // Inline Sub-item submit
  const handleCreateInlineSubItem = (parentId: string) => {
    if (!inlineSubItemName.trim()) {
      setInlineSubItemParentId(null);
      return;
    }

    const newItem: ItemNode = {
      id: `item-${Date.now()}`,
      type: 'item-node',
      name: inlineSubItemName.trim(),
      status: 'not-started',
      priority: 'medium',
      assigneeId: appData.persons[0]?.id,
      sessions: [],
      subItems: [],
    };

    let updatedProjects = addSubItemInProjects(appData.projects, parentId, newItem);
    // Ensure parent is expanded
    updatedProjects = updateItemInProjects(updatedProjects, parentId, (p) => ({
      ...p,
      isExpanded: true,
    }));

    onSaveData({
      ...appData,
      projects: updatedProjects,
    });

    setInlineSubItemName('');
    setInlineSubItemParentId(null);
  };

  // Inline Root Item submit
  const handleCreateInlineRootItem = (projectId: string) => {
    if (!inlineRootName.trim()) {
      setAddingRootProjectId(null);
      return;
    }

    const newItem: ItemNode = {
      id: `item-${Date.now()}`,
      type: 'item-node',
      name: inlineRootName.trim(),
      status: 'not-started',
      priority: 'medium',
      assigneeId: appData.persons[0]?.id,
      sessions: [],
      subItems: [],
    };

    const updatedProjects = appData.projects.map((p) => {
      if (p.id === projectId) {
        return { ...p, items: [...p.items, newItem] };
      }
      return p;
    });

    onSaveData({
      ...appData,
      projects: updatedProjects,
    });

    setInlineRootName('');
    setAddingRootProjectId(null);
  };

  // Save Project Description
  const handleSaveProjectDescription = (projectId: string) => {
    const updatedProjects = appData.projects.map((p) => {
      if (p.id === projectId) {
        return { ...p, description: inlineDescriptionValue };
      }
      return p;
    });
    onSaveData({ ...appData, projects: updatedProjects });
    setEditingDescriptionProjectId(null);
  };

  // Bulk status update for interactive progress
  const handleBulkUpdateStatus = (itemId: string, targetStatus: ItemStatus) => {
    const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
      ...item,
      status: targetStatus,
      subItems: item.subItems ? recursivelyUpdateStatus(item.subItems, targetStatus) : [],
    }));
    onSaveData({ ...appData, projects: updatedProjects });
    setActiveProgressAnchor(null);
  };

  // Update Item Assignee
  const handleSetAssignee = (itemId: string, assigneeId: string) => {
    const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
      ...item,
      assigneeId,
    }));
    onSaveData({ ...appData, projects: updatedProjects });
    setActiveAssigneeAnchor(null);
  };

  // Update Item Custom Emoji Icon
  const handleSetItemEmoji = (itemId: string, emoji: string) => {
    const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
      ...item,
      icon: emoji,
    }));
    onSaveData({ ...appData, projects: updatedProjects });
    setActiveEmojiAnchor(null);
  };

  // Update Project Custom Emoji Icon
  const handleSetProjectEmoji = (projectId: string, emoji: string) => {
    const updatedProjects = appData.projects.map((p) =>
      p.id === projectId ? { ...p, icon: emoji } : p
    );
    onSaveData({ ...appData, projects: updatedProjects });
    setActiveProjectEmojiAnchor(null);
  };

  // Render individual task row
  const renderTaskRow = (
    item: ItemNode,
    project: ProjectNode,
    depth: number = 0,
    isFirstChild: boolean = false,
    isLastChild: boolean = false
  ): React.ReactNode => {
    if (!itemMatchesFilter(item)) return null;

    const hasChildren = item.subItems && item.subItems.length > 0;
    const isExpanded = item.isExpanded ?? true;
    const progress = calculateItemProgress(item);
    const itemEmoji = getDefaultItemEmoji(item, depth);
    const assignee = appData.persons.find((p) => p.id === item.assigneeId);
    const reviewer = appData.persons.find((p) => p.id === item.reviewerId);
    const isTimerRunning = appData.settings.activeTimer?.itemId === item.id;
    const loggedSeconds = getItemLoggedSeconds(item);
    const formattedTime = formatTimerClock(loggedSeconds);
    const dateRangeStr = formatStartEndDateRange(item);
    const dateInfo = formatDaysLeft(item.targetDate);
    const isCompleted = item.status === 'completed';
    const statusCfg = getStatusConfig(item.status);

    return (
      <React.Fragment key={item.id}>
        <div
          className={`group flex items-center border-b border-[#27272a] hover:bg-[#18181b]/70 transition-colors text-sm text-[#f4f4f5] select-none min-h-[40px] relative ${
            isTimerRunning ? 'bg-orange-500/10' : ''
          }`}
        >
          {/* Column 1: NAME (Tree Indent + Chevron + Icon + Name + Action Buttons: OPEN & + Sub-item) */}
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

            {/* Chevron Arrow Toggle */}
            <div className="w-5 h-5 flex items-center justify-center shrink-0 mr-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggleExpand(item.id)}
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
                title="Change icon"
              >
                {itemEmoji}
              </button>

              {/* Emoji Picker Popover */}
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
                    onClick={() => {
                      handleSetItemEmoji(item.id, emoji);
                      setActiveEmojiAnchor(null);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#27272a] text-lg cursor-pointer transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </PortalMenu>
            </div>

            {/* Item Title */}
            <span
              onClick={() => onOpenEditItemModal(item)}
              className={`font-medium truncate flex-1 min-w-0 hover:underline cursor-pointer ${
                isCompleted ? 'line-through text-[#71717a]' : 'text-[#f4f4f5]'
              }`}
              title={item.name}
            >
              {item.name}
            </span>

            {/* ACTION BUTTON ON THE RIGHT OF TASK NAME: + Sub-item (Shown on hover) */}
            <div className="hidden group-hover:flex items-center ml-2 shrink-0 animate-in fade-in">
              {/* + Sub-item button */}
              <button
                type="button"
                onClick={() => {
                  setInlineSubItemParentId(item.id);
                  setInlineSubItemName('');
                }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-[#a1a1aa] hover:text-[#f4f4f5] bg-transparent hover:bg-[#27272a] border border-transparent hover:border-[#3f3f46] rounded transition-all cursor-pointer"
                title="Add sub-item"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Sub-item</span>
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-85 border ${statusCfg.badgeBorder} ${statusCfg.badgeBg} ${statusCfg.textColor}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotBg}`} />
              <span className="capitalize whitespace-nowrap">{statusCfg.label}</span>
            </button>

            {/* Status Dropdown Popover */}
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

          {/* Column 3: PROGRESS (Interactive Roll-up & Quick Actions, +10px on wide screen) */}
          <div className="w-24 xl:w-[106px] 2xl:w-32 px-2 xl:px-3 shrink-0 relative" data-popover-root>
            <button
              type="button"
              onClick={(e) => {
                if (progress.isLeaf) {
                  // Direct toggle for leaf item
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

            {/* Interactive Progress Popover for Parent Items */}
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
                    onClick={() => {
                      handleBulkUpdateStatus(item.id, 'completed');
                      setActiveProgressAnchor(null);
                    }}
                    className="text-left px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/15 rounded font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark all sub-tasks completed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleBulkUpdateStatus(item.id, 'not-started');
                      setActiveProgressAnchor(null);
                    }}
                    className="text-left px-2 py-1 text-xs text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Circle className="w-3.5 h-3.5" />
                    <span>Reset all to not started</span>
                  </button>
                </div>
              </PortalMenu>
            )}
          </div>

          {/* Column 4: DATE (Same format as TreeView: Range & Days Left) */}
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

          {/* Column 5: TEAM (Assignee & Reviewer Avatar Only) */}
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

              {/* Reviewer indicator if present */}
              {reviewer && (
                <img
                  src={reviewer.avatar}
                  alt={`Reviewer: ${reviewer.name}`}
                  className="w-5 h-5 rounded-full object-cover border border-amber-400 ring-1 ring-amber-400/50 shrink-0"
                  title={`Reviewer: ${reviewer.name}`}
                />
              )}
            </button>

            {/* Assignee Dropdown Popover */}
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
              {appData.persons.map((person) => (
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
                  <img
                    src={person.avatar}
                    alt={person.name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <div className="flex-1 truncate">
                    <div className="truncate">{person.name}</div>
                    <div className="text-[10px] text-[#71717a] truncate">{person.role}</div>
                  </div>
                </button>
              ))}
            </PortalMenu>
          </div>

          {/* Column 6: TIMER (Tracked Time & Play/Stop Button) */}
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
                className="w-6 h-6 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center justify-center shadow-xs cursor-pointer"
                title="Stop timer"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStartTimer(item.id)}
                className="w-6 h-6 rounded-full bg-[#27272a] text-[#a1a1aa] hover:text-orange-400 hover:bg-orange-500/20 transition-colors flex items-center justify-center cursor-pointer"
                title="Start timer for this task"
              >
                <Play className="w-3 h-3 fill-current ml-0.5" />
              </button>
            )}
          </div>

          {/* Column 7: MORE (Options Dropdown) */}
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
              title="More actions"
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
              className="w-44 flex flex-col gap-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  setActiveMoreAnchor(null);
                  setInlineSubItemParentId(item.id);
                  setInlineSubItemName('');
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                <span>Add Sub-task</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMoreAnchor(null);
                  onOpenEditItemModal(item);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#71717a]" />
                <span>Edit Details</span>
              </button>
              {onDuplicateItem && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMoreAnchor(null);
                    onDuplicateItem(item.id);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] text-[#f4f4f5] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-400" />
                  <span>Duplicate Task</span>
                </button>
              )}
              {onReorderItem && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMoreAnchor(null);
                      onReorderItem(item.id, 'up');
                    }}
                    disabled={isFirstChild}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                      isFirstChild
                        ? 'text-[#71717a] cursor-not-allowed opacity-50'
                        : 'hover:bg-[#27272a] text-[#f4f4f5] cursor-pointer'
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Move Up</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMoreAnchor(null);
                      onReorderItem(item.id, 'down');
                    }}
                    disabled={isLastChild}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                      isLastChild
                        ? 'text-[#71717a] cursor-not-allowed opacity-50'
                        : 'hover:bg-[#27272a] text-[#f4f4f5] cursor-pointer'
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Move Down</span>
                  </button>
                </>
              )}
              {onDeleteItem && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMoreAnchor(null);
                    onDeleteItem(item.id);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 flex items-center gap-2 border-t border-[#27272a] mt-1 pt-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Item</span>
                </button>
              )}
            </PortalMenu>
          </div>
        </div>

        {/* Quick Inline Sub-item Input Row */}
        {inlineSubItemParentId === item.id && (
          <div
            className="flex items-center border-b border-[#27272a] bg-[#121215] py-2 px-3 text-sm animate-in fade-in"
            style={{ paddingLeft: `${(depth + 1) * 22 + 14}px` }}
          >
            <span className="text-base mr-2">📄</span>
            <input
              type="text"
              autoFocus
              placeholder="New sub-item name... (Press Enter to save, Esc to cancel)"
              value={inlineSubItemName}
              onChange={(e) => setInlineSubItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateInlineSubItem(item.id);
                if (e.key === 'Escape') setInlineSubItemParentId(null);
              }}
              className="flex-1 bg-transparent border-b border-orange-500 outline-none text-sm text-[#f4f4f5] placeholder-[#71717a] py-0.5 px-1 font-medium"
            />
            <div className="flex items-center gap-1.5 ml-2">
              <button
                type="button"
                onClick={() => handleCreateInlineSubItem(item.id)}
                className="px-2.5 py-1 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 cursor-pointer transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setInlineSubItemParentId(null)}
                className="px-2 py-1 text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] text-xs rounded cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Recursively Render Children when Expanded */}
        {hasChildren &&
          isExpanded &&
          item.subItems.map((child, idx) =>
            renderTaskRow(
              child,
              project,
              depth + 1,
              idx === 0,
              idx === item.subItems.length - 1
            )
          )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6 pb-16 max-w-[1400px] mx-auto text-[#f4f4f5]">
      {/* 1. Exactly the same Structural Toolbar as TreeView (NO breadcrumbs) */}
      <StructureToolbar
        projects={appData.projects}
        selectedProjectId={selectedProjectId || 'all'}
        onSelectProject={onSelectProjectFilter}
        persons={appData.persons}
        selectedPersonId={selectedPersonId || 'all'}
        onSelectPerson={onSelectPersonFilter}
        sortBy={sortBy}
        onSortByChange={handleSortByChange}
        sortDirection={sortDirection}
        onToggleSortDirection={handleToggleSortDirection}
        searchQuery={searchQuery || ''}
        onSearchChange={onSearchChange}
        onOpenProjectModal={() => onOpenProjectModal()}
      />

      {/* 2. Projects Sections */}
      {displayedProjects.length === 0 ? (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center text-[#a1a1aa] space-y-3 shadow-xs">
          <p className="text-base font-semibold text-[#f4f4f5]">No active projects found</p>
          <p className="text-xs text-[#71717a]">Adjust your project filter or create a new project using the toolbar above.</p>
        </div>
      ) : (
        displayedProjects.map((project) => {
          // Sort items if sort active
          const sortedItems = sortItemsRecursively(project.items || [], sortBy, sortDirection);

          // Calculate project metrics
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
          (project.items || []).forEach(countProjectTasks);
          const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          const isEditingDescription = editingDescriptionProjectId === project.id;
          const projectDescription =
            project.description ||
            'Nested work packages and task hierarchy. Parent items automatically calculate completion rollups from all subordinate sub-items.';

          return (
            <div key={project.id} className="space-y-4 pt-1 pb-10">
              {/* Project Header (Page Icon + Project Title as H1) */}
              <div className="mb-1">
                <div className="flex items-center gap-3 mb-2">
                  {/* Big Page Icon with Popover */}
                  <div className="relative" data-popover-root>
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
                      className="text-3xl sm:text-4xl hover:scale-105 transition-transform p-0.5 rounded-lg cursor-pointer select-none"
                      title="Click to change project icon"
                    >
                      {project.icon || '🌳'}
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
                          onClick={() => {
                            handleSetProjectEmoji(project.id, emoji);
                            setActiveProjectEmojiAnchor(null);
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#27272a] text-xl cursor-pointer transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </PortalMenu>
                  </div>

                  {/* Project Title (H1) */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f4f4f5] tracking-tight truncate">
                      {project.title}
                    </h1>
                  </div>

                  {/* Expand / Collapse Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSetAllExpand(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] border border-[#27272a] rounded-lg transition-colors cursor-pointer"
                      title="Expand all tasks"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Expand All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetAllExpand(false)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] border border-[#27272a] rounded-lg transition-colors cursor-pointer"
                      title="Collapse all tasks"
                    >
                      <Minimize2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Collapse</span>
                    </button>
                  </div>
                </div>

                {/* Project Description (Editable on click) - Unboxed */}
                <div className="mb-4">
                  {isEditingDescription ? (
                    <div className="flex flex-col gap-2 mb-3">
                      <textarea
                        autoFocus
                        rows={2}
                        value={inlineDescriptionValue}
                        onChange={(e) => setInlineDescriptionValue(e.target.value)}
                        placeholder="Write a project description..."
                        className="w-full bg-[#121215] border border-orange-500 rounded-lg p-2.5 text-sm text-[#f4f4f5] placeholder-[#71717a] outline-none shadow-xs"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveProjectDescription(project.id)}
                          className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded hover:bg-orange-600 cursor-pointer transition-colors"
                        >
                          Save Description
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDescriptionProjectId(null)}
                          className="px-2 py-1 text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] text-xs rounded cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingDescriptionProjectId(project.id);
                        setInlineDescriptionValue(project.description || '');
                      }}
                      className="cursor-pointer hover:bg-[#18181b]/60 -mx-1.5 px-1.5 py-1 rounded transition-colors group/desc flex items-start justify-between gap-2 text-sm text-[#a1a1aa] leading-relaxed mb-2"
                      title="Click to edit project description"
                    >
                      <p className="flex-1">{projectDescription}</p>
                      <span className="text-[11px] text-[#71717a] opacity-0 group-hover/desc:opacity-100 flex items-center gap-1 shrink-0 mt-0.5">
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </span>
                    </div>
                  )}

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

              {/* 3. UNBOXED TASK LIST TABLE */}
              <div className="overflow-x-auto">
                <div className="min-w-[850px] min-h-[140px] pb-6">
                  {/* Column Header Row (Order aligned with TreeView) */}
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

                  {/* Tasks Rows */}
                  {sortedItems.length === 0 ? (
                    <div className="py-8 text-center text-[#71717a] text-xs">
                      No tasks found in this project. Click <span className="font-semibold text-[#f4f4f5]">+ New Task</span> below to start.
                    </div>
                  ) : (
                    sortedItems.map((item, idx) =>
                      renderTaskRow(
                        item,
                        project,
                        0,
                        idx === 0,
                        idx === sortedItems.length - 1
                      )
                    )
                  )}

                  {/* Inline Root Item Input Row */}
                  {addingRootProjectId === project.id && (
                    <div className="flex items-center bg-[#121215] py-2.5 px-3 text-sm border-b border-[#27272a] animate-in fade-in">
                      <span className="text-base mr-2">{project.icon || '📄'}</span>
                      <input
                        type="text"
                        autoFocus
                        placeholder="New root task title... (Press Enter to save, Esc to cancel)"
                        value={inlineRootName}
                        onChange={(e) => setInlineRootName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateInlineRootItem(project.id);
                          if (e.key === 'Escape') setAddingRootProjectId(null);
                        }}
                        className="flex-1 bg-transparent border-b border-orange-500 outline-none text-sm text-[#f4f4f5] placeholder-[#71717a] py-0.5 px-1 font-medium"
                      />
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          type="button"
                          onClick={() => handleCreateInlineRootItem(project.id)}
                          className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded hover:bg-orange-600 cursor-pointer transition-colors"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingRootProjectId(null)}
                          className="px-2 py-1 text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] text-xs rounded cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bottom "+ New Task" Quick Row */}
                  <div
                    onClick={() => {
                      setAddingRootProjectId(project.id);
                      setInlineRootName('');
                    }}
                    className="flex items-center gap-2 py-2 px-2 text-xs font-medium text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#18181b]/70 cursor-pointer transition-colors border-b border-dashed border-[#27272a] mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Task</span>
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

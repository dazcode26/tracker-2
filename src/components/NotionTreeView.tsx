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
  // Page Icon & Header State
  const [pageEmoji, setPageEmoji] = useState<string>('🌳');
  const [showPageEmojiPicker, setShowPageEmojiPicker] = useState(false);

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

  // Dropdown Popovers
  const [activeStatusMenuId, setActiveStatusMenuId] = useState<string | null>(null);
  const [activeProgressMenuId, setActiveProgressMenuId] = useState<string | null>(null);
  const [activeAssigneeMenuId, setActiveAssigneeMenuId] = useState<string | null>(null);
  const [activeMoreMenuId, setActiveMoreMenuId] = useState<string | null>(null);
  const [activeEmojiPickerItemId, setActiveEmojiPickerItemId] = useState<string | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-popover-root]')) {
        setActiveStatusMenuId(null);
        setActiveProgressMenuId(null);
        setActiveAssigneeMenuId(null);
        setActiveMoreMenuId(null);
        setActiveEmojiPickerItemId(null);
        setShowPageEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter projects by selected project ID
  const displayedProjects = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === 'all') {
      return appData.projects.filter((p) => p.status === 'active');
    }
    return appData.projects.filter((p) => p.id === selectedProjectId && p.status === 'active');
  }, [appData.projects, selectedProjectId]);

  // Check if item matches search and person filter
  const itemMatchesFilter = (item: ItemNode): boolean => {
    // Person filter
    if (selectedPersonId && selectedPersonId !== 'all') {
      const matchesSelf = item.assigneeId === selectedPersonId || item.reviewerId === selectedPersonId;
      if (!matchesSelf) {
        const hasMatchingChild = (node: ItemNode): boolean => {
          if (node.assigneeId === selectedPersonId || node.reviewerId === selectedPersonId) return true;
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
    setActiveProgressMenuId(null);
  };

  // Update Item Assignee
  const handleSetAssignee = (itemId: string, assigneeId: string) => {
    const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
      ...item,
      assigneeId,
    }));
    onSaveData({ ...appData, projects: updatedProjects });
    setActiveAssigneeMenuId(null);
  };

  // Update Item Custom Emoji Icon
  const handleSetItemEmoji = (itemId: string, emoji: string) => {
    const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
      ...item,
      icon: emoji,
    }));
    onSaveData({ ...appData, projects: updatedProjects });
    setActiveEmojiPickerItemId(null);
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

    return (
      <React.Fragment key={item.id}>
        <div className="group flex items-center border-b border-[#ECECEB] hover:bg-[#F9F9F8] transition-colors text-sm text-[#37352F] select-none min-h-[40px] relative">
          {/* Column 1: NAME (Tree Indent + Chevron + Icon + Name + Action Buttons: OPEN & + Sub-item) */}
          <div
            className="flex-1 flex items-center min-w-[280px] sm:min-w-[360px] py-2 pr-2 relative"
            style={{ paddingLeft: `${Math.max(4, depth * 22 + 6)}px` }}
          >
            {/* Guide Lines for nested items */}
            {depth > 0 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: `${(depth - 1) * 22 + 14}px` }}
              >
                <div className="w-[1px] h-full bg-[#E0E0DE]" />
                <div className="absolute top-[19px] left-0 w-2.5 h-[1px] bg-[#E0E0DE]" />
              </div>
            )}

            {/* Chevron Arrow Toggle */}
            <div className="w-5 h-5 flex items-center justify-center shrink-0 mr-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggleExpand(item.id)}
                  className="w-4 h-4 rounded flex items-center justify-center text-[#787774] hover:text-[#37352F] hover:bg-[#E9E9E7] transition-all cursor-pointer"
                  title={isExpanded ? 'Collapse sub-tasks' : 'Expand sub-tasks'}
                >
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isExpanded ? 'rotate-90 text-[#37352F]' : ''
                    }`}
                  />
                </button>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-[#D6D6D4] inline-block" />
              )}
            </div>

            {/* Topic / Page Emoji Icon */}
            <div className="relative shrink-0 mr-2" data-popover-root>
              <button
                type="button"
                onClick={() =>
                  setActiveEmojiPickerItemId(activeEmojiPickerItemId === item.id ? null : item.id)
                }
                className="text-base hover:scale-110 transition-transform p-0.5 rounded cursor-pointer select-none"
                title="Change icon"
              >
                {itemEmoji}
              </button>

              {/* Emoji Picker Popover */}
              {activeEmojiPickerItemId === item.id && (
                <div className="absolute left-0 top-7 z-50 bg-[#FFFFFF] border border-[#E9E9E7] rounded-xl shadow-xl p-2.5 grid grid-cols-4 gap-1.5 w-44 animate-in fade-in">
                  {NOTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSetItemEmoji(item.id, emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F1EF] text-lg cursor-pointer transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Item Title */}
            <span
              onClick={() => onOpenEditItemModal(item)}
              className={`font-medium truncate max-w-[200px] sm:max-w-[320px] hover:underline cursor-pointer ${
                isCompleted ? 'line-through text-[#9B9A97]' : 'text-[#37352F]'
              }`}
              title={item.name}
            >
              {item.name}
            </span>

            {/* ACTION BUTTONS ON THE RIGHT OF TASK NAME: OPEN & + SUB-ITEM */}
            <div className="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* OPEN button */}
              <button
                type="button"
                onClick={() => onOpenEditItemModal(item)}
                className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#787774] hover:text-[#37352F] hover:bg-[#E9E9E7] rounded transition-colors uppercase cursor-pointer"
                title="Open task details (side-peek)"
              >
                OPEN
              </button>

              {/* + Sub-item button */}
              <button
                type="button"
                onClick={() => {
                  setInlineSubItemParentId(item.id);
                  setInlineSubItemName('');
                }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-[#787774] hover:text-[#37352F] hover:bg-[#E9E9E7] rounded transition-colors cursor-pointer"
                title="Add sub-item"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Sub-item</span>
              </button>
            </div>

            {/* Timer active badge indicator */}
            {isTimerRunning && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-800 font-mono flex items-center gap-1 animate-pulse shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Active
              </span>
            )}
          </div>

          {/* Column 2: STATUS */}
          <div className="w-28 sm:w-32 px-2 shrink-0 relative" data-popover-root>
            <button
              type="button"
              onClick={() =>
                setActiveStatusMenuId(activeStatusMenuId === item.id ? null : item.id)
              }
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-85 ${
                item.status === 'completed'
                  ? 'bg-[#EBF5F0] text-[#0F7B6C]'
                  : item.status === 'in-progress'
                  ? 'bg-[#EBF3FA] text-[#2383E2]'
                  : item.status === 'review'
                  ? 'bg-[#FAECE0] text-[#D9730D]'
                  : 'bg-[#F1F1EF] text-[#787774]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  item.status === 'completed'
                    ? 'bg-[#0F7B6C]'
                    : item.status === 'in-progress'
                    ? 'bg-[#2383E2]'
                    : item.status === 'review'
                    ? 'bg-[#D9730D]'
                    : 'bg-[#9B9A97]'
                }`}
              />
              <span className="capitalize whitespace-nowrap">
                {item.status === 'completed'
                  ? 'Done'
                  : item.status === 'in-progress'
                  ? 'In progress'
                  : item.status === 'review'
                  ? 'In review'
                  : 'Not started'}
              </span>
            </button>

            {/* Status Dropdown Popover */}
            {activeStatusMenuId === item.id && (
              <div className="absolute left-2 top-8 z-50 bg-[#FFFFFF] border border-[#E9E9E7] rounded-xl shadow-xl p-1.5 w-36 animate-in fade-in flex flex-col gap-0.5">
                {[
                  { key: 'not-started', label: 'Not started', color: 'bg-[#9B9A97]' },
                  { key: 'in-progress', label: 'In progress', color: 'bg-[#2383E2]' },
                  { key: 'review', label: 'In review', color: 'bg-[#D9730D]' },
                  { key: 'completed', label: 'Done', color: 'bg-[#0F7B6C]' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      onUpdateItemStatus(item.id, s.key as ItemStatus);
                      setActiveStatusMenuId(null);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#F1F1EF] text-[#37352F] cursor-pointer text-left ${
                      item.status === s.key ? 'font-semibold bg-[#F1F1EF]' : ''
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${s.color}`} />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column 3: PROGRESS (Interactive Roll-up & Quick Actions) */}
          <div className="w-28 sm:w-32 px-2 shrink-0 relative" data-popover-root>
            <button
              type="button"
              onClick={() => {
                if (progress.isLeaf) {
                  // Direct toggle for leaf item
                  onUpdateItemStatus(item.id, isCompleted ? 'not-started' : 'completed');
                } else {
                  setActiveProgressMenuId(activeProgressMenuId === item.id ? null : item.id);
                }
              }}
              className="w-full flex items-center gap-2 hover:bg-[#F1F1EF] p-1 rounded-md transition-colors cursor-pointer group/prog"
              title={
                progress.isLeaf
                  ? `Click to toggle completion (${progress.percentage}%)`
                  : `Click to view breakdown (${progress.completed}/${progress.total} sub-tasks completed)`
              }
            >
              <div className="flex-1 bg-[#E9E9E7] h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progress.percentage === 100
                      ? 'bg-[#0F7B6C]'
                      : progress.percentage > 0
                      ? 'bg-[#2383E2]'
                      : 'bg-transparent'
                  }`}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-[#787774] group-hover/prog:text-[#37352F] font-medium shrink-0">
                {progress.percentage}%
              </span>
            </button>

            {/* Interactive Progress Popover for Parent Items */}
            {activeProgressMenuId === item.id && !progress.isLeaf && (
              <div className="absolute left-0 top-8 z-50 bg-[#FFFFFF] border border-[#E9E9E7] rounded-xl shadow-xl p-3 w-56 animate-in fade-in flex flex-col gap-2">
                <div className="text-xs font-semibold text-[#37352F] flex items-center justify-between">
                  <span>Sub-items Rollup</span>
                  <span className="font-mono text-[#0F7B6C]">{progress.percentage}%</span>
                </div>
                <p className="text-[11px] text-[#787774]">
                  {progress.completed} of {progress.total} subordinate work items completed.
                </p>

                <div className="flex-1 bg-[#E9E9E7] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0F7B6C] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>

                <div className="border-t border-[#E9E9E7] pt-2 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus(item.id, 'completed')}
                    className="text-left px-2 py-1 text-xs text-[#0F7B6C] hover:bg-[#EBF5F0] rounded font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark all sub-tasks completed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkUpdateStatus(item.id, 'not-started')}
                    className="text-left px-2 py-1 text-xs text-[#787774] hover:bg-[#F1F1EF] rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Circle className="w-3.5 h-3.5" />
                    <span>Reset all to not started</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Column 4: DATE (Same format as TreeView: Range & Days Left) */}
          <div
            onClick={() => onOpenEditItemModal(item)}
            className="w-36 sm:w-44 px-2 shrink-0 font-mono text-[11px] cursor-pointer hover:bg-[#F1F1EF] rounded py-1 transition-colors flex flex-col justify-center min-w-0"
            title={`Realization: ${dateRangeStr || 'None'}\nTarget: ${dateInfo.fullDate}\nClick to edit details`}
          >
            {dateRangeStr ? (
              <span className="text-[#37352F] font-medium truncate">{dateRangeStr}</span>
            ) : (
              <span className="text-[#9B9A97] italic text-[10px]">-</span>
            )}
            {!isCompleted && item.targetDate && (
              <span
                className={`truncate ${
                  dateInfo.isOverdue
                    ? 'text-red-600 font-semibold'
                    : dateInfo.text === 'Today'
                    ? 'text-amber-600 font-semibold'
                    : 'text-[#787774]'
                }`}
              >
                {dateInfo.text}
              </span>
            )}
          </div>

          {/* Column 5: TEAM (Assignee & Reviewer) */}
          <div className="w-28 sm:w-32 px-2 shrink-0 relative" data-popover-root>
            <button
              type="button"
              onClick={() =>
                setActiveAssigneeMenuId(activeAssigneeMenuId === item.id ? null : item.id)
              }
              className="flex items-center gap-1.5 hover:bg-[#F1F1EF] px-1.5 py-1 rounded cursor-pointer transition-colors max-w-full text-left"
              title="Change assignee"
            >
              {assignee ? (
                <>
                  <img
                    src={assignee.avatar}
                    alt={assignee.name}
                    className="w-5 h-5 rounded-full object-cover border border-[#D6D6D4]"
                  />
                  <span className="text-xs text-[#37352F] truncate">{assignee.name}</span>
                </>
              ) : (
                <span className="text-xs text-[#9B9A97] flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>Unassigned</span>
                </span>
              )}

              {/* Reviewer indicator if present */}
              {reviewer && (
                <img
                  src={reviewer.avatar}
                  alt={`Reviewer: ${reviewer.name}`}
                  className="w-4 h-4 rounded-full object-cover border border-amber-400 ring-1 ring-amber-400/50 ml-0.5 shrink-0"
                  title={`Reviewer: ${reviewer.name}`}
                />
              )}
            </button>

            {/* Assignee Dropdown Popover */}
            {activeAssigneeMenuId === item.id && (
              <div className="absolute left-2 top-8 z-50 bg-[#FFFFFF] border border-[#E9E9E7] rounded-xl shadow-xl p-1.5 w-48 animate-in fade-in flex flex-col gap-0.5">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#9B9A97]">
                  Assign Team Member
                </div>
                {appData.persons.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleSetAssignee(item.id, person.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[#F1F1EF] text-[#37352F] cursor-pointer text-left ${
                      item.assigneeId === person.id ? 'font-semibold bg-[#F1F1EF]' : ''
                    }`}
                  >
                    <img
                      src={person.avatar}
                      alt={person.name}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <div className="flex-1 truncate">
                      <div className="truncate">{person.name}</div>
                      <div className="text-[10px] text-[#9B9A97] truncate">{person.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column 6: TIMER (Tracked Time & Play/Stop Button) */}
          <div className="w-24 sm:w-28 px-2 shrink-0 flex items-center justify-end gap-2">
            <span
              className={`font-mono text-xs ${
                isTimerRunning ? 'text-orange-600 font-bold animate-pulse' : 'text-[#787774]'
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
                className="w-6 h-6 rounded-full bg-[#F1F1EF] text-[#787774] hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center cursor-pointer"
                title="Start timer for this task"
              >
                <Play className="w-3 h-3 fill-current ml-0.5" />
              </button>
            )}
          </div>

          {/* Column 7: MORE (Options Dropdown) */}
          <div className="w-12 sm:w-14 px-2 shrink-0 flex items-center justify-center relative" data-popover-root>
            <button
              type="button"
              onClick={() =>
                setActiveMoreMenuId(activeMoreMenuId === item.id ? null : item.id)
              }
              className="w-7 h-7 rounded hover:bg-[#E9E9E7] text-[#787774] hover:text-[#37352F] flex items-center justify-center cursor-pointer transition-colors"
              title="More actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Context Menu Dropdown */}
            {activeMoreMenuId === item.id && (
              <div
                className={`absolute right-0 w-44 bg-[#FFFFFF] border border-[#E9E9E7] rounded-xl shadow-2xl z-50 p-1.5 text-xs flex flex-col gap-0.5 animate-in fade-in ${
                  isLastChild ? 'bottom-8' : 'top-8'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveMoreMenuId(null);
                    setInlineSubItemParentId(item.id);
                    setInlineSubItemName('');
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F1F1EF] text-[#37352F] flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#37352F]" />
                  <span>Add Sub-task</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMoreMenuId(null);
                    onOpenEditItemModal(item);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F1F1EF] text-[#37352F] flex items-center gap-2 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#787774]" />
                  <span>Edit Details</span>
                </button>
                {onDuplicateItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMoreMenuId(null);
                      onDuplicateItem(item.id);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F1F1EF] text-[#37352F] flex items-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-600" />
                    <span>Duplicate Task</span>
                  </button>
                )}
                {onReorderItem && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMoreMenuId(null);
                        onReorderItem(item.id, 'up');
                      }}
                      disabled={isFirstChild}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                        isFirstChild
                          ? 'text-[#9B9A97] cursor-not-allowed opacity-50'
                          : 'hover:bg-[#F1F1EF] text-[#37352F] cursor-pointer'
                      }`}
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Move Up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMoreMenuId(null);
                        onReorderItem(item.id, 'down');
                      }}
                      disabled={isLastChild}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                        isLastChild
                          ? 'text-[#9B9A97] cursor-not-allowed opacity-50'
                          : 'hover:bg-[#F1F1EF] text-[#37352F] cursor-pointer'
                      }`}
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Move Down</span>
                    </button>
                  </>
                )}
                {onDeleteItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMoreMenuId(null);
                      onDeleteItem(item.id);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-[#E9E9E7] mt-1 pt-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Item</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Inline Sub-item Input Row */}
        {inlineSubItemParentId === item.id && (
          <div
            className="flex items-center border-b border-[#ECECEB] bg-[#FAF9F7] py-2 px-3 text-sm animate-in fade-in"
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
              className="flex-1 bg-transparent border-b border-[#2383E2] outline-none text-sm text-[#37352F] py-0.5 px-1 font-medium"
            />
            <div className="flex items-center gap-1.5 ml-2">
              <button
                type="button"
                onClick={() => handleCreateInlineSubItem(item.id)}
                className="px-2.5 py-1 bg-[#2383E2] text-white text-xs font-medium rounded hover:bg-[#1B6FBF] cursor-pointer"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setInlineSubItemParentId(null)}
                className="px-2 py-1 text-[#787774] hover:bg-[#E9E9E7] text-xs rounded cursor-pointer"
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
    <div className="space-y-6 pb-16 max-w-[1400px] mx-auto text-[#37352F]">
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
        <div className="bg-[#FFFFFF] border border-[#E9E9E7] rounded-xl p-12 text-center text-[#787774] space-y-3 shadow-xs">
          <p className="text-base font-semibold text-[#37352F]">No active projects found</p>
          <p className="text-xs">Adjust your project filter or create a new project using the toolbar above.</p>
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
                      onClick={() => setShowPageEmojiPicker(!showPageEmojiPicker)}
                      className="text-3xl sm:text-4xl hover:scale-105 transition-transform p-0.5 rounded-lg cursor-pointer select-none"
                      title="Click to change page icon"
                    >
                      {pageEmoji}
                    </button>

                    {showPageEmojiPicker && (
                      <div className="absolute left-0 top-12 z-50 bg-[#FFFFFF] border border-[#E9E9E7] rounded-2xl shadow-2xl p-2.5 grid grid-cols-4 gap-1.5 w-48 animate-in fade-in">
                        {NOTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setPageEmoji(emoji);
                              setShowPageEmojiPicker(false);
                            }}
                            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F1F1EF] text-xl cursor-pointer transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Project Title (H1) */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#37352F] tracking-tight truncate">
                      {project.title}
                    </h1>
                  </div>

                  {/* Expand / Collapse Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSetAllExpand(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#787774] hover:text-[#37352F] hover:bg-[#F1F1EF] border border-[#E9E9E7] rounded-lg transition-colors cursor-pointer"
                      title="Expand all tasks"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Expand All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetAllExpand(false)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#787774] hover:text-[#37352F] hover:bg-[#F1F1EF] border border-[#E9E9E7] rounded-lg transition-colors cursor-pointer"
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
                        className="w-full bg-[#FFFFFF] border border-[#2383E2] rounded-lg p-2.5 text-sm text-[#37352F] outline-none shadow-xs"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveProjectDescription(project.id)}
                          className="px-3 py-1 bg-[#2383E2] text-white text-xs font-semibold rounded hover:bg-[#1B6FBF] cursor-pointer"
                        >
                          Save Description
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDescriptionProjectId(null)}
                          className="px-2 py-1 text-[#787774] hover:bg-[#E9E9E7] text-xs rounded cursor-pointer"
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
                      className="cursor-pointer hover:bg-[#F2F1ED] -mx-1.5 px-1.5 py-1 rounded transition-colors group/desc flex items-start justify-between gap-2 text-sm text-[#787774] leading-relaxed mb-2"
                      title="Click to edit project description"
                    >
                      <p className="flex-1">{projectDescription}</p>
                      <span className="text-[11px] text-[#9B9A97] opacity-0 group-hover/desc:opacity-100 flex items-center gap-1 shrink-0 mt-0.5">
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </span>
                    </div>
                  )}

                  {/* Overall Rollup & Stats - Unboxed */}
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[#787774]">
                    <span className="flex items-center gap-1.5 text-[#0F7B6C]">
                      <span className="w-2 h-2 rounded-full bg-[#0F7B6C]" />
                      Sub-items Hierarchy: <strong className="text-[#37352F]">Active</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Total Work Units:{' '}
                      <strong className="text-[#37352F]">
                        {completedTasks} / {totalTasks}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Completion:{' '}
                      <strong className="text-[#0F7B6C]">{completionPct}%</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. UNBOXED TASK LIST TABLE */}
              <div className="overflow-x-auto">
                <div className="min-w-[840px]">
                  {/* Column Header Row (Order aligned with TreeView) */}
                  <div className="flex items-center border-b border-[#E9E9E7] text-xs font-semibold text-[#787774] select-none py-2 px-1 tracking-wider uppercase">
                    {/* 1. Name */}
                    <div className="flex-1 min-w-[280px] sm:min-w-[360px] flex items-center gap-1 pl-2">
                      <span>Name</span>
                    </div>
                    {/* 2. Status */}
                    <div className="w-28 sm:w-32 px-2 shrink-0">
                      <span>Status</span>
                    </div>
                    {/* 3. Progress */}
                    <div className="w-28 sm:w-32 px-2 shrink-0">
                      <span>Progress</span>
                    </div>
                    {/* 4. Date */}
                    <div className="w-36 sm:w-44 px-2 shrink-0">
                      <span>Date</span>
                    </div>
                    {/* 5. Team */}
                    <div className="w-28 sm:w-32 px-2 shrink-0">
                      <span>Team</span>
                    </div>
                    {/* 6. Timer */}
                    <div className="w-24 sm:w-28 px-2 shrink-0 text-right pr-2">
                      <span>Timer</span>
                    </div>
                    {/* 7. More */}
                    <div className="w-12 sm:w-14 px-2 shrink-0 text-center">
                      <span>More</span>
                    </div>
                  </div>

                  {/* Tasks Rows */}
                  {sortedItems.length === 0 ? (
                    <div className="py-8 text-center text-[#9B9A97] text-xs">
                      No tasks found in this project. Click <span className="font-semibold text-[#37352F]">+ New Task</span> below to start.
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
                    <div className="flex items-center bg-[#FAF9F7] py-2.5 px-3 text-sm border-b border-[#ECECEB] animate-in fade-in">
                      <span className="text-base mr-2">{pageEmoji}</span>
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
                        className="flex-1 bg-transparent border-b border-[#2383E2] outline-none text-sm text-[#37352F] py-0.5 px-1 font-medium"
                      />
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          type="button"
                          onClick={() => handleCreateInlineRootItem(project.id)}
                          className="px-3 py-1 bg-[#2383E2] text-white text-xs font-semibold rounded hover:bg-[#1B6FBF] cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingRootProjectId(null)}
                          className="px-2 py-1 text-[#787774] hover:bg-[#E9E9E7] text-xs rounded cursor-pointer"
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
                    className="flex items-center gap-2 py-2 px-2 text-xs font-medium text-[#787774] hover:text-[#37352F] hover:bg-[#F9F9F8] cursor-pointer transition-colors border-b border-dashed border-[#E0E0DE] mt-1"
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

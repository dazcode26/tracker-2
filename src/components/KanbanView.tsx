import React, { useState, useEffect, useMemo } from 'react';
import { Play, Square, Clock, User, ShieldCheck, ChevronRight, ChevronDown, Target, Folder, Search, X, Plus } from 'lucide-react';
import { StructureToolbar } from './StructureToolbar';
import { PortalMenu } from './PortalMenu';
import { AppData, ItemNode, ItemStatus, ProjectNode } from '../types';
import { getLeafFlatItems, formatDuration, getItemLoggedSeconds, getStatusConfig, updateItemInProjects } from '../utils/treeUtils';
import { TreeSortBy, TreeSortDirection, compareItems } from '../utils/treeSorting';

interface MenuAnchorState {
  id: string;
  rect: DOMRect;
  el: HTMLElement;
}

// Helper to generate solid 20% tint on light mode or 20% transparent project color on dark mode
const getSolidKanbanTint = (hex?: string, isDark?: boolean): string => {
  if (!hex || !hex.startsWith('#')) return isDark ? 'rgba(39, 39, 42, 0.2)' : '#f3f4f6';
  const c = hex.replace('#', '');
  if (c.length !== 6 && c.length !== 3) return isDark ? 'rgba(39, 39, 42, 0.2)' : '#f3f4f6';
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return isDark ? 'rgba(39, 39, 42, 0.2)' : '#f3f4f6';
  
  if (isDark) {
    // Dark mode: 20% transparent project color
    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  }
  // Light mode: 20% project color + 80% white - solid, zero transparency
  const r20 = Math.round(r * 0.2 + 255 * 0.8);
  const g20 = Math.round(g * 0.2 + 255 * 0.8);
  const b20 = Math.round(b * 0.2 + 255 * 0.8);
  return `rgb(${r20}, ${g20}, ${b20})`;
};

// Helper to convert hex color to rgba with specific opacity
const hexToRgba = (hex?: string, alpha: number = 0.2): string => {
  if (!hex || !hex.startsWith('#')) return `rgba(249, 115, 22, ${alpha})`;
  const c = hex.replace('#', '');
  if (c.length !== 6 && c.length !== 3) return `rgba(249, 115, 22, ${alpha})`;
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(249, 115, 22, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface KanbanViewProps {
  appData: AppData;
  onStartTimer: (itemId: string) => void;
  onStopTimer: () => void;
  onUpdateItemStatus: (itemId: string, newStatus: ItemStatus) => void;
  onOpenEditItemModal: (item: ItemNode) => void;
  onOpenAddItemModal: () => void;
  onOpenProjectModal?: () => void;
  onDuplicateItem?: (itemId: string) => void;
  onReorderItem?: (itemId: string, direction: 'up' | 'down') => void;
  onReorderOrMoveItem?: (
    sourceItemId: string,
    targetItemId: string | null,
    position: 'before' | 'after',
    newStatus?: ItemStatus
  ) => void;
  onDeleteItem?: (itemId: string) => void;
  onSaveData?: (newData: AppData) => void;
  selectedProjectId?: string;
  onSelectProjectFilter?: (projectId: string) => void;
  selectedPersonId?: string;
  onSelectPersonFilter?: (personId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  sortBy?: TreeSortBy;
  onSortByChange?: (newSort: TreeSortBy) => void;
  sortDirection?: TreeSortDirection;
  onToggleSortDirection?: () => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  appData,
  onStartTimer,
  onStopTimer,
  onUpdateItemStatus,
  onOpenEditItemModal,
  onOpenAddItemModal,
  onOpenProjectModal,
  onDuplicateItem,
  onReorderItem,
  onReorderOrMoveItem,
  onDeleteItem,
  onSaveData,
  selectedProjectId = 'all',
  onSelectProjectFilter,
  selectedPersonId = 'all',
  onSelectPersonFilter,
  searchQuery = '',
  onSearchChange,
  sortBy: externalSortBy,
  onSortByChange: externalOnSortByChange,
  sortDirection: externalSortDirection,
  onToggleSortDirection: externalOnToggleSortDirection,
}) => {
  const [activeStatusAnchor, setActiveStatusAnchor] = useState<MenuAnchorState | null>(null);
  const [activeAssigneeAnchor, setActiveAssigneeAnchor] = useState<MenuAnchorState | null>(null);
  const [activeReviewerAnchor, setActiveReviewerAnchor] = useState<MenuAnchorState | null>(null);

  // Drag and Drop state
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverColStatus, setDragOverColStatus] = useState<ItemStatus | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    targetItemId: string;
    position: 'before' | 'after';
    colStatus: ItemStatus;
  } | null>(null);

  // Close active dropdowns on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveStatusAnchor(null);
        setActiveAssigneeAnchor(null);
        setActiveReviewerAnchor(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search and Project Filter states fallback
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const [internalSelectedProjectId, setInternalSelectedProjectId] = useState<string>('all');

  const currentProjectId = selectedProjectId !== undefined ? selectedProjectId : internalSelectedProjectId;
  const currentSearchQuery = searchQuery !== undefined ? searchQuery : internalSearchQuery;

  // Kanban Sorting State (Controlled from App.tsx or Fallback to LocalStorage)
  const [internalSortBy, setInternalSortBy] = useState<TreeSortBy>(() => {
    try {
      return (localStorage.getItem('tracker_kanban_sort_by') as TreeSortBy) || 'default';
    } catch {
      return 'default';
    }
  });

  const [internalSortDirection, setInternalSortDirection] = useState<TreeSortDirection>(() => {
    try {
      return (localStorage.getItem('tracker_kanban_sort_direction') as TreeSortDirection) || 'asc';
    } catch {
      return 'asc';
    }
  });

  const sortBy = externalSortBy !== undefined ? externalSortBy : internalSortBy;
  const sortDirection = externalSortDirection !== undefined ? externalSortDirection : internalSortDirection;

  const handleSortByChange = (newSort: TreeSortBy) => {
    if (externalOnSortByChange) {
      externalOnSortByChange(newSort);
    } else {
      setInternalSortBy(newSort);
      try {
        localStorage.setItem('tracker_kanban_sort_by', newSort);
      } catch {}
    }
  };

  const handleToggleSortDirection = () => {
    if (externalOnToggleSortDirection) {
      externalOnToggleSortDirection();
    } else {
      const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
      setInternalSortDirection(nextDir);
      try {
        localStorage.setItem('tracker_kanban_sort_direction', nextDir);
      } catch {}
    }
  };

  const handleFilterChange = (projId: string) => {
    if (onSelectProjectFilter) {
      onSelectProjectFilter(projId);
    } else {
      setInternalSelectedProjectId(projId);
    }
  };

  const handleSearchInputChange = (text: string) => {
    if (onSearchChange) {
      onSearchChange(text);
    } else {
      setInternalSearchQuery(text);
    }
  };

  const handleSetAssignee = (itemId: string, assigneeId: string | null) => {
    if (onSaveData) {
      const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
        ...item,
        assigneeId: assigneeId || undefined,
      }));
      onSaveData({ ...appData, projects: updatedProjects });
    }
    setActiveAssigneeAnchor(null);
  };

  const handleSetReviewer = (itemId: string, reviewerId: string | null) => {
    if (onSaveData) {
      const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
        ...item,
        reviewerId: reviewerId || undefined,
      }));
      onSaveData({ ...appData, projects: updatedProjects });
    }
    setActiveReviewerAnchor(null);
  };

  const activeProjects = appData.projects.filter((p) => p.status === 'active');
  const allFlatItems = getLeafFlatItems(activeProjects);
  const activeTimer = appData.settings.activeTimer;

  const isNoneProjects = currentProjectId === 'none';
  const isNonePersons = selectedPersonId === 'none';

  const selectedProjectIds = useMemo(() => {
    if (!currentProjectId || currentProjectId === 'all' || currentProjectId === 'none') return [];
    return currentProjectId.split(',').filter(Boolean);
  }, [currentProjectId]);

  const selectedPersonIds = useMemo(() => {
    if (!selectedPersonId || selectedPersonId === 'all' || selectedPersonId === 'none') return [];
    return selectedPersonId.split(',').filter(Boolean);
  }, [selectedPersonId]);

  // Filter tasks based on selected projects, selected persons, and search query
  const flatItems = allFlatItems.filter(({ item, project, parentPath }) => {
    if (isNoneProjects) return false;
    if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(project.id)) {
      return false;
    }
    if (isNonePersons) return false;
    if (selectedPersonIds.length > 0) {
      const matchAssignee = item.assigneeId && selectedPersonIds.includes(item.assigneeId);
      const matchReviewer = item.reviewerId && selectedPersonIds.includes(item.reviewerId);
      if (!matchAssignee && !matchReviewer) return false;
    }
    if (!currentSearchQuery.trim()) return true;
    const q = currentSearchQuery.toLowerCase().trim();
    if (item.name.toLowerCase().includes(q)) return true;
    if (item.notes && item.notes.toLowerCase().includes(q)) return true;
    if (project.title.toLowerCase().includes(q)) return true;
    if (parentPath && parentPath.some((p) => p.toLowerCase().includes(q))) return true;
    const assignee = appData.persons.find((p) => p.id === item.assigneeId);
    if (assignee && assignee.name.toLowerCase().includes(q)) return true;
    return false;
  });

  const columns: { status: ItemStatus; title: string; color: string }[] = [
    { status: 'not-started', title: 'Not Started', color: '#71717a' },
    { status: 'in-progress', title: 'In Progress', color: '#f97316' },
    { status: 'review', title: 'Review', color: '#f59e0b' },
    { status: 'completed', title: 'Completed', color: '#10b981' },
  ];

  const STATUS_SEQUENCE: ItemStatus[] = ['not-started', 'in-progress', 'review', 'completed'];

  const isDarkTheme = appData.settings.theme !== 'light';

  const getProjectCardStyle = (projectColor?: string) => {
    const color = projectColor || '#f97316';
    const bg = hexToRgba(color, 0.5);
    return {
      backgroundColor: bg,
      borderColor: color,
    };
  };

  const renderBreadcrumbs = (parentPath: string[], projectTitle: string) => {
    const effectivePath = parentPath && parentPath.length > 0 ? parentPath : [projectTitle];
    const fullPathStr = effectivePath.join(' > ');

    return (
      <div className="flex items-center gap-1 text-[11px] leading-tight font-normal min-w-0 flex-wrap" title={`Full Path: ${fullPathStr}`}>
        {effectivePath.map((seg, sIdx) => (
          <React.Fragment key={sIdx}>
            {sIdx > 0 && (
              <ChevronRight
                className={`w-2.5 h-2.5 shrink-0 ${isDarkTheme ? 'text-white/70' : 'text-slate-500'}`}
              />
            )}
            <span
              className={
                isDarkTheme
                  ? 'text-white font-normal truncate'
                  : sIdx === 0
                  ? 'text-slate-950 font-normal truncate'
                  : sIdx === effectivePath.length - 1
                  ? 'text-slate-800 font-normal truncate'
                  : 'text-slate-600 font-normal truncate'
              }
            >
              {seg}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1366px] mx-auto h-full flex flex-col min-h-0 pb-0">
      {/* Structural Toolbar */}
      <div className="shrink-0">
        <StructureToolbar
          isFullHeight={true}
          projects={appData.projects}
          selectedProjectId={currentProjectId}
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
          hasActiveTimer={!!appData.settings.activeTimer}
          appData={appData}
          onStopTimer={onStopTimer}
          onOpenEditItemModal={onOpenEditItemModal}
        />
      </div>

      {/* Board Area: full height, horizontal scroll if screen cannot fit 4 columns, no vertical outer scroll */}
      <div className="w-full flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-1 pt-2 pb-2 md:pb-2.5">
        <div className="flex flex-row items-stretch gap-3 md:gap-4 h-full min-h-0 w-full min-w-fit">
        {columns.map((col) => {
          const colItems = flatItems.filter((f) => f.item.status === col.status);
          if (sortBy !== 'default') {
            colItems.sort((a, b) => compareItems(a.item, b.item, sortBy, sortDirection));
          } else {
            colItems.sort((a, b) => {
              const orderA = a.item.kanbanOrder;
              const orderB = b.item.kanbanOrder;
              if (orderA !== undefined && orderB !== undefined) {
                return orderA - orderB;
              }
              if (orderA !== undefined) return -1;
              if (orderB !== undefined) return 1;
              return 0;
            });
          }

          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverColStatus !== col.status) {
                  setDragOverColStatus(col.status);
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOverColStatus(col.status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverColStatus === col.status) {
                    setDragOverColStatus(null);
                    setDropTarget(null);
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const droppedId = e.dataTransfer.getData('text/plain') || draggingItemId;
                const currentDrop = dropTarget;
                setDragOverColStatus(null);
                setDropTarget(null);
                setDraggingItemId(null);
                if (!droppedId) return;

                if (currentDrop && currentDrop.targetItemId) {
                  if (onReorderOrMoveItem) {
                    onReorderOrMoveItem(droppedId, currentDrop.targetItemId, currentDrop.position, col.status);
                  } else {
                    onUpdateItemStatus(droppedId, col.status);
                  }
                } else {
                  if (onReorderOrMoveItem) {
                    onReorderOrMoveItem(droppedId, null, 'after', col.status);
                  } else {
                    onUpdateItemStatus(droppedId, col.status);
                  }
                }
              }}
              className={`flex-1 min-w-[220px] sm:min-w-[230px] md:min-w-[240px] bg-[#121215] border rounded-lg p-3 flex flex-col h-full min-h-0 shrink-0 md:shrink transition-all duration-150 ${
                dragOverColStatus === col.status && !dropTarget
                  ? 'border-orange-500 ring-2 ring-orange-500/50 ring-inset bg-[#16161d] [data-theme=light]:bg-slate-100/90 shadow-sm'
                  : 'border-[#27272a]'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 mb-2 px-1 shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: col.color }}
                  ></span>
                  <span className="text-xs font-bold text-[#f4f4f5] [data-theme=light]:text-slate-800">{col.title}</span>
                  <span className="bg-[#27272a] [data-theme=light]:bg-slate-200 text-[#a1a1aa] [data-theme=light]:text-slate-600 text-[10px] font-mono px-2 py-0.5 rounded-full">
                    {colItems.length}
                  </span>
                </div>
              </div>

              {/* Cards List: Scrollbar inside each box only */}
              <div
                className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1 overscroll-contain"
                style={{ scrollbarWidth: 'thin' }}
              >
                {colItems.map(({ item, project, parentPath }) => {
                  const isRunning = activeTimer?.itemId === item.id;
                  const loggedSecs = getItemLoggedSeconds(
                    item,
                    activeTimer?.itemId,
                    activeTimer?.startedAt
                  );
                  const estSecs = item.estimatedSeconds || 0;
                  const assignee = appData.persons.find((p) => p.id === item.assigneeId);
                  const reviewer = item.reviewerId ? appData.persons.find((p) => p.id === item.reviewerId) : null;
                  const cardStyle = {
                    ...getProjectCardStyle(project.color),
                  };

                  const statusCfg = getStatusConfig(item.status);

                  return (
                    <React.Fragment key={item.id}>
                      {/* Insertion line indicator above target item */}
                      {dropTarget?.targetItemId === item.id && dropTarget.position === 'before' && draggingItemId !== item.id && (
                        <div className="flex items-center gap-1.5 py-1 -my-1.5 z-20">
                          <div className="w-2 h-2 rounded-full bg-orange-500 shadow-xs shrink-0" />
                          <div className="h-1 flex-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                          <div className="w-2 h-2 rounded-full bg-orange-500 shadow-xs shrink-0" />
                        </div>
                      )}

                      <div
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', item.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggingItemId(item.id);
                        }}
                        onDragEnd={() => {
                          setDraggingItemId(null);
                          setDragOverColStatus(null);
                          setDropTarget(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                          if (!draggingItemId || draggingItemId === item.id) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const offsetY = e.clientY - rect.top;
                          const position: 'before' | 'after' = offsetY < rect.height / 2 ? 'before' : 'after';
                          if (
                            !dropTarget ||
                            dropTarget.targetItemId !== item.id ||
                            dropTarget.position !== position ||
                            dropTarget.colStatus !== col.status
                          ) {
                            setDropTarget({ targetItemId: item.id, position, colStatus: col.status });
                            setDragOverColStatus(col.status);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const droppedId = e.dataTransfer.getData('text/plain') || draggingItemId;
                          const targetPos = dropTarget?.position || 'after';
                          setDropTarget(null);
                          setDragOverColStatus(null);
                          setDraggingItemId(null);
                          if (!droppedId) return;

                          if (onReorderOrMoveItem) {
                            onReorderOrMoveItem(droppedId, item.id, targetPos, col.status);
                          } else {
                            onUpdateItemStatus(droppedId, col.status);
                          }
                        }}
                        style={cardStyle}
                        onClick={() => onOpenEditItemModal(item)}
                        className={`rounded-lg p-3.5 space-y-2.5 transition-all cursor-grab active:cursor-grabbing group hover:brightness-105 border ${
                          isRunning
                            ? 'animate-pulse shadow-md'
                            : ''
                        } ${
                          draggingItemId === item.id
                            ? 'opacity-40 scale-[0.98] ring-2 ring-orange-500/50'
                            : ''
                        }`}
                      >
                      {/* Top Header: Breadcrumb with Edge-to-Edge Divider */}
                      <div
                        className={`-mt-3.5 -mx-3.5 px-3.5 pt-2.5 pb-2.5 border-b ${
                          isDarkTheme ? 'border-white/10' : 'border-black/10'
                        }`}
                      >
                        {renderBreadcrumbs(parentPath, project.title)}
                      </div>

                      {/* Title & Description (Notes) without Emoji Icon */}
                      <div className="flex flex-col min-w-0 w-full pt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-sm font-medium transition-colors line-clamp-2 no-underline text-[#f4f4f5] leading-snug">
                            {item.name}
                          </h4>
                        </div>

                        {item.notes && item.notes.trim().length > 0 && (
                          <p
                            className={`text-[11px] line-clamp-2 no-underline font-normal mt-0.5 leading-tight ${
                              isDarkTheme ? 'text-zinc-300' : 'text-slate-600'
                            }`}
                            title={item.notes}
                          >
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Time Progress Bar */}
                      {estSecs > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-slate-700 font-medium">
                            <span>Logged: {formatDuration(loggedSecs)}</span>
                            <span>Target: {formatDuration(estSecs)}</span>
                          </div>
                          <div className="w-full bg-black/15 h-1.5 rounded-full overflow-hidden border border-black/10">
                            <div
                              className="h-full rounded-full transition-all bg-orange-600"
                              style={{
                                width: `${Math.min(100, Math.round((loggedSecs / estSecs) * 100))}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Card Footer: Assignee & Timer & Status Action */}
                      <div className="pt-1 flex items-center justify-between">
                        {/* Assignee & Reviewer Avatar */}
                        <div className="flex items-center gap-1.5 h-6">
                          {/* Assignee Button & Droplist */}
                          <div className="relative shrink-0 flex items-center" data-popover-root>
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
                              className="flex items-center justify-center hover:opacity-80 cursor-pointer transition-all rounded-full"
                              title={assignee ? `Penerima: ${assignee.name} (Klik untuk mengganti)` : 'Belum ditugaskan (Klik untuk memilih)'}
                            >
                              {assignee ? (
                                <img
                                  src={assignee.avatar}
                                  alt={assignee.name}
                                  className="w-6 h-6 rounded-full object-cover border border-black/20 shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-slate-600 border border-black/20 hover:bg-black/10 shrink-0 transition-colors">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </button>

                            <PortalMenu
                              isOpen={activeAssigneeAnchor?.id === item.id}
                              onClose={() => setActiveAssigneeAnchor(null)}
                              anchorRect={activeAssigneeAnchor?.id === item.id ? activeAssigneeAnchor.rect : null}
                              triggerElement={activeAssigneeAnchor?.id === item.id ? activeAssigneeAnchor.el : null}
                              align="left"
                              className="w-48 flex flex-col gap-0.5 p-1"
                            >
                              <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#71717a]">
                                Tugaskan Anggota
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetAssignee(item.id, null);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#27272a] text-[#71717a] hover:text-[#f4f4f5] cursor-pointer text-left transition-colors"
                              >
                                <User className="w-4 h-4" />
                                <span>Belum ditugaskan</span>
                              </button>
                              {(appData.persons || []).map((person) => (
                                <button
                                  key={person.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetAssignee(item.id, person.id);
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

                          {/* Reviewer Button & Droplist */}
                          <div className="relative shrink-0 flex items-center" data-popover-root>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveReviewerAnchor(
                                  activeReviewerAnchor?.id === item.id
                                    ? null
                                    : { id: item.id, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }
                                );
                              }}
                              className="flex items-center justify-center hover:opacity-80 cursor-pointer transition-all rounded-full"
                              title={reviewer ? `Peninjau: ${reviewer.name} (Klik untuk mengganti)` : 'Tambah Peninjau (Klik untuk memilih)'}
                            >
                              {reviewer ? (
                                <img
                                  src={reviewer.avatar}
                                  alt={reviewer.name}
                                  className="w-6 h-6 rounded-full object-cover shrink-0"
                                  style={{ borderColor: 'var(--accent-main)', borderWidth: '2px', borderStyle: 'solid' }}
                                />
                              ) : (
                                <div
                                  className="w-6 h-6 rounded-full border border-dashed border-black/25 hover:border-black/50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shrink-0"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </button>

                            <PortalMenu
                              isOpen={activeReviewerAnchor?.id === item.id}
                              onClose={() => setActiveReviewerAnchor(null)}
                              anchorRect={activeReviewerAnchor?.id === item.id ? activeReviewerAnchor.rect : null}
                              triggerElement={activeReviewerAnchor?.id === item.id ? activeReviewerAnchor.el : null}
                              align="left"
                              className="w-48 flex flex-col gap-0.5 p-1"
                            >
                              <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#71717a]">
                                Pilih Peninjau (Reviewer)
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetReviewer(item.id, null);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#27272a] text-[#71717a] hover:text-[#f4f4f5] cursor-pointer text-left transition-colors"
                              >
                                <ShieldCheck className="w-4 h-4" />
                                <span>Tidak ada</span>
                              </button>
                              {(appData.persons || []).map((person) => (
                                <button
                                  key={person.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetReviewer(item.id, person.id);
                                  }}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#27272a] text-[#f4f4f5] cursor-pointer text-left transition-colors ${
                                    item.reviewerId === person.id ? 'font-semibold bg-[#27272a]' : ''
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
                        </div>

                        {/* Quick Move Status / Timer & Actions */}
                        <div className="flex items-center gap-1.5 h-6">
                          {isRunning ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStopTimer();
                              }}
                              className="h-6 px-2.5 rounded-full bg-[#ef4444] text-white text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer hover:bg-red-600 transition-colors shrink-0"
                            >
                              <Square className="w-2.5 h-2.5 fill-current" />
                              <span className="leading-none">Stop</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartTimer(item.id);
                              }}
                              className="w-6 h-6 rounded-full transition-all cursor-pointer bg-white hover:bg-zinc-100 text-black hover:scale-105 active:scale-95 flex items-center justify-center shrink-0"
                              title="Start Timer"
                            >
                              <Play className="w-2.5 h-2.5 fill-black text-black" />
                            </button>
                          )}

                          {/* Quick Change Status Pill Dropdown (Notion View style) */}
                          <div className="relative shrink-0 flex items-center" data-popover-root>
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
                              className="h-6 inline-flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-medium cursor-pointer transition-all hover:bg-zinc-100 bg-white text-zinc-900 select-none border-0 shrink-0"
                              title="Click to change task status"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusCfg.dotBg}`}
                              />
                              <span className="capitalize whitespace-nowrap text-zinc-900 font-medium leading-none">{statusCfg.label}</span>
                            </button>

                            {/* Status Dropdown Popover matching Notion View */}
                            <PortalMenu
                              isOpen={activeStatusAnchor?.id === item.id}
                              onClose={() => setActiveStatusAnchor(null)}
                              anchorRect={activeStatusAnchor?.id === item.id ? activeStatusAnchor.rect : null}
                              triggerElement={activeStatusAnchor?.id === item.id ? activeStatusAnchor.el : null}
                              align="right"
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
                        </div>
                      </div>
                    </div>

                    {/* Insertion line indicator below target item */}
                    {dropTarget?.targetItemId === item.id && dropTarget.position === 'after' && draggingItemId !== item.id && (
                      <div className="flex items-center gap-1.5 py-1 -my-1.5 z-20">
                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-xs shrink-0" />
                        <div className="h-1 flex-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-xs shrink-0" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

                {dragOverColStatus === col.status && draggingItemId && (
                  <div className="border border-dashed border-orange-500/60 bg-orange-500/10 rounded-lg p-3 text-center text-xs font-semibold text-orange-400 select-none animate-pulse">
                    Drop to set status to {col.title}
                  </div>
                )}

                {colItems.length === 0 && (!dragOverColStatus || dragOverColStatus !== col.status) && (
                  <div className="text-center py-8 text-[#71717a] text-xs font-mono">
                    Empty column
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};

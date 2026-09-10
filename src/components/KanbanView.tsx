import React, { useState, useEffect, useMemo } from 'react';
import { Play, Square, MoreHorizontal, Clock, User, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Copy, Check, ChevronRight, ChevronDown, Target, Folder, Search, X, Plus, Trash2, Edit2 } from 'lucide-react';
import { StructureToolbar } from './StructureToolbar';
import { PortalMenu } from './PortalMenu';
import { AppData, ItemNode, ItemStatus, ProjectNode } from '../types';
import { getLeafFlatItems, formatDuration, getItemLoggedSeconds, getStatusConfig } from '../utils/treeUtils';
import { TreeSortBy, TreeSortDirection, compareItems } from '../utils/treeSorting';

interface MenuAnchorState {
  id: string;
  rect: DOMRect;
  el: HTMLElement;
}

// Contrast helper to ensure text on dynamic project color backgrounds is always WCAG legible
const isLightColor = (hex?: string): boolean => {
  if (!hex || !hex.startsWith('#')) return false;
  const c = hex.replace('#', '');
  if (c.length !== 6 && c.length !== 3) return false;
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  // Threshold at 170: colors with YIQ < 170 (including orange, red, amber, green, blue) use crisp white text;
  // only genuinely bright/pale/pastel colors use dark text.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 170;
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
  onDeleteItem?: (itemId: string) => void;
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
  onDeleteItem,
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
  const [activeTaskMenuAnchor, setActiveTaskMenuAnchor] = useState<MenuAnchorState | null>(null);

  // Close active dropdowns on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveStatusAnchor(null);
        setActiveTaskMenuAnchor(null);
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

  const getProjectCardStyle = (projectColor?: string, isRunning?: boolean) => {
    const bg = projectColor || '#18181b';
    if (isRunning) {
      return {
        backgroundColor: bg,
        borderColor: 'var(--accent-main, #f97316)',
        boxShadow: '0 0 0 2px var(--accent-main, #f97316)',
      };
    }
    return {
      backgroundColor: bg,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    };
  };

  const renderBreadcrumbs = (parentPath: string[], projectTitle: string, projectColor?: string, isLightBg?: boolean) => {
    const effectivePath = parentPath && parentPath.length > 0 ? parentPath : [projectTitle];
    const fullPathStr = effectivePath.join(' > ');

    return (
      <div className="flex items-center gap-1 text-[10px] font-mono min-w-0 flex-wrap" title={`Full Path: ${fullPathStr}`}>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isLightBg ? 'border border-black/30' : 'border border-white/40'}`}
          style={{ backgroundColor: projectColor || 'var(--accent-main, #f97316)' }}
        />
        {effectivePath.map((seg, sIdx) => (
          <React.Fragment key={sIdx}>
            {sIdx > 0 && (
              <ChevronRight
                className={`w-2.5 h-2.5 shrink-0 ${
                  isLightBg ? 'text-black/40' : 'text-white/40'
                }`}
              />
            )}
            <span
              className={
                sIdx === 0
                  ? isLightBg
                    ? 'text-slate-950 font-bold truncate'
                    : 'text-white font-bold truncate'
                  : sIdx === effectivePath.length - 1
                  ? isLightBg
                    ? 'text-slate-900 font-medium truncate'
                    : 'text-white/90 font-medium truncate'
                  : isLightBg
                  ? 'text-slate-700 truncate'
                  : 'text-white/70 truncate'
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
    <div className="w-full h-full flex flex-col min-h-0 pb-0">
      {/* Structural Toolbar */}
      <div className="shrink-0">
        <StructureToolbar
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
      <div className="w-full flex-1 min-h-0 overflow-x-auto overflow-y-hidden pt-2.5 pb-2.5 md:pb-3">
        <div className="flex flex-row items-stretch gap-3 md:gap-4 h-full min-h-0 w-full min-w-fit">
        {columns.map((col) => {
          const colItems = flatItems.filter((f) => f.item.status === col.status);
          if (sortBy !== 'default') {
            colItems.sort((a, b) => compareItems(a.item, b.item, sortBy, sortDirection));
          }

          return (
            <div
              key={col.status}
              className="flex-1 min-w-[260px] sm:min-w-[270px] bg-[#121215] border border-[#27272a] rounded-lg p-3 flex flex-col h-full min-h-0 shrink-0"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#27272a] px-1 shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: col.color }}
                  ></span>
                  <span className="text-xs font-bold text-[#f4f4f5]">{col.title}</span>
                  <span className="bg-[#27272a] text-[#a1a1aa] text-[10px] font-mono px-2 py-0.5 rounded-full">
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
                  const cardStyle = getProjectCardStyle(project.color, isRunning);
                  const fullBreadcrumb =
                    parentPath && parentPath.length > 0
                      ? parentPath.join(' > ')
                      : project.title;

                  const statusCfg = getStatusConfig(item.status);
                  const isLightBg = isLightColor(project.color);

                  return (
                    <div
                      key={item.id}
                      style={cardStyle}
                      onClick={() => onOpenEditItemModal(item)}
                      className="border rounded-lg p-3.5 space-y-2.5 transition-all cursor-pointer group shadow-sm hover:brightness-105"
                    >
                      {/* Top Header: Breadcrumb & More/Move Menu */}
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          {renderBreadcrumbs(parentPath, project.title, project.color, isLightBg)}
                        </div>

                        {/* Card Actions / Move Dropdown */}
                        <div className="relative shrink-0" data-popover-root>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTaskMenuAnchor(
                                activeTaskMenuAnchor?.id === item.id
                                  ? null
                                  : { id: item.id, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }
                              );
                            }}
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              isLightBg
                                ? 'text-slate-700 hover:text-black hover:bg-black/10'
                                : 'text-white/80 hover:text-white hover:bg-white/10'
                            }`}
                            title="Task Actions & Move"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          <PortalMenu
                            isOpen={activeTaskMenuAnchor?.id === item.id}
                            onClose={() => setActiveTaskMenuAnchor(null)}
                            anchorRect={activeTaskMenuAnchor?.id === item.id ? activeTaskMenuAnchor.rect : null}
                            triggerElement={activeTaskMenuAnchor?.id === item.id ? activeTaskMenuAnchor.el : null}
                            align="right"
                            className="w-44 flex flex-col gap-0.5 p-1"
                          >
                            {/* Move Left */}
                            {col.status !== 'not-started' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const curIdx = STATUS_SEQUENCE.indexOf(item.status);
                                  if (curIdx > 0) {
                                    onUpdateItemStatus(item.id, STATUS_SEQUENCE[curIdx - 1]);
                                  }
                                  setActiveTaskMenuAnchor(null);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#f4f4f5] hover:bg-[#27272a] cursor-pointer text-left transition-colors"
                              >
                                <ArrowLeft className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                <span>Move Left</span>
                              </button>
                            )}

                            {/* Move Right */}
                            {col.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const curIdx = STATUS_SEQUENCE.indexOf(item.status);
                                  if (curIdx >= 0 && curIdx < STATUS_SEQUENCE.length - 1) {
                                    onUpdateItemStatus(item.id, STATUS_SEQUENCE[curIdx + 1]);
                                  }
                                  setActiveTaskMenuAnchor(null);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#f4f4f5] hover:bg-[#27272a] cursor-pointer text-left transition-colors"
                              >
                                <ArrowRight className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                <span>Move Right</span>
                              </button>
                            )}

                            {/* Move Up */}
                            {onReorderItem && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReorderItem(item.id, 'up');
                                  setActiveTaskMenuAnchor(null);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#f4f4f5] hover:bg-[#27272a] cursor-pointer text-left transition-colors"
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                <span>Move Up</span>
                              </button>
                            )}

                            {/* Move Down */}
                            {onReorderItem && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReorderItem(item.id, 'down');
                                  setActiveTaskMenuAnchor(null);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#f4f4f5] hover:bg-[#27272a] cursor-pointer text-left transition-colors"
                              >
                                <ArrowDown className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                <span>Move Down</span>
                              </button>
                            )}

                            <div className="my-1 border-t border-[#27272a]" />

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTaskMenuAnchor(null);
                                onOpenEditItemModal(item);
                              }}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#f4f4f5] hover:bg-[#27272a] cursor-pointer text-left transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#a1a1aa]" />
                              <span>Edit Details</span>
                            </button>

                            {/* Duplicate */}
                            {onDuplicateItem && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTaskMenuAnchor(null);
                                  onDuplicateItem(item.id);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#f4f4f5] hover:bg-[#27272a] cursor-pointer text-left transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5 text-[#a1a1aa]" />
                                <span>Duplicate</span>
                              </button>
                            )}

                            {/* Delete */}
                            {onDeleteItem && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTaskMenuAnchor(null);
                                  onDeleteItem(item.id);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer text-left transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                <span>Delete Task</span>
                              </button>
                            )}
                          </PortalMenu>
                        </div>
                      </div>

                      {/* Title */}
                      <h4
                        className={`text-xs font-bold transition-colors line-clamp-2 flex items-center gap-1.5 no-underline ${
                          item.status === 'completed'
                            ? isLightBg
                              ? 'text-slate-600'
                              : 'text-white/60'
                            : isLightBg
                            ? 'text-slate-950'
                            : 'text-white'
                        }`}
                      >
                        {item.status === 'completed' && (
                          <Check
                            className={`w-3.5 h-3.5 ${
                              isLightBg ? 'text-slate-950' : 'text-emerald-300'
                            } shrink-0`}
                          />
                        )}
                        <span>{item.name}</span>
                      </h4>

                      {/* Notes snippet if present */}
                      {item.notes && (
                        <p
                          className={`text-[11px] line-clamp-2 no-underline ${
                            isLightBg ? 'text-slate-800' : 'text-white/85'
                          }`}
                        >
                          {item.notes}
                        </p>
                      )}

                      {/* Time Progress Bar */}
                      {estSecs > 0 && (
                        <div className="space-y-1">
                          <div
                            className={`flex justify-between text-[10px] font-mono ${
                              isLightBg ? 'text-slate-800' : 'text-white/85'
                            }`}
                          >
                            <span>Logged: {formatDuration(loggedSecs)}</span>
                            <span>Target: {formatDuration(estSecs)}</span>
                          </div>
                          <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden border border-black/10">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isLightBg ? 'bg-slate-900' : 'bg-white'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.round((loggedSecs / estSecs) * 100))}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Card Footer: Assignee & Timer & Status Action */}
                      <div
                        className={`pt-2 border-t flex items-center justify-between ${
                          isLightBg ? 'border-black/15' : 'border-white/15'
                        }`}
                      >
                        {/* Assignee & Reviewer Avatar */}
                        <div className="flex items-center gap-1.5">
                          {assignee ? (
                            <img
                              src={assignee.avatar}
                              alt={assignee.name}
                              className="w-5 h-5 rounded-full object-cover border border-[#3f3f46]"
                              title={`Penerima: ${assignee.name}`}
                            />
                          ) : (
                            <User
                              className={`w-4 h-4 ${
                                isLightBg ? 'text-slate-700' : 'text-white/70'
                              }`}
                            />
                          )}

                          {reviewer && (
                            <div className="relative group/rev" title={`Peninjau: ${reviewer.name}`}>
                              <img
                                src={reviewer.avatar}
                                alt={reviewer.name}
                                className="w-5 h-5 rounded-full object-cover border border-amber-500/60 ring-1 ring-amber-500/30"
                              />
                              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-[#18181b]" />
                            </div>
                          )}
                        </div>

                        {/* Quick Move Status / Timer */}
                        <div className="flex items-center gap-1.5">
                          {isRunning ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStopTimer();
                              }}
                              className="bg-[#ef4444] text-white p-1 rounded-full text-[10px] flex items-center gap-1 px-2 font-mono shadow-sm cursor-pointer"
                            >
                              <Square className="w-3 h-3 fill-current" /> Stop
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartTimer(item.id);
                              }}
                              className={`p-1.5 rounded-full transition-colors border cursor-pointer ${
                                isLightBg
                                  ? 'bg-black/10 hover:bg-black/20 text-slate-900 border-black/20'
                                  : 'bg-white/15 hover:bg-white/25 text-white border-white/25'
                              }`}
                              title="Start Timer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                          )}

                          {/* Quick Change Status Pill Dropdown (Notion View style) */}
                          <div className="relative" data-popover-root>
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
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:opacity-85 border ${
                                isLightBg
                                  ? 'bg-black/10 text-slate-950 border-black/20'
                                  : `${statusCfg.badgeBorder} ${statusCfg.badgeBg} ${statusCfg.textColor}`
                              }`}
                              title="Click to change task status"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotBg}`}
                              />
                              <span className="capitalize whitespace-nowrap">{statusCfg.label}</span>
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
                  );
                })}

                {colItems.length === 0 && (
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

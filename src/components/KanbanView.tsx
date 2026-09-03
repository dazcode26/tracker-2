import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, MoreHorizontal, Clock, User, ArrowRight, Copy, Check, ChevronRight, ChevronDown, Target, Folder, Search, X, Plus } from 'lucide-react';
import { StructureToolbar } from './StructureToolbar';
import { AppData, ItemNode, ItemStatus, ProjectNode } from '../types';
import { getLeafFlatItems, formatDuration, getItemLoggedSeconds } from '../utils/treeUtils';

interface KanbanViewProps {
  appData: AppData;
  onStartTimer: (itemId: string) => void;
  onStopTimer: () => void;
  onUpdateItemStatus: (itemId: string, newStatus: ItemStatus) => void;
  onOpenEditItemModal: (item: ItemNode) => void;
  onOpenAddItemModal: () => void;
  onOpenProjectModal?: () => void;
  onDuplicateItem?: (itemId: string) => void;
  selectedProjectId?: string;
  onSelectProjectFilter?: (projectId: string) => void;
  selectedPersonId?: string;
  onSelectPersonFilter?: (personId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const statusConfigs: Record<ItemStatus, { label: string; badge: string; text: string; bg: string }> = {
  'not-started': {
    label: 'Not Started',
    badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    text: 'text-zinc-400',
    bg: 'bg-zinc-700',
  },
  'in-progress': {
    label: 'In Progress',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    text: 'text-blue-400',
    bg: 'bg-blue-500',
  },
  'review': {
    label: 'In Review',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    text: 'text-amber-400',
    bg: 'bg-amber-500',
  },
  'completed': {
    label: 'Completed',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
  },
};

export const KanbanView: React.FC<KanbanViewProps> = ({
  appData,
  onStartTimer,
  onStopTimer,
  onUpdateItemStatus,
  onOpenEditItemModal,
  onOpenAddItemModal,
  onOpenProjectModal,
  onDuplicateItem,
  selectedProjectId = 'all',
  onSelectProjectFilter,
  selectedPersonId = 'all',
  onSelectPersonFilter,
  searchQuery = '',
  onSearchChange,
}) => {
  const [activeStatusDropdownId, setActiveStatusDropdownId] = useState<string | null>(null);

  // Search and Project Filter states fallback
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const [internalSelectedProjectId, setInternalSelectedProjectId] = useState<string>('all');
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState<boolean>(false);
  const projectFilterRef = useRef<HTMLDivElement>(null);

  const currentProjectId = selectedProjectId !== undefined ? selectedProjectId : internalSelectedProjectId;
  const currentSearchQuery = searchQuery !== undefined ? searchQuery : internalSearchQuery;

  const handleFilterChange = (projId: string) => {
    if (onSelectProjectFilter) {
      onSelectProjectFilter(projId);
    } else {
      setInternalSelectedProjectId(projId);
    }
    setIsProjectFilterOpen(false);
  };

  const handleSearchInputChange = (text: string) => {
    if (onSearchChange) {
      onSearchChange(text);
    } else {
      setInternalSearchQuery(text);
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

  const activeProjects = appData.projects.filter((p) => p.status === 'active');
  const allFlatItems = getLeafFlatItems(activeProjects);
  const activeTimer = appData.settings.activeTimer;

  // Filter tasks based on selected project, selected person, and search query
  const flatItems = allFlatItems.filter(({ item, project, parentPath }) => {
    if (currentProjectId !== 'all' && project.id !== currentProjectId) {
      return false;
    }
    if (selectedPersonId && selectedPersonId !== 'all') {
      const matchAssignee = item.assigneeId === selectedPersonId;
      const matchReviewer = item.reviewerId === selectedPersonId;
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

  const getProjectCardStyle = (projectColor?: string, isRunning?: boolean) => {
    if (isRunning) {
      return {
        backgroundColor: 'rgba(249, 115, 22, 0.18)',
        borderColor: 'rgba(249, 115, 22, 0.7)',
      };
    }
    if (!projectColor) {
      return {
        backgroundColor: '#18181b',
        borderColor: '#27272a',
      };
    }

    const cleanHex = projectColor.replace('#', '').trim();
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
        borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
      };
    } else if (cleanHex.length === 3) {
      const r = parseInt(cleanHex[0] + cleanHex[0], 16);
      const g = parseInt(cleanHex[1] + cleanHex[1], 16);
      const b = parseInt(cleanHex[2] + cleanHex[2], 16);
      return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
        borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
      };
    }

    return {
      backgroundColor: `${projectColor}18`,
      borderColor: `${projectColor}45`,
    };
  };

  const renderBreadcrumbs = (parentPath: string[], projectTitle: string, projectColor?: string) => {
    const effectivePath = parentPath && parentPath.length > 0 ? parentPath : [projectTitle];
    const fullPathStr = effectivePath.join(' > ');

    if (effectivePath.length <= 1) {
      return (
        <div className="flex items-center gap-1.5 min-w-0" title={`Full Path: ${fullPathStr}`}>
          <span
            className="w-2 h-2 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: projectColor || '#f97316' }}
          />
          <span className="text-orange-400 font-bold truncate">
            {effectivePath[0] || projectTitle}
          </span>
        </div>
      );
    }

    if (effectivePath.length === 2) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-mono min-w-0 flex-wrap" title={`Full Path: ${fullPathStr}`}>
          <span
            className="w-2 h-2 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: projectColor || '#f97316' }}
          />
          <span className="text-orange-400 font-bold truncate">{effectivePath[0]}</span>
          <ChevronRight className="w-2.5 h-2.5 text-[#52525b] shrink-0" />
          <span className="text-[#a1a1aa] font-medium truncate">{effectivePath[1]}</span>
        </div>
      );
    }

    // When 3 or more segments (e.g. Project > Section > SubTask), prioritize right ancestors: ".... > sub-task > sub-sub-task"
    const visibleRightAncestors = effectivePath.slice(-2);
    return (
      <div className="flex items-center gap-1 text-[10px] font-mono min-w-0 flex-wrap" title={`Full Path: ${fullPathStr}`}>
        <span
          className="w-2 h-2 rounded-full shrink-0 shadow-sm"
          style={{ backgroundColor: projectColor || '#f97316' }}
        />
        <span className="text-[#71717a] font-bold tracking-widest cursor-help shrink-0" title={`Full Path: ${fullPathStr}`}>
          ....
        </span>
        {visibleRightAncestors.map((seg, sIdx) => (
          <React.Fragment key={sIdx}>
            <ChevronRight className="w-2.5 h-2.5 text-[#52525b] shrink-0" />
            <span
              className={`truncate ${
                sIdx === visibleRightAncestors.length - 1 ? 'text-[#d4d4d8] font-semibold' : 'text-[#a1a1aa]'
              }`}
            >
              {seg}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-16">
      {/* Structural Toolbar */}
      <StructureToolbar
        projects={appData.projects}
        selectedProjectId={currentProjectId}
        onSelectProject={handleFilterChange}
        persons={appData.persons}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPersonFilter}
        searchQuery={currentSearchQuery}
        onSearchChange={handleSearchInputChange}
        onOpenProjectModal={onOpenProjectModal}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const colItems = flatItems.filter((f) => f.item.status === col.status);

          return (
            <div
              key={col.status}
              className="bg-[#121215] border border-[#27272a] rounded-xl p-3 flex flex-col min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#27272a] px-1">
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

              {/* Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[650px] pr-1">
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

                  const conf = statusConfigs[item.status] || statusConfigs['in-progress'];
                  const isStatusOpen = activeStatusDropdownId === item.id;

                  return (
                    <div
                      key={item.id}
                      style={cardStyle}
                      onClick={() => onOpenEditItemModal(item)}
                      className={`border rounded-xl p-3.5 space-y-2.5 shadow-md hover:brightness-110 transition-all cursor-pointer group ${
                        isRunning ? 'ring-2 ring-orange-500/50' : ''
                      }`}
                    >
                      {/* Breadcrumb / Project Tag */}
                      <div className="flex items-center justify-between text-[10px] text-[#71717a] font-mono min-w-0">
                        {renderBreadcrumbs(parentPath, project.title, project.color)}
                      </div>

                      {/* Title */}
                      <h4
                        className={`text-xs font-bold transition-colors line-clamp-2 flex items-center gap-1.5 ${
                          item.status === 'completed'
                            ? 'text-[#71717a]'
                            : 'text-[#f4f4f5] group-hover:text-white'
                        }`}
                      >
                        {item.status === 'completed' && (
                          <Check className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                        )}
                        <span>{item.name}</span>
                      </h4>

                      {/* Notes snippet if present */}
                      {item.notes && (
                        <p className="text-[11px] text-[#a1a1aa] line-clamp-2">{item.notes}</p>
                      )}

                      {/* Time Progress Bar */}
                      {estSecs > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-[#a1a1aa]">
                            <span>Logged: {formatDuration(loggedSecs)}</span>
                            <span>Target: {formatDuration(estSecs)}</span>
                          </div>
                          <div className="w-full bg-[#18181b] h-1.5 rounded-full overflow-hidden border border-[#27272a]">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                backgroundColor: project.color || '#f4f4f5',
                                width: `${Math.min(100, Math.round((loggedSecs / estSecs) * 100))}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Card Footer: Assignee & Timer & Status Action */}
                      <div className="pt-2 border-t border-[#3f3f46]/40 flex items-center justify-between">
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
                            <User className="w-4 h-4 text-[#71717a]" />
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
                              className="bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5] p-1.5 rounded-full transition-colors border border-[#3f3f46] cursor-pointer"
                              title="Start Timer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                          )}

                          {/* Quick Change Status Pill Dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveStatusDropdownId(isStatusOpen ? null : item.id);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer hover:brightness-125 shadow-xs ${conf.badge}`}
                              title="Click to change task status"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${conf.bg}`} />
                              <span>{conf.label}</span>
                              <ChevronDown className={`w-3 h-3 opacity-70 transition-transform duration-150 ${isStatusOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isStatusOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveStatusDropdownId(null);
                                  }}
                                />
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 bottom-full mb-1.5 w-44 bg-[#18181b] border border-[#3f3f46] rounded-xl shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                                >
                                  {(['not-started', 'in-progress', 'review', 'completed'] as ItemStatus[]).map((st) => {
                                    const optConfig = statusConfigs[st];
                                    const isSelected = item.status === st;
                                    return (
                                      <div
                                        key={st}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onUpdateItemStatus(item.id, st);
                                          setActiveStatusDropdownId(null);
                                        }}
                                        className={`p-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                                          isSelected
                                            ? `${optConfig.badge} font-bold`
                                            : 'text-[#d4d4d8] hover:bg-[#27272a]'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className={`w-2 h-2 rounded-full ${optConfig.bg}`} />
                                          <span className="text-xs">{optConfig.label}</span>
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-orange-400" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
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
  );
};

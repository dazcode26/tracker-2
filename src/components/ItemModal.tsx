import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  FileText,
  AlertTriangle,
  Trash2,
  History,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FolderTree,
  Copy,
  Check,
  ArrowLeft,
  MoreHorizontal,
  Play,
  Square,
  UserPlus,
  UserCheck,
  Folder,
  Eye,
  ExternalLink,
  Plus,
  CalendarRange,
  Target,
  Search,
  CheckSquare,
} from 'lucide-react';
import { ItemNode, ItemStatus, Person, Session, ProjectNode } from '../types';
import {
  validateRealizationDates,
  formatDuration,
  computeActualDatesFromSessions,
  getDescendantIds,
  findItemAndProject,
  getStatusConfig,
  sortSessionsOldestFirst,
} from '../utils/treeUtils';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveItem: (itemData: Partial<ItemNode> & { targetParentId?: string | 'root'; targetProjectId?: string }) => void;
  onDuplicateItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onStartTimer?: (itemId: string) => void;
  onStopTimer?: () => void;
  isTimerRunning?: boolean;
  initialItem?: ItemNode | null;
  initialTargetDate?: string | null;
  parentItemId?: string | null;
  currentProjectId?: string | null;
  projects?: ProjectNode[];
  persons: Person[];
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSaveItem,
  onDuplicateItem,
  onDeleteItem,
  onStartTimer,
  onStopTimer,
  isTimerRunning = false,
  initialItem,
  initialTargetDate,
  parentItemId,
  currentProjectId,
  projects = [],
  persons,
}) => {
  const [name, setName] = useState<string>('');
  const [status, setStatus] = useState<ItemStatus>('in-progress');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string>('');
  const [actualStartDate, setActualStartDate] = useState<string>('');
  const [actualEndDate, setActualEndDate] = useState<string>('');
  const [estimatedHours, setEstimatedHours] = useState<string | number>('');
  const [notes, setNotes] = useState<string>('');
  const [isNotesPreviewMode, setIsNotesPreviewMode] = useState<boolean>(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showInSummary, setShowInSummary] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New period creation state
  const [isAddingPeriod, setIsAddingPeriod] = useState<boolean>(false);
  const [newPeriodStart, setNewPeriodStart] = useState<string>('');
  const [newPeriodEnd, setNewPeriodEnd] = useState<string>('');
  const [newPeriodTitle, setNewPeriodTitle] = useState<string>('');

  // Dropdown menus
  const [isStatusPickerOpen, setIsStatusPickerOpen] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState<boolean>(false);
  const [isReviewerPickerOpen, setIsReviewerPickerOpen] = useState<boolean>(false);

  // Hierarchy
  const [selectedParentId, setSelectedParentId] = useState<string>('root');
  const [selectedTargetProjectId, setSelectedTargetProjectId] = useState<string>('');
  const [isParentPickerOpen, setIsParentPickerOpen] = useState<boolean>(false);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState<boolean>(false);
  const [parentSearchQuery, setParentSearchQuery] = useState<string>('');
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
  const parentPickerRef = useRef<HTMLDivElement>(null);
  const projectPickerRef = useRef<HTMLDivElement>(null);

  const targetDateInputRef = useRef<HTMLInputElement>(null);
  const actualStartInputRef = useRef<HTMLInputElement>(null);
  const actualEndInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setErrorMsg(null);
    setIsStatusPickerOpen(false);
    setIsMoreMenuOpen(false);
    setIsAssigneePickerOpen(false);
    setIsReviewerPickerOpen(false);
    setIsAddingPeriod(false);
    setNewPeriodStart('');
    setNewPeriodEnd('');
    setNewPeriodTitle('');

    if (initialItem) {
      setName(initialItem.name || '');
      setStatus(initialItem.status || 'not-started');
      setAssigneeId(initialItem.assigneeId || persons[0]?.id || '');
      setReviewerId(initialItem.reviewerId || null);
      setTargetDate(
        initialItem.targetDate
          ? new Date(initialItem.targetDate).toISOString().split('T')[0]
          : ''
      );

      // Migrate / sync sessions array (Option 1) with auto-sort oldest date first
      let initialSessions = Array.isArray(initialItem.sessions)
        ? sortSessionsOldestFirst(initialItem.sessions)
        : [];
      if (initialSessions.length === 0 && initialItem.actualStartDate) {
        initialSessions = [
          {
            id: `manual-init-${initialItem.id}`,
            type: 'manual-range',
            startedAt: initialItem.actualStartDate,
            endedAt: initialItem.actualEndDate || initialItem.actualStartDate,
            loggedSeconds: 0,
            title: 'Realization Period',
          },
        ];
      }
      setSessions(initialSessions);

      const computed = computeActualDatesFromSessions(
        initialSessions,
        initialItem.actualStartDate,
        initialItem.actualEndDate
      );
      setActualStartDate(computed.actualStartDate || '');
      setActualEndDate(computed.actualEndDate || '');

      setEstimatedHours(
        initialItem.estimatedSeconds !== undefined && initialItem.estimatedSeconds > 0
          ? (initialItem.estimatedSeconds / 3600).toString()
          : ''
      );
      setNotes(initialItem.notes || '');
      setIsNotesPreviewMode(true);
      setShowInSummary(initialItem.showInSummary === true);

      // Find current parent and project
      if (projects.length > 0) {
        const found = findItemAndProject(projects, initialItem.id);
        if (found) {
          setSelectedTargetProjectId(found.project.id);
          setSelectedParentId(found.parent ? found.parent.id : 'root');
        } else if (currentProjectId) {
          setSelectedTargetProjectId(currentProjectId);
          setSelectedParentId(parentItemId || 'root');
        }
      }
    } else {
      setName('');
      setStatus('not-started');
      setAssigneeId(persons[0]?.id || '');
      setReviewerId(null);
      setEstimatedHours('');
      setNotes('');

      // If initialTargetDate is provided from clicking on the calendar:
      // Prepopulate the Realization Period (Add Period), NOT the Due Date!
      if (initialTargetDate) {
        const clickedDate = initialTargetDate.split('T')[0];
        setTargetDate('');
        setActualStartDate(clickedDate);
        setActualEndDate(clickedDate);
        setSessions([
          {
            id: `manual-init-${Date.now()}`,
            type: 'manual-range',
            startedAt: `${clickedDate}T00:00:00.000Z`,
            endedAt: `${clickedDate}T00:00:00.000Z`,
            loggedSeconds: 0,
            title: 'Realization Period',
          },
        ]);
        setShowInSummary(true);
      } else {
        setTargetDate('');
        setActualStartDate('');
        setActualEndDate('');
        setSessions([]);
        setShowInSummary(false);
      }

      setSelectedParentId(parentItemId || 'root');
      const validTargetProjId =
        currentProjectId && currentProjectId !== 'all'
          ? (currentProjectId.includes(',') ? currentProjectId.split(',')[0] : currentProjectId)
          : (projects[0]?.id || '');
      setSelectedTargetProjectId(validTargetProjId);
    }
  }, [initialItem, initialTargetDate, isOpen, persons, parentItemId, currentProjectId, projects]);

  const currentAssignee = persons.find((p) => p.id === assigneeId) || persons[0] || {
    id: 'unknown',
    name: 'Unassigned',
    role: 'Team Member',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
  };

  const currentReviewer = reviewerId ? persons.find((p) => p.id === reviewerId) : null;

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

  const formatDisplayDate = (dateStr?: string | null): string => {
    if (!dateStr) return 'Select date';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const totalLoggedSecs = sessions.reduce((acc, s) => acc + (s.loggedSeconds || 0), 0);

  // Build hierarchy parent choices
  const excludedIds = initialItem ? getDescendantIds(initialItem) : new Set<string>();
  const activeProj = projects.find((p) => p.id === (selectedTargetProjectId || currentProjectId)) || projects[0];

  interface FlatCandidate {
    id: string;
    name: string;
    level: number;
    breadcrumbs: string[];
  }

  const candidateParents: FlatCandidate[] = [];
  function collectCandidateParents(items: ItemNode[], currentLevel = 1, currentPath: string[] = []) {
    for (const item of items) {
      if (!excludedIds.has(item.id)) {
        candidateParents.push({
          id: item.id,
          name: item.name,
          level: currentLevel,
          breadcrumbs: currentPath,
        });
        if (item.subItems && item.subItems.length > 0) {
          collectCandidateParents(item.subItems, currentLevel + 1, [...currentPath, item.name]);
        }
      }
    }
  }

  if (activeProj && activeProj.items) {
    collectCandidateParents(activeProj.items, 1, []);
  }

  // Selected parent info
  const selectedParentInfo = selectedParentId === 'root'
    ? null
    : candidateParents.find((c) => c.id === selectedParentId);

  // Helper to toggle expand/collapse in tree picker
  const toggleExpandParent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAllParents = () => {
    const allIds = new Set<string>();
    candidateParents.forEach((c) => {
      allIds.add(c.id);
    });
    setExpandedParentIds(allIds);
  };

  const collapseAllParents = () => {
    setExpandedParentIds(new Set());
  };

  // Close parent and project pickers on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (parentPickerRef.current && !parentPickerRef.current.contains(event.target as Node)) {
        setIsParentPickerOpen(false);
      }
      if (projectPickerRef.current && !projectPickerRef.current.contains(event.target as Node)) {
        setIsProjectPickerOpen(false);
      }
    };
    if (isParentPickerOpen || isProjectPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isParentPickerOpen, isProjectPickerOpen]);

  const handleAddManualPeriod = () => {
    if (!newPeriodStart) {
      setErrorMsg('Please select a start date for the work period.');
      return;
    }
    setErrorMsg(null);

    const startIso = new Date(newPeriodStart).toISOString();
    const endIso = newPeriodEnd
      ? new Date(newPeriodEnd).toISOString()
      : startIso;

    if (new Date(startIso) > new Date(endIso)) {
      setErrorMsg('Period start date cannot be after end date.');
      return;
    }

    const newPeriod: Session = {
      id: `period-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'manual-range',
      startedAt: startIso,
      endedAt: endIso,
      loggedSeconds: 0,
      title: newPeriodTitle.trim() || undefined,
    };

    const updatedSessions = sortSessionsOldestFirst([...sessions, newPeriod]);
    setSessions(updatedSessions);
    const computed = computeActualDatesFromSessions(updatedSessions);
    setActualStartDate(computed.actualStartDate || '');
    setActualEndDate(computed.actualEndDate || '');
    setShowInSummary(true);

    setNewPeriodStart('');
    setNewPeriodEnd('');
    setNewPeriodTitle('');
    setIsAddingPeriod(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    const updatedSessions = sortSessionsOldestFirst(sessions.filter((s) => s.id !== sessionId));
    setSessions(updatedSessions);
    const computed = computeActualDatesFromSessions(updatedSessions);
    setActualStartDate(computed.actualStartDate || '');
    setActualEndDate(computed.actualEndDate || '');
  };

  const handleClearAllPeriods = () => {
    setSessions([]);
    setActualStartDate('');
    setActualEndDate('');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const taskTitle = name.trim();
    if (!taskTitle) {
      setErrorMsg('Task name is required.');
      return;
    }

    const valResult = validateRealizationDates(sessions, actualStartDate || null, actualEndDate || null);
    if (!valResult.valid) {
      setErrorMsg(valResult.error || 'Conflict between realization dates and timer history.');
      return;
    }

    const hoursNum = typeof estimatedHours === 'number' ? estimatedHours : parseFloat(String(estimatedHours));
    const calculatedEstimatedSeconds = !isNaN(hoursNum) && hoursNum > 0 ? Math.round(hoursNum * 3600) : 0;

    const validTargetProjectId =
      selectedTargetProjectId && selectedTargetProjectId !== 'all'
        ? selectedTargetProjectId
        : (activeProj?.id || projects[0]?.id || '');

    onSaveItem({
      name: taskTitle,
      status,
      assigneeId: currentAssignee.id,
      reviewerId: reviewerId || null,
      targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
      actualStartDate: actualStartDate ? new Date(actualStartDate).toISOString() : null,
      actualEndDate: actualEndDate ? new Date(actualEndDate).toISOString() : null,
      estimatedSeconds: calculatedEstimatedSeconds,
      notes,
      sessions,
      showInSummary,
      targetParentId: selectedParentId,
      targetProjectId: validTargetProjectId,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-[#f4f4f5] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#27272a] bg-[#121215] shrink-0">
          {/* Left: Back button */}
          <div className="flex items-center gap-2 text-sm text-[#a1a1aa]">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 hover:text-[#f4f4f5] transition-colors cursor-pointer group px-2 py-1 -ml-2 rounded-lg hover:bg-[#18181b]"
              title="Back to Tasks"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-[#a1a1aa] group-hover:text-[#f4f4f5]" />
              <span className="hidden sm:inline font-medium">Back to Tasks</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3 relative">
            {/* More Actions Dropdown */}
            {initialItem && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className="p-2 sm:px-3 sm:py-2 rounded-lg bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] hover:bg-[#27272a] text-[#d4d4d8] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="More Actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">More Actions</span>
                </button>

                {isMoreMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl py-1.5 z-30 text-xs text-[#f4f4f5] animate-in fade-in slide-in-from-top-2 duration-150">
                    {onStartTimer && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          if (isTimerRunning && onStopTimer) onStopTimer();
                          else onStartTimer(initialItem.id);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#27272a] flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        {isTimerRunning ? (
                          <>
                            <Square className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-rose-400 font-medium">Stop Timer</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-orange-400" />
                            <span>Start Task Timer</span>
                          </>
                        )}
                      </button>
                    )}

                    {onDuplicateItem && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          onDuplicateItem(initialItem.id);
                          onClose();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#27272a] flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#a1a1aa]" />
                        <span>Duplicate Task</span>
                      </button>
                    )}

                    {onDeleteItem && (
                      <>
                        <div className="my-1 border-t border-[#27272a]" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            if (window.confirm('Are you sure you want to delete this task permanently?')) {
                              onDeleteItem(initialItem.id);
                              onClose();
                            }
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Task</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Save Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="px-3.5 sm:px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-xs transition-all shadow-md shadow-orange-500/20 cursor-pointer flex items-center gap-1.5"
            >
              <span>Save<span className="hidden sm:inline"> Changes</span></span>
            </button>
          </div>
        </header>

        {/* Conflict / Validation Warning */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Warning:</span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* FULL-WIDTH TOP BREADCRUMB / HIERARCHY BAR (Spans across both left panel and right properties panel) */}
        <div className="px-4 sm:px-6 pt-3.5 sm:pt-4 pb-0">
          <div className="relative" ref={parentPickerRef}>
            <button
              type="button"
              onClick={() => setIsParentPickerOpen(!isParentPickerOpen)}
              className={`w-full flex items-center justify-between gap-2 py-2 px-3 sm:px-3.5 bg-[#18181b] hover:bg-[#202025] border rounded-xl text-xs transition-all cursor-pointer group text-left shadow-sm ${
                isParentPickerOpen
                  ? 'border-orange-500/50 bg-[#1e1e24] ring-1 ring-orange-500/20'
                  : 'border-[#27272a] hover:border-[#3f3f46]'
              }`}
              title="Click to change hierarchy position or parent task"
            >
              {/* Breadcrumb Trail on the left (Single line with horizontal scrolling on mobile) */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar py-0.5">
                {/* Project Name */}
                <div className="inline-flex items-center gap-1.5 font-medium text-xs text-[#f4f4f5] shrink-0">
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold text-[#f4f4f5] truncate max-w-[120px] sm:max-w-[200px]">
                    {activeProj?.title || 'Project'}
                  </span>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[#52525b] shrink-0" />

                {/* Ancestor Breadcrumbs (if deep hierarchy) */}
                {selectedParentInfo && selectedParentInfo.breadcrumbs.length > 0 && (
                  <>
                    {selectedParentInfo.breadcrumbs.map((crumb, idx) => (
                      <React.Fragment key={idx}>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#27272a]/50 text-[#a1a1aa] text-xs font-medium border border-[#27272a] shrink-0 truncate max-w-[110px] sm:max-w-[140px]">
                          <Folder className="w-3 h-3 text-[#71717a] shrink-0" />
                          <span className="truncate">{crumb}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#52525b] shrink-0" />
                      </React.Fragment>
                    ))}
                  </>
                )}

                {/* Parent Task (if subtask) */}
                {selectedParentInfo ? (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#27272a]/50 text-[#a1a1aa] text-xs font-medium border border-[#27272a] shrink-0 truncate max-w-[140px] sm:max-w-[200px]">
                    <Folder className="w-3 h-3 text-[#71717a] shrink-0" />
                    <span className="truncate">{selectedParentInfo.name}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#71717a] italic shrink-0">Root Task (Main Level)</span>
                )}
              </div>

              {/* Right side indicator: Dropdown chevron */}
              <div className="flex items-center shrink-0 pl-1">
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#71717a] group-hover:text-[#f4f4f5] transition-transform duration-200 ${
                    isParentPickerOpen ? 'rotate-180 text-orange-400' : ''
                  }`}
                />
              </div>
            </button>

            {/* UNIFIED HIERARCHY DROPDOWN MENU */}
            {isParentPickerOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-80 sm:w-96 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[380px]">
                {/* Project Header & Switcher (if multiple projects) */}
                <div className="px-3 py-2 border-b border-[#27272a] bg-[#121215] flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs text-[#f4f4f5] truncate">
                        {activeProj?.title || 'Project'}
                      </span>
                      <span className="text-[10px] text-[#71717a]">
                        Select hierarchy position
                      </span>
                    </div>
                  </div>

                  {/* Project Switcher Select if more than 1 project exists */}
                  {projects.length > 1 && (
                    <select
                      value={selectedTargetProjectId}
                      onChange={(e) => {
                        setSelectedTargetProjectId(e.target.value);
                        setSelectedParentId('root');
                      }}
                      className="bg-[#18181b] border border-[#27272a] rounded-lg px-2 py-1 text-[11px] text-[#f4f4f5] outline-none focus:border-orange-500 cursor-pointer font-mono shrink-0 ml-2"
                      title="Move to another project"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Tree Items List */}
                <div className="overflow-y-auto p-1.5 space-y-0.5">
                  {/* Option 1: Set as Main Task (Root Level) */}
                  <div
                    onClick={() => {
                      setSelectedParentId('root');
                      setIsParentPickerOpen(false);
                    }}
                    className={`p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-2 mb-1 ${
                      !selectedParentInfo
                        ? 'bg-orange-500/15 border border-orange-500/30 text-orange-300'
                        : 'hover:bg-[#202025] text-[#f4f4f5] bg-[#141417] border border-dashed border-[#27272a] hover:border-orange-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span className="font-semibold text-xs truncate">
                        Main Task
                      </span>
                    </div>
                    {!selectedParentInfo && (
                      <Check className="w-4 h-4 text-orange-400 shrink-0 ml-1" />
                    )}
                  </div>

                  {/* Task Tree Hierarchy */}
                  <div className="space-y-0.5 pt-0.5">
                    {(() => {
                      const renderTreeNodes = (items: ItemNode[], level = 1): React.ReactNode => {
                        return items.map((item) => {
                          if (excludedIds.has(item.id)) return null;
                          const validSubItems = (item.subItems || []).filter(
                            (sub) => !excludedIds.has(sub.id)
                          );
                          const hasChildren = validSubItems.length > 0;
                          const isExpanded = expandedParentIds.has(item.id);
                          const isSelected = selectedParentId === item.id;

                          return (
                            <div key={item.id} className="select-none">
                              <div
                                onClick={() => {
                                  setSelectedParentId(item.id);
                                  setIsParentPickerOpen(false);
                                }}
                                className={`group/node flex items-center justify-between gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-orange-500/15 border border-orange-500/30 text-orange-300'
                                    : 'hover:bg-[#202025] text-[#f4f4f5]'
                                }`}
                                style={{ paddingLeft: `${Math.max(8, (level - 1) * 14 + 8)}px` }}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {/* Expand / Collapse Icon Button */}
                                  {hasChildren ? (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleExpandParent(item.id, e)}
                                      className="w-4 h-4 rounded flex items-center justify-center text-[#71717a] hover:text-orange-400 hover:bg-[#27272a] shrink-0 transition-colors"
                                      title={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                                    >
                                      <ChevronRight
                                        className={`w-3.5 h-3.5 transition-transform ${
                                          isExpanded ? 'rotate-90 text-orange-400' : ''
                                        }`}
                                      />
                                    </button>
                                  ) : (
                                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#3f3f46]" />
                                    </div>
                                  )}

                                  {/* Icon Folder / Item */}
                                  {hasChildren ? (
                                    <Folder className={`w-3.5 h-3.5 shrink-0 ${isExpanded ? 'text-orange-400' : 'text-[#a1a1aa]'}`} />
                                  ) : (
                                    <CheckSquare className="w-3.5 h-3.5 shrink-0 text-[#71717a]" />
                                  )}

                                  {/* Item Name */}
                                  <span className="text-xs truncate font-medium flex-1">
                                    {item.name}
                                  </span>

                                  {/* Subtask Count Badge if has children */}
                                  {hasChildren && (
                                    <span className="text-[9px] font-mono px-1 rounded bg-[#27272a] text-[#a1a1aa] shrink-0">
                                      {validSubItems.length}
                                    </span>
                                  )}
                                </div>

                                {isSelected && (
                                  <Check className="w-4 h-4 text-orange-400 shrink-0 ml-1" />
                                )}
                              </div>

                              {/* Render Children Recursively if Expanded */}
                              {hasChildren && isExpanded && (
                                <div className="relative border-l border-[#27272a] ml-4 my-0.5 space-y-0.5">
                                  {renderTreeNodes(validSubItems, level + 1)}
                                </div>
                              )}
                            </div>
                          );
                        });
                      };

                      if (!activeProj || !activeProj.items || activeProj.items.length === 0) {
                        return (
                          <div className="py-4 text-center text-xs text-[#71717a]">
                            No tasks in this project yet
                          </div>
                        );
                      }

                      return renderTreeNodes(activeProj.items, 1);
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* LEFT COLUMN: Main Task Content (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Title & Status Badge Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Task title..."
                  className="w-full text-xl sm:text-2xl font-bold text-[#f4f4f5] bg-transparent border border-transparent hover:border-[#27272a] focus:border-[#3f3f46] rounded-lg px-2.5 py-1.5 transition-all outline-none placeholder:text-[#52525b]"
                  autoFocus
                />
              </div>

              <div className="shrink-0 relative">
                <button
                  type="button"
                  onClick={() => setIsStatusPickerOpen(!isStatusPickerOpen)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer hover:brightness-125 shadow-xs ${statusConfigs[status].badge}`}
                  title="Click to change task status"
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfigs[status].bg}`} />
                  <span>{statusConfigs[status].label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform duration-150 ${isStatusPickerOpen ? 'rotate-180' : ''}`} />
                </button>

                {isStatusPickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsStatusPickerOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#18181b] border border-[#3f3f46] rounded-xl shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      {(['not-started', 'in-progress', 'review', 'completed'] as ItemStatus[]).map((st) => {
                        const conf = statusConfigs[st];
                        const isSelected = status === st;
                        return (
                          <div
                            key={st}
                            onClick={() => {
                              setStatus(st);
                              setIsStatusPickerOpen(false);
                            }}
                            className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? `${conf.badge} font-bold`
                                : 'text-[#d4d4d8] hover:bg-[#27272a]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${conf.bg}`} />
                              <span className="text-xs">{conf.label}</span>
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

            {/* SECTION: Description / Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#f4f4f5] font-bold text-base">
                  <FileText className="w-4 h-4 text-orange-400" />
                  <h3>Description & Instructions</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNotesPreviewMode(!isNotesPreviewMode)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    isNotesPreviewMode
                      ? 'bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5]'
                      : 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/30 text-orange-300'
                  }`}
                  title={isNotesPreviewMode ? 'Switch to text editing' : 'Switch to clickable link preview'}
                >
                  {isNotesPreviewMode ? (
                    <>
                      <FileText className="w-3.5 h-3.5 text-orange-400" />
                      <span>Edit Text</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-orange-400" />
                      <span>Preview Links</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] focus-within:border-orange-500/60 rounded-xl p-4 transition-all min-h-[140px]">
                {isNotesPreviewMode ? (
                  notes.trim().length > 0 ? (
                    <div className="text-sm text-[#d4d4d8] leading-relaxed whitespace-pre-wrap select-text">
                      {notes.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
                        if (part.match(/^https?:\/\//)) {
                          return (
                            <a
                              key={i}
                              href={part}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 underline font-medium break-all transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>{part}</span>
                              <ExternalLink className="w-3 h-3 inline shrink-0 ml-0.5" />
                            </a>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </div>
                  ) : (
                    <div
                      onClick={() => setIsNotesPreviewMode(false)}
                      className="text-sm text-[#52525b] italic cursor-pointer hover:text-[#71717a] transition-colors py-3"
                    >
                      No description or instructions added yet. Click &quot;Edit Text&quot; to write...
                    </div>
                  )
                ) : (
                  <textarea
                    rows={6}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Write task description, instructions, key notes, or paste URL links (https://...)..."
                    className="w-full bg-transparent text-sm text-[#d4d4d8] leading-relaxed outline-none resize-y placeholder:text-[#52525b]"
                    autoFocus
                  />
                )}

                {/* Detected Links */}
                {!isNotesPreviewMode && notes.match(/https?:\/\/[^\s]+/g) && (
                  <div className="mt-3 pt-3 border-t border-[#27272a]/60 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#71717a] font-medium">Detected links:</span>
                    {Array.from(new Set(notes.match(/https?:\/\/[^\s]+/g) || [])).map((urlStr, idx) => {
                      const url = String(urlStr);
                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#121215] border border-[#27272a] hover:border-orange-500/40 text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors max-w-[240px] truncate"
                          title={url}
                        >
                          <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION: Execution Realization (Option 1: Work Periods & Sessions Array) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#f4f4f5] font-bold text-base">
                  <CalendarRange className="w-4 h-4 text-orange-400" />
                  <h3>Execution Realization</h3>
                  {sessions.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
                      {sessions.length} {sessions.length === 1 ? 'Period' : 'Periods'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {sessions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllPeriods}
                      className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-500/10 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear All</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAddingPeriod(!isAddingPeriod)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Period</span>
                  </button>
                </div>
              </div>

              {/* Overall Realization Span Banner */}
              <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa] block">
                    Overall Realization Span
                  </span>
                  <span className="text-[#f4f4f5] font-medium">
                    {actualStartDate
                      ? `${formatDisplayDate(actualStartDate)} — ${actualEndDate ? formatDisplayDate(actualEndDate) : formatDisplayDate(actualStartDate)}`
                      : 'No execution periods recorded yet'}
                  </span>
                </div>
                {actualStartDate && (
                  <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 self-start sm:self-auto">
                    Active on Timeline
                  </span>
                )}
              </div>

              {/* Add Period Form */}
              {isAddingPeriod && (
                <div className="bg-[#18181b] border border-orange-500/30 rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
                    <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Work / Realization Period</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingPeriod(false)}
                      className="text-[#a1a1aa] hover:text-[#f4f4f5] p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono font-semibold uppercase text-[#a1a1aa] mb-1">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        value={newPeriodStart}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewPeriodStart(val);
                          if (!newPeriodEnd || newPeriodEnd < val) setNewPeriodEnd(val);
                        }}
                        onClick={(e) => {
                          try {
                            (e.currentTarget as any).showPicker?.();
                          } catch {}
                        }}
                        className="w-full bg-[#121215] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-orange-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-semibold uppercase text-[#a1a1aa] mb-1">
                        End Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={newPeriodEnd}
                        min={newPeriodStart || undefined}
                        onChange={(e) => setNewPeriodEnd(e.target.value)}
                        onClick={(e) => {
                          try {
                            (e.currentTarget as any).showPicker?.();
                          } catch {}
                        }}
                        className="w-full bg-[#121215] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-orange-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-semibold uppercase text-[#a1a1aa] mb-1">
                        Period Label
                      </label>
                      <input
                        type="text"
                        value={newPeriodTitle}
                        onChange={(e) => setNewPeriodTitle(e.target.value)}
                        placeholder="e.g. Phase 1, Field Testing"
                        className="w-full bg-[#121215] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#f4f4f5] outline-none focus:border-orange-500 placeholder:text-[#52525b]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingPeriod(false)}
                      className="px-3 py-1.5 text-xs text-[#a1a1aa] hover:text-[#f4f4f5] rounded-lg hover:bg-[#27272a] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddManualPeriod}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors cursor-pointer"
                    >
                      Save Period
                    </button>
                  </div>
                </div>
              )}

              {/* List of Realization Periods and Timer Sessions */}
              {sessions.length > 0 ? (
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3.5 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa] block mb-2">
                    Recorded Periods & Sessions ({sessions.length})
                  </span>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {sessions.map((s, idx) => {
                      const isTimer = Boolean(s.type === 'timer' || (s.loggedSeconds && s.loggedSeconds > 0));
                      const startStr = s.startedAt ? new Date(s.startedAt).toLocaleDateString('en-GB') : '';
                      const endStr = s.endedAt ? new Date(s.endedAt).toLocaleDateString('en-GB') : startStr;
                      const isMultiDay = startStr !== endStr;

                      return (
                        <div
                          key={s.id || idx}
                          className="bg-[#121215] border border-[#27272a] rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-md bg-[#18181b] border border-[#27272a] text-orange-400 shrink-0">
                              {isTimer ? <Clock className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-[#f4f4f5] truncate">
                                {s.title || (isTimer ? `Timer Session #${idx + 1}` : `Realization Period #${idx + 1}`)}
                              </p>
                              <p className="text-[10px] text-[#71717a] font-mono">
                                {isMultiDay ? `${startStr} — ${endStr}` : startStr}
                                {isTimer && (
                                  <>
                                    {' '}
                                    &middot; {formatDuration(s.loggedSeconds || 0)}
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteSession(s.id)}
                            className="p-1 text-[#71717a] hover:text-rose-400 transition-colors cursor-pointer rounded hover:bg-[#18181b] shrink-0"
                            title="Remove this realization period"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-[#18181b]/50 border border-dashed border-[#27272a] rounded-xl p-4 text-center">
                  <p className="text-xs text-[#71717a]">
                    No realization periods added yet. Click <span className="text-orange-400 font-semibold">"Add Period"</span> or start a timer.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Properties Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* CARD: Properties */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-5">
              <h3 className="text-base font-bold text-[#f4f4f5]">Properties</h3>

              {/* 1. ASSIGNEE */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-[#a1a1aa]">
                  Assignee
                </label>

                <div className="relative">
                  <div
                    onClick={() => {
                      setIsAssigneePickerOpen(!isAssigneePickerOpen);
                      setIsReviewerPickerOpen(false);
                    }}
                    className="bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={currentAssignee.avatar}
                        alt={currentAssignee.name}
                        className="w-8 h-8 rounded-full object-cover border border-[#27272a] shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#f4f4f5] truncate">{currentAssignee.name}</p>
                        <p className="text-[10px] text-[#71717a] truncate">{currentAssignee.role}</p>
                      </div>
                    </div>

                    <UserPlus className="w-4 h-4 text-[#a1a1aa] shrink-0" />
                  </div>

                  {/* Assignee Dropdown */}
                  {isAssigneePickerOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1.5 z-20 space-y-1 animate-in fade-in">
                      {persons.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setAssigneeId(p.id);
                            setIsAssigneePickerOpen(false);
                          }}
                          className={`p-2 rounded-lg flex items-center justify-between cursor-pointer hover:bg-[#27272a] transition-colors ${
                            p.id === currentAssignee.id ? 'bg-[#27272a]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={p.avatar} alt={p.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#f4f4f5] truncate">{p.name}</p>
                              <p className="text-[10px] text-[#71717a] truncate">{p.role}</p>
                            </div>
                          </div>
                          {p.id === currentAssignee.id && <Check className="w-3.5 h-3.5 text-orange-400" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. REVIEWER */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-[#a1a1aa]">
                    Reviewer
                  </label>
                  {reviewerId && (
                    <button
                      type="button"
                      onClick={() => setReviewerId(null)}
                      className="text-[10px] text-[#71717a] hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Remove Reviewer
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div
                    onClick={() => {
                      setIsReviewerPickerOpen(!isReviewerPickerOpen);
                      setIsAssigneePickerOpen(false);
                    }}
                    className="bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-all"
                  >
                    {currentReviewer ? (
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={currentReviewer.avatar}
                          alt={currentReviewer.name}
                          className="w-8 h-8 rounded-full object-cover border border-amber-500/40 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#f4f4f5] truncate">{currentReviewer.name}</p>
                          <p className="text-[10px] text-amber-400 truncate">{currentReviewer.role}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 text-[#71717a]">
                        <div className="w-8 h-8 rounded-full border border-dashed border-[#3f3f46] flex items-center justify-center bg-[#18181b]">
                          <UserCheck className="w-4 h-4 text-[#71717a]" />
                        </div>
                        <span className="text-xs">Select Reviewer (Optional)</span>
                      </div>
                    )}

                    <UserCheck className="w-4 h-4 text-amber-400/80 shrink-0" />
                  </div>

                  {/* Reviewer Dropdown */}
                  {isReviewerPickerOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1.5 z-20 space-y-1 animate-in fade-in">
                      <div
                        onClick={() => {
                          setReviewerId(null);
                          setIsReviewerPickerOpen(false);
                        }}
                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer hover:bg-[#27272a] transition-colors ${
                          !reviewerId ? 'bg-[#27272a]' : ''
                        }`}
                      >
                        <span className="text-xs text-[#a1a1aa] italic">No Reviewer (Unassigned)</span>
                        {!reviewerId && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>

                      {persons.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setReviewerId(p.id);
                            setIsReviewerPickerOpen(false);
                          }}
                          className={`p-2 rounded-lg flex items-center justify-between cursor-pointer hover:bg-[#27272a] transition-colors ${
                            p.id === reviewerId ? 'bg-[#27272a]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={p.avatar} alt={p.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#f4f4f5] truncate">{p.name}</p>
                              <p className="text-[10px] text-[#71717a] truncate">{p.role}</p>
                            </div>
                          </div>
                          {p.id === reviewerId && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. DUE DATE (TARGET DATE) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-[#a1a1aa]">
                    Due Date
                  </label>
                  {targetDate && (
                    <button
                      type="button"
                      onClick={() => setTargetDate('')}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-rose-500/10"
                      title="Clear due date"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear Due Date</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div
                    onClick={() => targetDateInputRef.current?.showPicker?.() || targetDateInputRef.current?.focus()}
                    className="w-full bg-[#121215] hover:bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-xl px-3 py-2.5 text-xs text-[#f4f4f5] flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#a1a1aa]" />
                      <span className="font-medium">{targetDate ? formatDisplayDate(targetDate) : 'Select due date'}</span>
                    </div>
                    {targetDate ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetDate('');
                        }}
                        className="relative z-20 p-1 hover:bg-[#27272a] rounded-md text-[#71717a] hover:text-rose-400 transition-colors"
                        title="Clear due date"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <Calendar className="w-3.5 h-3.5 text-[#52525b]" />
                    )}
                  </div>

                  <input
                    type="date"
                    ref={targetDateInputRef}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer pointer-events-auto"
                    style={{ right: targetDate ? '36px' : '0' }}
                  />
                </div>
                {targetDate && (
                  <button
                    type="button"
                    onClick={() => setTargetDate('')}
                    className="text-[10px] text-[#71717a] hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-2.5 h-2.5" />
                    <span>Clear due date</span>
                  </button>
                )}
              </div>

              {/* 5. ESTIMATED HOURS */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-[#a1a1aa]">
                  Estimated Time (Hours)
                </label>

                <div className="flex items-center bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] focus-within:border-orange-500 rounded-xl px-3 py-2 transition-all">
                  <Clock className="w-4 h-4 text-[#a1a1aa] mr-2 shrink-0" />
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full bg-transparent text-xs text-[#f4f4f5] outline-none"
                  />
                  <span className="text-xs text-[#71717a] font-mono">hours</span>
                </div>
              </div>

              {/* 5b. SUMMARY / CALENDAR REPORTING LEVEL (MILESTONE) */}
              <div className="space-y-1.5 pt-2 border-t border-[#27272a]">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-[#a1a1aa]">
                    Reporting Level
                  </label>
                  {showInSummary && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold uppercase">
                      Active
                    </span>
                  )}
                </div>

                <div
                  onClick={() => setShowInSummary(!showInSummary)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                    showInSummary
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                      : 'bg-[#121215] border-[#27272a] hover:border-[#3f3f46]'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                    showInSummary ? 'bg-amber-500 border-amber-500 text-black' : 'border-[#52525b] bg-[#18181b]'
                  }`}>
                    {showInSummary && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Target className={`w-3.5 h-3.5 ${showInSummary ? 'text-amber-400' : 'text-[#a1a1aa]'}`} />
                      <span className={`text-xs font-semibold ${showInSummary ? 'text-amber-300' : 'text-[#f4f4f5]'}`}>
                        Summary & Calendar Target
                      </span>
                    </div>
                    <p className="text-[11px] text-[#71717a] mt-0.5 leading-snug">
                      Display this task as a primary milestone in Summary & Calendar (aggregating the duration of all nested subtasks).
                    </p>
                  </div>
                </div>
              </div>

              {/* 6. TOTAL LOGGED TIME & TIMER */}
              <div className="space-y-1.5 pt-2 border-t border-[#27272a]">
                <label className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-[#a1a1aa]">
                  Total Logged Time
                </label>

                <div className="bg-[#121215] border border-[#27272a] rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        isTimerRunning ? 'bg-orange-500 animate-pulse' : 'bg-zinc-600'
                      }`}
                    />
                    <span className="text-sm font-mono font-bold text-[#f4f4f5]">
                      {formatDuration(totalLoggedSecs)}
                    </span>
                  </div>

                  {initialItem && onStartTimer && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isTimerRunning && onStopTimer) onStopTimer();
                        else onStartTimer(initialItem.id);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isTimerRunning
                          ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                          : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                      }`}
                    >
                      {isTimerRunning ? (
                        <>
                          <Square className="w-3 h-3" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          <span>Start Timer</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* CARD: Timer Session History */}
            {sessions.length > 0 && (
              <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#f4f4f5] flex items-center gap-2">
                    <History className="w-4 h-4 text-[#a1a1aa]" />
                    <span>Timer Session History ({sessions.length})</span>
                  </h3>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 divide-y divide-[#27272a]/60">
                  {sessions.map((s, idx) => (
                    <div key={s.id || idx} className="pt-2 first:pt-0 flex items-center justify-between text-xs font-mono">
                      <div className="min-w-0">
                        <p className="text-[#d4d4d8] font-medium">
                          {formatDuration(s.loggedSeconds || 0)}
                        </p>
                        <p className="text-[10px] text-[#71717a]">
                          {new Date(s.startedAt).toLocaleDateString()} &middot;{' '}
                          {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id)}
                        className="p-1 text-[#71717a] hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

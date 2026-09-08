import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { AppData, ItemNode, ItemStatus, Person, ProjectNode, ProjectStatus, ViewMode, Session, TimeScale, AppTheme, AccentColor } from './types';
import { TreeSortBy, TreeSortDirection } from './utils/treeSorting';
import { initialAppData } from './defaultData';
import { Header } from './components/Header';
import { TreeView } from './components/TreeView';
import { GanttView } from './components/GanttView';
import { KanbanView } from './components/KanbanView';
import { TimelineView } from './components/TimelineView';
import { CalendarView } from './components/CalendarView';
import { DashboardView } from './components/DashboardView';
import { SummaryView } from './components/SummaryView';
import { TeamView } from './components/TeamView';
import { ArchivedView } from './components/ArchivedView';
import { ItemModal } from './components/ItemModal';
import { ProjectModal } from './components/ProjectModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginScreen } from './components/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useWorkspaceSync } from './hooks/useWorkspaceSync';
import {
  updateItemInProjects,
  addSubItemInProjects,
  deleteItemFromProjects,
  buildItemPathIds,
  findItemById,
  formatDuration,
  computeActualDatesFromSessions,
  moveItemInProjects,
  findItemAndProject,
  reorderItemInProjects,
  duplicateItemInProjects,
  reorderProject,
  duplicateProject,
  toggleItemExpandInProjects,
  setAllExpandInProjects,
  reassignPersonTasksInProjects,
  setMilestoneTarget,
} from './utils/treeUtils';

function WorkspaceApp() {
  const { currentUser, isLoading, isDevBypass, signInWithGoogle, signInDevBypass, signOut } = useAuth();
  const {
    appData,
    setAppData,
    syncStatus,
    lastSyncedAt,
    isInitialCloudLoaded,
    persistData,
    triggerManualSync,
    fetchCloudSnapshotInfo,
    forcePushToCloud,
    forcePullFromCloud,
    fetchCloudHistory,
    restoreCloudSnapshot,
  } = useWorkspaceSync(currentUser, isDevBypass);

  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('struktur_current_view');
      if (
        saved &&
        ['dashboard', 'projects', 'tasks', 'timeline', 'calendar', 'analytics', 'team', 'archived'].includes(
          saved
        )
      ) {
        return saved as ViewMode;
      }
    } catch {
      // ignore
    }
    return 'projects';
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('struktur_filter_project_id');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'all';
  });
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('struktur_filter_search_query');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return '';
  });
  const [targetInitialDate, setTargetInitialDate] = useState<string | null>(null);

  // Shared TimeScale / ViewType filter (Day, Week, Month, Year) across Timeline, Calendar, etc.
  const [timeScale, setTimeScale] = useState<TimeScale>(() => {
    try {
      const saved =
        localStorage.getItem('struktur_filter_timescale') ||
        localStorage.getItem('struktur_calendar_viewtype') ||
        localStorage.getItem('struktur_timeline_timescale');
      if (saved && ['day', 'week', 'month', 'year'].includes(saved)) {
        return saved as TimeScale;
      }
    } catch {
      // ignore
    }
    return 'month';
  });

  // Shared Reference Date (for Date Selector / Navigation across Timeline, Calendar, and Summary)
  const [currentReferenceDate, setCurrentReferenceDate] = useState<Date>(() => {
    try {
      const saved = localStorage.getItem('struktur_filter_current_date');
      if (saved) {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return new Date();
  });

  const handleReferenceDateChange = (date: Date) => {
    setCurrentReferenceDate(date);
    try {
      localStorage.setItem('struktur_filter_current_date', date.toISOString());
    } catch {
      // ignore
    }
  };

  const handleTimeScaleChange = (scale: TimeScale) => {
    setTimeScale(scale);
    try {
      localStorage.setItem('struktur_filter_timescale', scale);
      localStorage.setItem('struktur_calendar_viewtype', scale);
      localStorage.setItem('struktur_timeline_timescale', scale);
    } catch {
      // ignore
    }
  };

  // Shared Show Weekends & Show Completed filters
  const [showWeekends, setShowWeekends] = useState<boolean>(() => {
    try {
      const saved =
        localStorage.getItem('struktur_filter_show_weekends') ??
        localStorage.getItem('struktur_calendar_show_weekends');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return true;
  });

  const handleShowWeekendsChange = (show: boolean) => {
    setShowWeekends(show);
    try {
      localStorage.setItem('struktur_filter_show_weekends', String(show));
      localStorage.setItem('struktur_calendar_show_weekends', String(show));
    } catch {
      // ignore
    }
  };

  const [showCompleted, setShowCompleted] = useState<boolean>(() => {
    try {
      const saved =
        localStorage.getItem('struktur_filter_show_completed') ??
        localStorage.getItem('struktur_calendar_show_completed');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return true;
  });

  const handleShowCompletedChange = (show: boolean) => {
    setShowCompleted(show);
    try {
      localStorage.setItem('struktur_filter_show_completed', String(show));
      localStorage.setItem('struktur_calendar_show_completed', String(show));
    } catch {
      // ignore
    }
  };

  const handleSelectProjectFilter = (projectId: string) => {
    setSelectedProjectId(projectId);
    try {
      localStorage.setItem('struktur_filter_project_id', projectId);
    } catch {
      // ignore
    }
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    try {
      localStorage.setItem('struktur_filter_search_query', query);
    } catch {
      // ignore
    }
  };

  // Shared Team / Person Filter state
  const [selectedPersonId, setSelectedPersonId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('struktur_filter_person_id');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'all';
  });

  const handleSelectPersonFilter = (personId: string) => {
    setSelectedPersonId(personId);
    try {
      localStorage.setItem('struktur_filter_person_id', personId);
    } catch {
      // ignore
    }
  };

  // Shared Sorting State synchronized across TreeView, NotionTreeView, and KanbanView
  const [sortBy, setSortBy] = useState<TreeSortBy>(() => {
    try {
      const saved =
        localStorage.getItem('tracker_global_sort_by') ||
        localStorage.getItem('tracker_tree_sort_by') ||
        localStorage.getItem('tracker_kanban_sort_by');
      if (saved && ['default', 'name', 'sessions', 'duration', 'status'].includes(saved)) {
        return saved as TreeSortBy;
      }
    } catch {
      // ignore
    }
    return 'default';
  });

  const [sortDirection, setSortDirection] = useState<TreeSortDirection>(() => {
    try {
      const saved =
        localStorage.getItem('tracker_global_sort_direction') ||
        localStorage.getItem('tracker_tree_sort_direction') ||
        localStorage.getItem('tracker_kanban_sort_direction');
      if (saved && ['asc', 'desc'].includes(saved)) {
        return saved as TreeSortDirection;
      }
    } catch {
      // ignore
    }
    return 'asc';
  });

  const handleSortByChange = (newSort: TreeSortBy) => {
    setSortBy(newSort);
    try {
      localStorage.setItem('tracker_global_sort_by', newSort);
      localStorage.setItem('tracker_tree_sort_by', newSort);
      localStorage.setItem('tracker_kanban_sort_by', newSort);
    } catch {
      // ignore
    }
  };

  const handleToggleSortDirection = () => {
    const nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(nextDir);
    try {
      localStorage.setItem('tracker_global_sort_direction', nextDir);
      localStorage.setItem('tracker_tree_sort_direction', nextDir);
      localStorage.setItem('tracker_kanban_sort_direction', nextDir);
    } catch {
      // ignore
    }
  };

  const handleSelectView = (view: ViewMode) => {
    setCurrentView(view);
    try {
      localStorage.setItem('struktur_current_view', view);
    } catch {
      // ignore
    }
  };

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ItemNode | null>(null);
  const [targetParentItemId, setTargetParentItemId] = useState<string | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<ProjectNode | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Synchronize dynamic Theme Mode & Accent Color on document root
  useEffect(() => {
    const theme = appData.settings.theme || 'dark';
    const accent = appData.settings.accentColor || 'orange';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appData.settings.theme, appData.settings.accentColor]);

  // Update theme & accent color handler
  const handleUpdateTheme = (theme: AppTheme, accent: AccentColor) => {
    const updatedSettings = {
      ...appData.settings,
      theme,
      accentColor: accent,
    };
    persistData({
      ...appData,
      settings: updatedSettings,
    });
  };

  // Add Activity Log helper
  const addLog = (action: string, details: string, itemId?: string, itemTitle?: string): AppData['activityLogs'] => {
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: 'person-1',
      userName: 'Project Manager',
      action,
      details,
      itemId,
      itemTitle,
    };
    return [newLog, ...(appData.activityLogs || [])].slice(0, 50);
  };

  // Timer Handlers
  const handleStopTimer = () => {
    const activeTimer = appData.settings.activeTimer;
    if (!activeTimer) return;

    const itemInfo = findItemById(appData, activeTimer.itemId);
    const now = new Date();
    const start = new Date(activeTimer.startedAt);
    const loggedSeconds = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 1000));

    const newSession: Session = {
      id: `sess-${Date.now()}`,
      type: 'timer',
      startedAt: activeTimer.startedAt,
      endedAt: now.toISOString(),
      loggedSeconds,
    };

    let updatedProjects = appData.projects;
    let itemTitle = 'Task';

    if (itemInfo) {
      itemTitle = itemInfo.item.name;
      updatedProjects = updateItemInProjects(appData.projects, activeTimer.itemId, (item) => {
        const allSessions = [...(item.sessions || []), newSession];
        const computed = computeActualDatesFromSessions(allSessions, item.actualStartDate, item.actualEndDate);
        return {
          ...item,
          sessions: allSessions,
          actualStartDate: computed.actualStartDate,
          actualEndDate: computed.actualEndDate,
          showInSummary: true,
        };
      });
      updatedProjects = setMilestoneTarget(updatedProjects, activeTimer.itemId);
    }

    const updatedData: AppData = {
      ...appData,
      projects: updatedProjects,
      settings: {
        ...appData.settings,
        activeTimer: null,
      },
      activityLogs: addLog(
        'timer_stopped',
        `Logged ${formatDuration(loggedSeconds)} on "${itemTitle}"`,
        activeTimer.itemId,
        itemTitle
      ),
    };

    persistData(updatedData);
  };

  const handleStartTimer = (itemId: string) => {
    const currentActiveTimer = appData.settings.activeTimer;

    // If the timer is already running for the exact same item, nothing to do
    if (currentActiveTimer && currentActiveTimer.itemId === itemId) {
      return;
    }

    let workingProjects = appData.projects;
    let workingLogs = appData.activityLogs || [];
    const now = new Date();
    const nowIso = now.toISOString();
    const todayStr = nowIso.split('T')[0];

    // 1. If another timer was running, finalize and save its session first
    if (currentActiveTimer) {
      const prevItemInfo = findItemById(appData, currentActiveTimer.itemId);
      const prevStart = new Date(currentActiveTimer.startedAt);
      const prevLoggedSeconds = Math.max(1, Math.floor((now.getTime() - prevStart.getTime()) / 1000));
      const prevTitle = prevItemInfo ? prevItemInfo.item.name : 'Task';

      const prevSession: Session = {
        id: `sess-${Date.now()}-prev`,
        type: 'timer',
        startedAt: currentActiveTimer.startedAt,
        endedAt: nowIso,
        loggedSeconds: prevLoggedSeconds,
      };

      workingProjects = updateItemInProjects(workingProjects, currentActiveTimer.itemId, (item) => {
        const allSessions = [...(item.sessions || []), prevSession];
        const computed = computeActualDatesFromSessions(allSessions, item.actualStartDate, item.actualEndDate);
        return {
          ...item,
          sessions: allSessions,
          actualStartDate: computed.actualStartDate,
          actualEndDate: computed.actualEndDate,
          showInSummary: true,
        };
      });
      workingProjects = setMilestoneTarget(workingProjects, currentActiveTimer.itemId);

      const prevStopLog = {
        id: `log-${Date.now()}-stop`,
        timestamp: nowIso,
        userId: 'person-1',
        userName: 'Project Manager',
        action: 'timer_stopped',
        details: `Logged ${formatDuration(prevLoggedSeconds)} on "${prevTitle}"`,
        itemId: currentActiveTimer.itemId,
        itemTitle: prevTitle,
      };
      workingLogs = [prevStopLog, ...workingLogs];
    }

    // 2. Now start timer on the new target item
    const newItemInfo = findItemById({ ...appData, projects: workingProjects }, itemId);
    if (!newItemInfo) {
      // If target item not found, persist the stopped state if any
      if (currentActiveTimer) {
        persistData({
          ...appData,
          projects: workingProjects,
          settings: { ...appData.settings, activeTimer: null },
          activityLogs: workingLogs.slice(0, 50),
        });
      }
      return;
    }

    const pathIds = buildItemPathIds({ ...appData, projects: workingProjects }, itemId);

    // Automatically change status to 'in-progress' and update actualStartDate if empty
    workingProjects = updateItemInProjects(workingProjects, itemId, (item) => {
      const computed = computeActualDatesFromSessions(
        item.sessions || [],
        item.actualStartDate,
        item.actualEndDate
      );
      return {
        ...item,
        status: 'in-progress',
        actualStartDate: computed.actualStartDate || todayStr,
        actualEndDate: computed.actualEndDate,
      };
    });

    const newStartLog = {
      id: `log-${Date.now()}-start`,
      timestamp: nowIso,
      userId: 'person-1',
      userName: 'Project Manager',
      action: 'timer_started',
      details: `Started timer on "${newItemInfo.item.name}"`,
      itemId,
      itemTitle: newItemInfo.item.name,
    };
    workingLogs = [newStartLog, ...workingLogs];

    const updatedData: AppData = {
      ...appData,
      projects: workingProjects,
      settings: {
        ...appData.settings,
        activeTimer: {
          itemId,
          itemPathIds: pathIds,
          startedAt: nowIso,
        },
      },
      activityLogs: workingLogs.slice(0, 50),
    };

    persistData(updatedData);
  };

  // Item Status Update
  const handleUpdateItemStatus = (itemId: string, newStatus: ItemStatus) => {
    const itemInfo = findItemById(appData, itemId);
    const itemTitle = itemInfo ? itemInfo.item.name : 'Task';

    const updatedProjects = updateItemInProjects(appData.projects, itemId, (item) => ({
      ...item,
      status: newStatus,
    }));

    const updatedData: AppData = {
      ...appData,
      projects: updatedProjects,
      activityLogs: addLog(
        'status_change',
        `Updated status to ${newStatus.toUpperCase()} on "${itemTitle}"`,
        itemId,
        itemTitle
      ),
    };

    persistData(updatedData);
  };

  // Save Item (Create Root, Create Sub-Task, or Edit Task & Move Level)
  const handleSaveItem = (
    itemData: Partial<ItemNode> & { targetParentId?: string | 'root'; targetProjectId?: string }
  ) => {
    const { targetParentId, targetProjectId: newTargetProjId, ...fields } = itemData;

    if (editingItem) {
      // 1. First update item details
      let updatedProjects = updateItemInProjects(appData.projects, editingItem.id, (item) => {
        const updated = {
          ...item,
          ...fields,
        };
        if (!fields.targetDate) {
          delete updated.targetDate;
        }
        return updated;
      });

      if (fields.showInSummary === true) {
        updatedProjects = setMilestoneTarget(updatedProjects, editingItem.id);
      }

      // 2. Check if parent or project position changed
      const currentLoc = findItemAndProject(appData.projects, editingItem.id);
      const currentParentId = currentLoc?.parent ? currentLoc.parent.id : 'root';
      const currentProjId = currentLoc?.project.id || '';

      const destProjId = (newTargetProjId && newTargetProjId !== 'all') ? newTargetProjId : currentProjId;
      const destParentId = targetParentId !== undefined ? targetParentId : currentParentId;

      if (destParentId !== currentParentId || destProjId !== currentProjId) {
        updatedProjects = moveItemInProjects(
          updatedProjects,
          editingItem.id,
          destProjId,
          destParentId
        );
      }

      const updatedData: AppData = {
        ...appData,
        projects: updatedProjects,
        activityLogs: addLog('task_updated', `Updated task details for "${itemData.name || editingItem.name}"`),
      };
      persistData(updatedData);
    } else {
      // Create new task
      const newItem: ItemNode = {
        id: `item-${Date.now()}`,
        type: 'item-node',
        name: itemData.name || 'Tugas Baru',
        status: itemData.status || 'not-started',
        assigneeId: itemData.assigneeId || appData.persons[0]?.id,
        reviewerId: itemData.reviewerId || null,
        targetDate: itemData.targetDate,
        actualStartDate: itemData.actualStartDate || null,
        actualEndDate: itemData.actualEndDate || null,
        estimatedSeconds: itemData.estimatedSeconds ?? 0,
        notes: itemData.notes || '',
        sessions: itemData.sessions || [],
        showInSummary: itemData.showInSummary === true,
        subItems: [],
      };

      let updatedProjects = appData.projects;
      const chosenParentId = targetParentId !== undefined && targetParentId !== 'root' ? targetParentId : targetParentItemId;
      const candidateProj =
        newTargetProjId && newTargetProjId !== 'all'
          ? newTargetProjId
          : targetProjectId && targetProjectId !== 'all'
          ? targetProjectId
          : selectedProjectId && selectedProjectId !== 'all'
          ? selectedProjectId
          : appData.projects[0]?.id;
      const projId = candidateProj || appData.projects[0]?.id;

      if (chosenParentId && chosenParentId !== 'root') {
        // Add as child sub-task
        updatedProjects = addSubItemInProjects(appData.projects, chosenParentId, newItem);
      } else {
        // Add as root task in current/target project
        updatedProjects = appData.projects.map((p) => {
          if (p.id === projId) {
            return { ...p, items: [...p.items, newItem] };
          }
          return p;
        });
      }

      if (newItem.showInSummary) {
        updatedProjects = setMilestoneTarget(updatedProjects, newItem.id);
      }

      const updatedData: AppData = {
        ...appData,
        projects: updatedProjects,
        activityLogs: addLog('task_created', `Created task "${newItem.name}"`),
      };
      persistData(updatedData);
    }

    setEditingItem(null);
    setTargetParentItemId(null);
    setTargetProjectId(null);
  };

  // Delete Item
  const handleDeleteItem = (itemId: string) => {
    if (window.confirm('Are you sure you want to delete this task and all its sub-tasks?')) {
      const itemInfo = findItemById(appData, itemId);
      const title = itemInfo ? itemInfo.item.name : 'Task';

      const updatedProjects = deleteItemFromProjects(appData.projects, itemId);
      const updatedData: AppData = {
        ...appData,
        projects: updatedProjects,
        activityLogs: addLog('task_deleted', `Deleted task "${title}"`),
      };
      persistData(updatedData);
    }
  };

  // Reorder Item (Move up / down)
  const handleReorderItem = (itemId: string, direction: 'up' | 'down') => {
    const updatedProjects = reorderItemInProjects(appData.projects, itemId, direction);
    const updatedData: AppData = {
      ...appData,
      projects: updatedProjects,
    };
    persistData(updatedData);
  };

  // Duplicate Item (all variables reset to default except name)
  const handleDuplicateItem = (itemId: string) => {
    const itemInfo = findItemById(appData, itemId);
    const origName = itemInfo ? itemInfo.item.name : 'Task';

    const { projects: updatedProjects, newItem } = duplicateItemInProjects(appData.projects, itemId);
    if (newItem) {
      const updatedData: AppData = {
        ...appData,
        projects: updatedProjects,
        activityLogs: addLog('task_created', `Duplicated task "${origName}" as "${newItem.name}"`),
      };
      persistData(updatedData);
    }
  };

  // Toggle item expanded state (local-only, preserves instantly without cloud sync spam)
  const handleToggleItemExpand = (itemId: string) => {
    const updatedProjects = toggleItemExpandInProjects(appData.projects, itemId);
    const updatedData: AppData = {
      ...appData,
      projects: updatedProjects,
    };
    persistData(updatedData, { localOnly: true });
  };

  // Expand or Collapse all items (local-only)
  const handleSetAllExpand = (expand: boolean) => {
    const updatedProjects = setAllExpandInProjects(appData.projects, expand);
    const updatedData: AppData = {
      ...appData,
      projects: updatedProjects,
    };
    persistData(updatedData, { localOnly: true });
  };

  // Project Handlers
  const handleSaveProject = (title: string, color: string, status: ProjectStatus = 'active', icon?: string, description?: string) => {
    if (editingProject) {
      const updatedProjects = appData.projects.map((p) =>
        p.id === editingProject.id
          ? {
              ...p,
              title,
              color,
              status,
              icon: icon !== undefined ? icon : p.icon,
              description: description !== undefined ? description : p.description,
            }
          : p
      );
      if (status === 'archived' && selectedProjectId === editingProject.id) {
        const remainingActive = updatedProjects.filter((p) => p.status === 'active');
        setSelectedProjectId(remainingActive.length > 0 ? remainingActive[0].id : null);
      }
      persistData({ ...appData, projects: updatedProjects });
    } else {
      const newProj: ProjectNode = {
        id: `proj-${Date.now()}`,
        type: 'project-node',
        title,
        status,
        color,
        icon: icon || '🌳',
        description: description || '',
        items: [],
      };
      persistData({
        ...appData,
        projects: [...appData.projects, newProj],
        activityLogs: addLog('project_created', `Created project "${title}"`),
      });
      if (status === 'active') {
        setSelectedProjectId(newProj.id);
      }
      // Redirect to Tree View (projects) so the user immediately sees the newly created project exists
      handleSelectView('projects');
    }
    setEditingProject(null);
  };

  const handleReorderProject = (projectId: string, direction: 'up' | 'down') => {
    const updatedProjects = reorderProject(appData.projects, projectId, direction);
    persistData({ ...appData, projects: updatedProjects });
  };

  const handleDuplicateProject = (projectId: string) => {
    const origProj = appData.projects.find((p) => p.id === projectId);
    const origTitle = origProj ? origProj.title : 'Project';

    const { projects: updatedProjects, newProject } = duplicateProject(appData.projects, projectId);
    if (newProject) {
      persistData({
        ...appData,
        projects: updatedProjects,
        activityLogs: addLog('project_created', `Duplicated project "${origTitle}" as "${newProject.title}"`),
      });
      setSelectedProjectId(newProject.id);
    }
  };

  const handleArchiveProject = (projectId: string) => {
    const updatedProjects = appData.projects.map((p) =>
      p.id === projectId ? { ...p, status: 'archived' as const } : p
    );
    if (selectedProjectId === projectId) {
      const remainingActive = updatedProjects.filter((p) => p.status === 'active');
      setSelectedProjectId(remainingActive.length > 0 ? remainingActive[0].id : null);
    }
    persistData({ ...appData, projects: updatedProjects });
  };

  const handleRestoreProject = (projectId: string) => {
    const updatedProjects = appData.projects.map((p) =>
      p.id === projectId ? { ...p, status: 'active' as const } : p
    );
    persistData({ ...appData, projects: updatedProjects });
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm('Permanently delete this project?')) {
      const updatedProjects = appData.projects.filter((p) => p.id !== projectId);
      persistData({ ...appData, projects: updatedProjects });
    }
  };

  // Team Person Handlers
  const handleAddPerson = (person: Person) => {
    persistData({
      ...appData,
      persons: [...appData.persons, person],
      activityLogs: addLog('member_created', `Added new team member "${person.name}" (${person.role})`),
    });
  };

  const handleUpdatePerson = (updatedPerson: Person) => {
    const updatedPersons = appData.persons.map((p) =>
      p.id === updatedPerson.id ? updatedPerson : p
    );
    persistData({
      ...appData,
      persons: updatedPersons,
      activityLogs: addLog('member_updated', `Updated details for team member "${updatedPerson.name}"`),
    });
  };

  const handleDeletePerson = (personId: string, transferToPersonId?: string) => {
    const personToDelete = appData.persons.find((p) => p.id === personId);
    const personName = personToDelete ? personToDelete.name : 'Member';
    const targetPerson = transferToPersonId
      ? appData.persons.find((p) => p.id === transferToPersonId)
      : null;

    const { projects: updatedProjects, reassignedCount } = reassignPersonTasksInProjects(
      appData.projects,
      personId,
      transferToPersonId
    );

    const updatedPersons = appData.persons.filter((p) => p.id !== personId);

    const logDetails = targetPerson
      ? `Deleted member "${personName}" and transferred ${reassignedCount} task(s) to "${targetPerson.name}"`
      : `Deleted member "${personName}" and unassigned ${reassignedCount} task(s)`;

    persistData({
      ...appData,
      persons: updatedPersons,
      projects: updatedProjects,
      activityLogs: addLog('member_deleted', logDetails),
    });
  };

  // Modal Open Triggers
  const openAddItemModal = (parentItemId?: string, projectId?: string, initialDate?: string) => {
    setEditingItem(null);
    setTargetParentItemId(parentItemId || null);
    setTargetProjectId(projectId || selectedProjectId);
    setTargetInitialDate(initialDate || null);
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: ItemNode) => {
    setEditingItem(item);
    setTargetParentItemId(null);
    setIsItemModalOpen(true);
  };

  const openProjectModal = (project?: ProjectNode) => {
    if (project && typeof project === 'object' && 'id' in project && typeof (project as any).id === 'string') {
      setEditingProject(project);
    } else {
      setEditingProject(null);
    }
    setIsProjectModalOpen(true);
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('struktur_app_data');
      localStorage.removeItem('struktur_has_unsynced');
      localStorage.removeItem('struktur_last_synced_at');
    } catch {}
    await signOut();
  };

  if (isLoading || (!isInitialCloudLoaded && currentUser && !isDevBypass)) {
    return (
      <div className="min-h-screen w-full bg-[#09090b] flex flex-col items-center justify-center text-[#a1a1aa] gap-3 select-none">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-xs font-medium tracking-wide">
          {isLoading ? 'Memuat akun...' : 'Mengambil data workspace dari cloud...'}
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onSignInGoogle={signInWithGoogle}
        onDevBypass={signInDevBypass}
        isLoading={isLoading}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#101010] text-[#f4f4f5] font-sans antialiased flex flex-row">
      {/* Left Navigation Sidebar */}
      <Header
        currentView={currentView}
        onSelectView={handleSelectView}
        appData={appData}
        onStopTimer={handleStopTimer}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onSignOut={handleSignOut}
        onUpdateTheme={handleUpdateTheme}
        currentUser={currentUser}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onTriggerSync={triggerManualSync}
        onPullFromCloud={forcePullFromCloud}
      />

      {/* Main Content Area - Offset by Sidebar Width on Desktop, and padded bottom for Mobile Bottom Bar */}
      <main
        className="flex-1 min-w-0 ml-0 md:ml-16 min-h-screen w-full overflow-x-clip px-3 sm:px-6 lg:px-8 pt-4 pb-24 md:py-6"
        style={{ overflowX: 'clip' }}
      >
        <div className="w-full">
          {currentView === 'projects' && (
            <TreeView
              appData={appData}
              onSaveData={persistData}
              selectedProjectId={selectedProjectId}
              onSelectProjectFilter={handleSelectProjectFilter}
              onSelectProject={handleSelectProjectFilter}
              selectedPersonId={selectedPersonId}
              onSelectPersonFilter={handleSelectPersonFilter}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              onUpdateItemStatus={handleUpdateItemStatus}
              onOpenAddItemModal={openAddItemModal}
              onOpenEditItemModal={openEditItemModal}
              onDeleteItem={handleDeleteItem}
              onReorderItem={handleReorderItem}
              onDuplicateItem={handleDuplicateItem}
              onReorderProject={handleReorderProject}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={handleDeleteProject}
              onToggleExpand={handleToggleItemExpand}
              onSetAllExpand={handleSetAllExpand}
              onOpenProjectModal={openProjectModal}
              onArchiveProject={handleArchiveProject}
              searchQuery={searchQuery}
              onSearchChange={handleSearchQueryChange}
              sortBy={sortBy}
              onSortByChange={handleSortByChange}
              sortDirection={sortDirection}
              onToggleSortDirection={handleToggleSortDirection}
            />
          )}

          {currentView === 'gantt' && (
            <GanttView
              appData={appData}
              onOpenEditItemModal={openEditItemModal}
              onOpenAddItemModal={openAddItemModal}
              onOpenProjectModal={openProjectModal}
              onUpdateItemStatus={handleUpdateItemStatus}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              onToggleExpand={handleToggleItemExpand}
              onSetAllExpand={handleSetAllExpand}
              selectedProjectId={selectedProjectId}
              onSelectProjectFilter={handleSelectProjectFilter}
              selectedPersonId={selectedPersonId}
              onSelectPersonFilter={handleSelectPersonFilter}
              searchQuery={searchQuery}
              onSearchChange={handleSearchQueryChange}
              timeScale={timeScale}
              onTimeScaleChange={handleTimeScaleChange}
              currentDate={currentReferenceDate}
              onCurrentDateChange={handleReferenceDateChange}
              showWeekends={showWeekends}
              onShowWeekendsChange={handleShowWeekendsChange}
              showCompleted={showCompleted}
              onShowCompletedChange={handleShowCompletedChange}
            />
          )}

          {currentView === 'tasks' && (
            <KanbanView
              appData={appData}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              onUpdateItemStatus={handleUpdateItemStatus}
              onOpenEditItemModal={openEditItemModal}
              onOpenAddItemModal={() => openAddItemModal()}
              onOpenProjectModal={openProjectModal}
              onDuplicateItem={handleDuplicateItem}
              selectedProjectId={selectedProjectId}
              onSelectProjectFilter={handleSelectProjectFilter}
              selectedPersonId={selectedPersonId}
              onSelectPersonFilter={handleSelectPersonFilter}
              searchQuery={searchQuery}
              onSearchChange={handleSearchQueryChange}
              sortBy={sortBy}
              onSortByChange={handleSortByChange}
              sortDirection={sortDirection}
              onToggleSortDirection={handleToggleSortDirection}
            />
          )}

          {currentView === 'timeline' && (
            <TimelineView
              appData={appData}
              onOpenEditItemModal={openEditItemModal}
              onOpenProjectModal={openProjectModal}
              onOpenAddItemModal={openAddItemModal}
              onToggleExpand={handleToggleItemExpand}
              onSetAllExpand={handleSetAllExpand}
              selectedProjectId={selectedProjectId}
              onSelectProjectFilter={handleSelectProjectFilter}
              selectedPersonId={selectedPersonId}
              onSelectPersonFilter={handleSelectPersonFilter}
              searchQuery={searchQuery}
              onSearchChange={handleSearchQueryChange}
              timeScale={timeScale}
              onTimeScaleChange={handleTimeScaleChange}
              currentDate={currentReferenceDate}
              onCurrentDateChange={handleReferenceDateChange}
              showWeekends={showWeekends}
              onShowWeekendsChange={handleShowWeekendsChange}
              showCompleted={showCompleted}
              onShowCompletedChange={handleShowCompletedChange}
            />
          )}

          {currentView === 'calendar' && (
            <CalendarView
              appData={appData}
              onOpenEditItemModal={openEditItemModal}
              onOpenAddItemModal={openAddItemModal}
              selectedProjectId={selectedProjectId}
              onSelectProjectFilter={handleSelectProjectFilter}
              selectedPersonId={selectedPersonId}
              onSelectPersonFilter={handleSelectPersonFilter}
              searchQuery={searchQuery}
              onSearchChange={handleSearchQueryChange}
              timeScale={timeScale}
              onTimeScaleChange={handleTimeScaleChange}
              currentDate={currentReferenceDate}
              onCurrentDateChange={handleReferenceDateChange}
              showWeekends={showWeekends}
              onShowWeekendsChange={handleShowWeekendsChange}
              showCompleted={showCompleted}
              onShowCompletedChange={handleShowCompletedChange}
            />
          )}

          {currentView === 'dashboard' && (
            <DashboardView
              appData={appData}
              onSelectView={handleSelectView}
              onOpenAddItemModal={() => openAddItemModal()}
              onOpenCreateProjectModal={() => openProjectModal()}
            />
          )}

          {currentView === 'analytics' && (
            <SummaryView
              appData={appData}
              onOpenEditItemModal={openEditItemModal}
              selectedProjectId={selectedProjectId}
              onSelectProjectFilter={handleSelectProjectFilter}
              selectedPersonId={selectedPersonId}
              onSelectPersonFilter={handleSelectPersonFilter}
              searchQuery={searchQuery}
              onSearchChange={handleSearchQueryChange}
              timeScale={timeScale}
              onTimeScaleChange={handleTimeScaleChange}
              currentDate={currentReferenceDate}
              onCurrentDateChange={handleReferenceDateChange}
            />
          )}

          {currentView === 'team' && (
            <TeamView
              appData={appData}
              onAddPerson={handleAddPerson}
              onUpdatePerson={handleUpdatePerson}
              onDeletePerson={handleDeletePerson}
            />
          )}

          {currentView === 'archived' && (
            <ArchivedView
              appData={appData}
              onRestoreProject={handleRestoreProject}
              onDeleteProject={handleDeleteProject}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        onSaveItem={handleSaveItem}
        onDuplicateItem={handleDuplicateItem}
        onDeleteItem={handleDeleteItem}
        onStartTimer={handleStartTimer}
        onStopTimer={handleStopTimer}
        isTimerRunning={!!appData.settings.activeTimer && editingItem?.id === appData.settings.activeTimer.itemId}
        initialItem={editingItem}
        initialTargetDate={targetInitialDate}
        parentItemId={targetParentItemId}
        currentProjectId={
          targetProjectId ||
          (selectedProjectId && selectedProjectId !== 'all'
            ? selectedProjectId.includes(',')
              ? selectedProjectId.split(',')[0]
              : selectedProjectId
            : '')
        }
        projects={appData.projects.filter((p) => p.status === 'active')}
        persons={appData.persons}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSaveProject={handleSaveProject}
        onArchiveProject={handleArchiveProject}
        onDuplicateProject={handleDuplicateProject}
        initialProject={editingProject}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        appData={appData}
        onImportJson={(data) => persistData(data)}
        onUpdateTheme={handleUpdateTheme}
        currentUser={currentUser}
        isDevBypass={isDevBypass}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        fetchCloudSnapshotInfo={fetchCloudSnapshotInfo}
        forcePushToCloud={forcePushToCloud}
        forcePullFromCloud={forcePullFromCloud}
        fetchCloudHistory={fetchCloudHistory}
        restoreCloudSnapshot={restoreCloudSnapshot}
        onResetDatabase={() => {
          fetch('/api/reset-data', { method: 'POST' })
            .then((r) => r.json())
            .then((res) => {
              if (res.data) {
                persistData(res.data);
              }
            })
            .catch(() => {
              persistData(initialAppData);
            });
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceApp />
    </AuthProvider>
  );
}

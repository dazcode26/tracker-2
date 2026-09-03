import { ItemNode, ProjectNode, AppData, Session, ItemStatus } from '../types';

/**
 * Standard status styling configuration.
 * - not-started: Gray (#71717a)
 * - in-progress: Orange (#f97316)
 * - review: Amber (#f59e0b)
 * - completed: Emerald Green (#10b981)
 */
export function getStatusConfig(status?: ItemStatus) {
  switch (status) {
    case 'completed':
      return {
        label: 'Completed',
        color: '#10b981',
        dotBg: 'bg-[#10b981]',
        textColor: 'text-[#10b981]',
        badgeBg: 'bg-[#10b981]/15',
        badgeBorder: 'border-[#10b981]/30',
      };
    case 'in-progress':
      return {
        label: 'In Progress',
        color: '#f97316',
        dotBg: 'bg-orange-500',
        textColor: 'text-orange-400',
        badgeBg: 'bg-orange-500/15',
        badgeBorder: 'border-orange-500/30',
      };
    case 'review':
      return {
        label: 'Review',
        color: '#f59e0b',
        dotBg: 'bg-[#f59e0b]',
        textColor: 'text-[#f59e0b]',
        badgeBg: 'bg-[#f59e0b]/15',
        badgeBorder: 'border-[#f59e0b]/30',
      };
    case 'not-started':
    default:
      return {
        label: 'Not Started',
        color: '#71717a',
        dotBg: 'bg-[#71717a]',
        textColor: 'text-[#71717a]',
        badgeBg: 'bg-[#71717a]/15',
        badgeBorder: 'border-[#71717a]/30',
      };
  }
}

/**
 * Calculates total logged seconds for an item, including all its recursive sub-items and sessions.
 */
export function getItemLoggedSeconds(item: ItemNode, activeTimerItemId?: string | null, activeTimerStartedAt?: string | null): number {
  let directSeconds = 0;
  if (item.sessions && Array.isArray(item.sessions)) {
    directSeconds = item.sessions.reduce((acc, s) => acc + (s.loggedSeconds || 0), 0);
  }

  // If this item is currently running in active timer, add elapsed time
  if (activeTimerItemId === item.id && activeTimerStartedAt) {
    const elapsed = Math.floor((Date.now() - new Date(activeTimerStartedAt).getTime()) / 1000);
    if (elapsed > 0) {
      directSeconds += elapsed;
    }
  }

  let subItemsSeconds = 0;
  if (item.subItems && Array.isArray(item.subItems)) {
    subItemsSeconds = item.subItems.reduce(
      (acc, child) => acc + getItemLoggedSeconds(child, activeTimerItemId, activeTimerStartedAt),
      0
    );
  }

  return directSeconds + subItemsSeconds;
}

/**
 * Calculates total logged seconds for an entire project.
 */
export function getProjectLoggedSeconds(project: ProjectNode, activeTimerItemId?: string | null, activeTimerStartedAt?: string | null): number {
  if (!project.items || !Array.isArray(project.items)) return 0;
  return project.items.reduce(
    (acc, item) => acc + getItemLoggedSeconds(item, activeTimerItemId, activeTimerStartedAt),
    0
  );
}

/**
 * Calculates total estimated seconds for an item including sub-items.
 */
export function getItemEstimatedSeconds(item: ItemNode): number {
  const direct = item.estimatedSeconds || 0;
  let subEstimated = 0;
  if (item.subItems && Array.isArray(item.subItems)) {
    subEstimated = item.subItems.reduce((acc, child) => acc + getItemEstimatedSeconds(child), 0);
  }
  return direct > 0 ? direct : subEstimated;
}

/**
 * Format seconds into human readable format like "4h 21 min" or "00:14:22"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 min';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins} min`;
  }
  if (mins > 0) {
    return `${mins} min`;
  }
  return `${secs}s`;
}

export function formatTimerClock(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Recursively find an item by ID across an array of projects.
 */
export function findItemAndProject(
  projects: ProjectNode[],
  itemId: string
): { item: ItemNode; project: ProjectNode; parent: ItemNode | null; path: ItemNode[] } | null {
  for (const project of projects) {
    for (const item of project.items) {
      const result = searchItemWithParentRecursive(item, itemId, null, [item]);
      if (result) {
        return { item: result.item, project, parent: result.parent, path: result.path };
      }
    }
  }
  return null;
}

function searchItemWithParentRecursive(
  current: ItemNode,
  targetId: string,
  parent: ItemNode | null,
  currentPath: ItemNode[]
): { item: ItemNode; parent: ItemNode | null; path: ItemNode[] } | null {
  if (current.id === targetId) {
    return { item: current, parent, path: currentPath };
  }
  if (current.subItems) {
    for (const child of current.subItems) {
      const res = searchItemWithParentRecursive(child, targetId, current, [...currentPath, child]);
      if (res) return res;
    }
  }
  return null;
}

/**
 * Get all descendant IDs of an item (to prevent selecting them as parents).
 */
export function getDescendantIds(item: ItemNode): Set<string> {
  const ids = new Set<string>();
  function collect(node: ItemNode) {
    ids.add(node.id);
    if (node.subItems) {
      node.subItems.forEach(collect);
    }
  }
  collect(item);
  return ids;
}

/**
 * Recursively find an item by ID across all projects.
 */
export function findItemById(
  data: AppData,
  itemId: string
): { item: ItemNode; project: ProjectNode; path: ItemNode[] } | null {
  for (const project of data.projects) {
    for (const item of project.items) {
      const result = searchItemRecursive(item, itemId, [item]);
      if (result) {
        return { item: result.item, project, path: result.path };
      }
    }
  }
  return null;
}

function searchItemRecursive(
  current: ItemNode,
  targetId: string,
  currentPath: ItemNode[]
): { item: ItemNode; path: ItemNode[] } | null {
  if (current.id === targetId) {
    return { item: current, path: currentPath };
  }
  if (current.subItems) {
    for (const child of current.subItems) {
      const res = searchItemRecursive(child, targetId, [...currentPath, child]);
      if (res) return res;
    }
  }
  return null;
}

/**
 * Helper to produce path IDs array for activeTimer e.g. [projectId, ...itemIds]
 */
export function buildItemPathIds(data: AppData, itemId: string): string[] {
  const found = findItemById(data, itemId);
  if (!found) return [itemId];
  return [found.project.id, ...found.path.map((p) => p.id)];
}

/**
 * Recursively update an item inside the data structure.
 */
export function updateItemInProjects(
  projects: ProjectNode[],
  targetItemId: string,
  updateFn: (item: ItemNode) => ItemNode
): ProjectNode[] {
  return projects.map((project) => ({
    ...project,
    items: updateItemsRecursive(project.items, targetItemId, updateFn),
  }));
}

/**
 * Toggle the isExpanded state of a specific item or project.
 * If default is undefined, it defaults to expanded (true), so toggling makes it false.
 */
export function toggleItemExpandInProjects(
  projects: ProjectNode[],
  targetItemId: string
): ProjectNode[] {
  return updateItemInProjects(projects, targetItemId, (item) => ({
    ...item,
    isExpanded: item.isExpanded === undefined ? false : !item.isExpanded,
  }));
}

function updateItemsRecursive(
  items: ItemNode[],
  targetItemId: string,
  updateFn: (item: ItemNode) => ItemNode
): ItemNode[] {
  return items.map((item) => {
    if (item.id === targetItemId) {
      return updateFn(item);
    }
    if (item.subItems && item.subItems.length > 0) {
      return {
        ...item,
        subItems: updateItemsRecursive(item.subItems, targetItemId, updateFn),
      };
    }
    return item;
  });
}

/**
 * Recursively add a sub-item to a parent item in projects.
 */
export function addSubItemInProjects(
  projects: ProjectNode[],
  parentItemId: string,
  newItem: ItemNode
): ProjectNode[] {
  return projects.map((project) => ({
    ...project,
    items: addSubItemRecursive(project.items, parentItemId, newItem),
  }));
}

function addSubItemRecursive(
  items: ItemNode[],
  parentItemId: string,
  newItem: ItemNode
): ItemNode[] {
  return items.map((item) => {
    if (item.id === parentItemId) {
      return {
        ...item,
        subItems: [...(item.subItems || []), newItem],
      };
    }
    if (item.subItems && item.subItems.length > 0) {
      return {
        ...item,
        subItems: addSubItemRecursive(item.subItems, parentItemId, newItem),
      };
    }
    return item;
  });
}

/**
 * Recursively delete an item from projects.
 */
export function deleteItemFromProjects(
  projects: ProjectNode[],
  targetItemId: string
): ProjectNode[] {
  return projects.map((project) => ({
    ...project,
    items: deleteItemRecursive(project.items, targetItemId),
  }));
}

function deleteItemRecursive(items: ItemNode[], targetItemId: string): ItemNode[] {
  return items
    .filter((item) => item.id !== targetItemId)
    .map((item) => ({
      ...item,
      subItems: item.subItems ? deleteItemRecursive(item.subItems, targetItemId) : [],
    }));
}

/**
 * Move / reparent an item inside a project or across projects.
 * If newParentItemId is 'root' or null, item becomes root-level in targetProjectId.
 */
export function moveItemInProjects(
  projects: ProjectNode[],
  itemId: string,
  targetProjectId: string,
  newParentItemId: string | 'root' | null
): ProjectNode[] {
  const found = findItemAndProject(projects, itemId);
  if (!found) return projects;

  const itemToMove = found.item;

  // 1. Remove item from its existing location
  const projectsWithoutItem = deleteItemFromProjects(projects, itemId);

  // 2. Insert item into target location
  return projectsWithoutItem.map((proj) => {
    if (proj.id !== targetProjectId) return proj;

    if (!newParentItemId || newParentItemId === 'root') {
      return {
        ...proj,
        items: [...proj.items, itemToMove],
      };
    } else {
      return {
        ...proj,
        items: addSubItemRecursive(proj.items, newParentItemId, itemToMove),
      };
    }
  });
}

/**
 * Reorder / swap an item with its sibling above or below.
 */
export function reorderItemInProjects(
  projects: ProjectNode[],
  itemId: string,
  direction: 'up' | 'down'
): ProjectNode[] {
  return projects.map((proj) => {
    // Check if item is at root level of this project
    const rootIndex = proj.items.findIndex((it) => it.id === itemId);
    if (rootIndex !== -1) {
      const targetIndex = direction === 'up' ? rootIndex - 1 : rootIndex + 1;
      if (targetIndex < 0 || targetIndex >= proj.items.length) {
        return proj;
      }
      const newItems = [...proj.items];
      const temp = newItems[rootIndex];
      newItems[rootIndex] = newItems[targetIndex];
      newItems[targetIndex] = temp;
      return { ...proj, items: newItems };
    }

    // Otherwise, search recursively inside subItems
    return {
      ...proj,
      items: reorderInSubItemsRecursive(proj.items, itemId, direction),
    };
  });
}

function reorderInSubItemsRecursive(
  items: ItemNode[],
  itemId: string,
  direction: 'up' | 'down'
): ItemNode[] {
  return items.map((item) => {
    if (!item.subItems || item.subItems.length === 0) return item;

    const childIndex = item.subItems.findIndex((child) => child.id === itemId);
    if (childIndex !== -1) {
      const targetIndex = direction === 'up' ? childIndex - 1 : childIndex + 1;
      if (targetIndex < 0 || targetIndex >= item.subItems.length) {
        return item;
      }
      const newSubItems = [...item.subItems];
      const temp = newSubItems[childIndex];
      newSubItems[childIndex] = newSubItems[targetIndex];
      newSubItems[targetIndex] = temp;
      return {
        ...item,
        subItems: newSubItems,
      };
    }

    // Recurse deeper
    return {
      ...item,
      subItems: reorderInSubItemsRecursive(item.subItems, itemId, direction),
    };
  });
}

/**
 * Recursively clone an ItemNode and all its subItems.
 * All variables except name are reset to clean defaults:
 * - name: "${orig.name} (Copy)" for the top cloned task, and orig.name for descendant sub-tasks
 * - id: newly generated unique id
 * - status: 'not-started'
 * - targetDate: undefined
 * - actualStartDate: null
 * - actualEndDate: null
 * - estimatedSeconds: 0
 * - notes: preserved from original task
 * - sessions: []
 * - assigneeId: orig.assigneeId
 * - subItems: recursively cloned with defaults
 */
export function cloneItemWithDefaultsRecursive(orig: ItemNode, isRootClone = true): ItemNode {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${Math.random().toString(36).substring(2, 5)}`,
    type: 'item-node',
    name: isRootClone ? `${orig.name} (Copy)` : orig.name,
    status: 'not-started',
    targetDate: undefined,
    actualStartDate: null,
    actualEndDate: null,
    estimatedSeconds: 0,
    notes: orig.notes || '',
    sessions: [],
    assigneeId: orig.assigneeId,
    reviewerId: orig.reviewerId || null,
    subItems: (orig.subItems || []).map((child) => cloneItemWithDefaultsRecursive(child, false)),
  };
}

/**
 * Duplicate a task in projects along with all its sub-tasks recursively.
 * All variables except name are reset to clean defaults.
 * The duplicate is inserted immediately next to the original item as a sibling.
 */
export function duplicateItemInProjects(
  projects: ProjectNode[],
  itemId: string
): { projects: ProjectNode[]; newItem: ItemNode | null } {
  let createdItem: ItemNode | null = null;

  const newProjects = projects.map((proj) => {
    // Check if at root level of this project
    const rootIndex = proj.items.findIndex((it) => it.id === itemId);
    if (rootIndex !== -1) {
      const orig = proj.items[rootIndex];
      createdItem = cloneItemWithDefaultsRecursive(orig, true);

      const newItems = [...proj.items];
      newItems.splice(rootIndex + 1, 0, createdItem);
      return { ...proj, items: newItems };
    }

    // Otherwise look recursively inside subItems
    const { items: newItems, newItem } = duplicateInSubItemsRecursive(proj.items, itemId);
    if (newItem) {
      createdItem = newItem;
    }
    return { ...proj, items: newItems };
  });

  return { projects: newProjects, newItem: createdItem };
}

function duplicateInSubItemsRecursive(
  items: ItemNode[],
  itemId: string
): { items: ItemNode[]; newItem: ItemNode | null } {
  let createdItem: ItemNode | null = null;

  const newItems = items.map((item) => {
    if (!item.subItems || item.subItems.length === 0) return item;

    const childIndex = item.subItems.findIndex((c) => c.id === itemId);
    if (childIndex !== -1) {
      const orig = item.subItems[childIndex];
      createdItem = cloneItemWithDefaultsRecursive(orig, true);

      const newSubItems = [...item.subItems];
      newSubItems.splice(childIndex + 1, 0, createdItem);
      return {
        ...item,
        subItems: newSubItems,
      };
    }

    // Recurse
    const res = duplicateInSubItemsRecursive(item.subItems, itemId);
    if (res.newItem) {
      createdItem = res.newItem;
    }
    return {
      ...item,
      subItems: res.items,
    };
  });

  return { items: newItems, newItem: createdItem };
}

/**
 * Collect all items flat for Kanban / My Tasks view.
 */
export interface FlatItem {
  item: ItemNode;
  project: ProjectNode;
  parentPath: string[];
  depth: number;
}

export function getAllFlatItems(projects: ProjectNode[]): FlatItem[] {
  const result: FlatItem[] = [];

  for (const project of projects) {
    for (const item of project.items) {
      collectFlatRecursive(item, project, [project.title], 0, result);
    }
  }

  return result;
}

/**
 * Collect flat items respecting the isExpanded property of items and projects.
 */
export function getVisibleFlatItems(projects: ProjectNode[]): FlatItem[] {
  const result: FlatItem[] = [];

  for (const project of projects) {
    for (const item of project.items) {
      collectVisibleFlatRecursive(item, project, [project.title], 0, result);
    }
  }

  return result;
}

function collectVisibleFlatRecursive(
  item: ItemNode,
  project: ProjectNode,
  parentPath: string[],
  depth: number,
  result: FlatItem[]
) {
  result.push({ item, project, parentPath, depth });
  const isExpanded = item.isExpanded !== false;
  if (isExpanded && item.subItems && item.subItems.length > 0) {
    for (const child of item.subItems) {
      collectVisibleFlatRecursive(child, project, [...parentPath, item.name], depth + 1, result);
    }
  }
}

/**
 * Set isExpanded on all items in projects
 */
export function setAllExpandInProjects(projects: ProjectNode[], expand: boolean): ProjectNode[] {
  return projects.map((proj) => ({
    ...proj,
    isExpanded: expand,
    items: setExpandRecursive(proj.items, expand),
  }));
}

function setExpandRecursive(items: ItemNode[], expand: boolean): ItemNode[] {
  return items.map((it) => ({
    ...it,
    isExpanded: expand,
    subItems: it.subItems ? setExpandRecursive(it.subItems, expand) : [],
  }));
}

function collectFlatRecursive(
  item: ItemNode,
  project: ProjectNode,
  parentPath: string[],
  depth: number,
  result: FlatItem[]
) {
  result.push({ item, project, parentPath, depth });
  if (item.subItems && item.subItems.length > 0) {
    for (const child of item.subItems) {
      collectFlatRecursive(child, project, [...parentPath, item.name], depth + 1, result);
    }
  }
}

/**
 * Collect all sessions from an item and all its sub-items recursively.
 */
export function getAllItemSessionsRecursive(
  item: ItemNode,
  activeTimerItemId?: string | null,
  activeTimerStartedAt?: string | null
): Session[] {
  const sessions: Session[] = [];

  function collect(node: ItemNode) {
    if (node.sessions && Array.isArray(node.sessions)) {
      node.sessions.forEach((s) => {
        sessions.push({ ...s });
      });
    }
    // Check if active timer is running on this node
    if (
      activeTimerItemId &&
      activeTimerItemId === node.id &&
      activeTimerStartedAt
    ) {
      const elapsed = Math.max(1, Math.floor((Date.now() - new Date(activeTimerStartedAt).getTime()) / 1000));
      sessions.push({
        id: `live-timer-${node.id}`,
        type: 'timer',
        startedAt: activeTimerStartedAt,
        endedAt: new Date().toISOString(),
        loggedSeconds: elapsed,
        title: `Live Session: ${node.name}`,
      });
    }

    if (node.subItems && Array.isArray(node.subItems)) {
      node.subItems.forEach(collect);
    }
  }

  collect(item);
  return sessions;
}

/**
 * Collect items for Calendar / Summary views based on showInSummary (Reportable Level).
 * - If an item has showInSummary === true, it becomes the reporting representative for all its descendants.
 * - If a sub-tree has no showInSummary marked anywhere, it falls back to leaf items.
 */
export function getReportableFlatItems(projects: ProjectNode[]): FlatItem[] {
  const result: FlatItem[] = [];

  for (const project of projects) {
    for (const item of project.items) {
      collectReportableRecursive(item, project, [project.title], 0, result);
    }
  }

  return result;
}

function collectReportableRecursive(
  item: ItemNode,
  project: ProjectNode,
  parentPath: string[],
  depth: number,
  result: FlatItem[]
) {
  // If this item is explicitly marked as Summary/Calendar Milestone
  if (item.showInSummary === true) {
    result.push({ item, project, parentPath, depth });
    return;
  }

  // If item has sub-items, check if any descendant is marked or continue traversing
  if (item.subItems && item.subItems.length > 0) {
    for (const child of item.subItems) {
      collectReportableRecursive(child, project, [...parentPath, item.name], depth + 1, result);
    }
  } else {
    // Leaf item fallback (when neither parent nor this item has explicit showInSummary)
    result.push({ item, project, parentPath, depth });
  }
}

/**
 * Collect only innermost/leaf items (items with no sub-items) for Tasks view.
 */
export function getLeafFlatItems(projects: ProjectNode[]): FlatItem[] {
  const result: FlatItem[] = [];

  for (const project of projects) {
    for (const item of project.items) {
      collectLeafRecursive(item, project, [project.title], 0, result);
    }
  }

  return result;
}

function collectLeafRecursive(
  item: ItemNode,
  project: ProjectNode,
  parentPath: string[],
  depth: number,
  result: FlatItem[]
) {
  if (item.subItems && item.subItems.length > 0) {
    for (const child of item.subItems) {
      collectLeafRecursive(child, project, [...parentPath, item.name], depth + 1, result);
    }
  } else {
    // Innermost task with no sub-tasks
    result.push({ item, project, parentPath, depth });
  }
}

/**
 * Formats a target date string (e.g. YYYY-MM-DD) into a relative counter (e.g., "5 days left", "Today", "2 days overdue").
 */
export function formatDaysLeft(targetDateStr?: string): { text: string; fullDate: string; isOverdue: boolean } {
  if (!targetDateStr) {
    return { text: '-', fullDate: 'No target date set', isOverdue: false };
  }

  const parts = targetDateStr.split('-');
  let target: Date;
  if (parts.length === 3 && parts[0].length === 4) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    target = new Date(year, month, day);
  } else {
    target = new Date(targetDateStr);
  }

  if (isNaN(target.getTime())) {
    return { text: '-', fullDate: 'Invalid date', isOverdue: false };
  }

  const fullDate = target.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetMidnight = new Date(target);
  targetMidnight.setHours(0, 0, 0, 0);

  const diffTime = targetMidnight.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { text: 'Today', fullDate: `Target: ${fullDate} (Today)`, isOverdue: false };
  }
  if (diffDays === 1) {
    return { text: '1 day left', fullDate: `Target: ${fullDate} (1 day left)`, isOverdue: false };
  }
  if (diffDays > 1) {
    return { text: `${diffDays} days left`, fullDate: `Target: ${fullDate} (${diffDays} days left)`, isOverdue: false };
  }
  if (diffDays === -1) {
    return { text: '1 day overdue', fullDate: `Target: ${fullDate} (1 day overdue)`, isOverdue: true };
  }
  return { text: `${Math.abs(diffDays)} days overdue`, fullDate: `Target: ${fullDate} (${Math.abs(diffDays)} days overdue)`, isOverdue: true };
}

/**
 * Sorts sessions chronologically by startedAt date (oldest date first / ascending).
 */
export function sortSessionsOldestFirst(sessionsList: Session[]): Session[] {
  if (!Array.isArray(sessionsList) || sessionsList.length <= 1) return sessionsList || [];
  return [...sessionsList].sort((a, b) => {
    const timeA = new Date(a.startedAt).getTime() || 0;
    const timeB = new Date(b.startedAt).getTime() || 0;
    return timeA - timeB;
  });
}

/**
 * Automatically calculates/updates actualStartDate and actualEndDate from a session history list.
 * If sessions exist, it strictly calculates the boundaries from recorded sessions.
 */
export function computeActualDatesFromSessions(
  sessions: Session[],
  currentStartDate?: string | null,
  currentEndDate?: string | null
): { actualStartDate: string | null; actualEndDate: string | null } {
  const dates: Date[] = [];

  if (sessions && sessions.length > 0) {
    for (const s of sessions) {
      if (s.startedAt) {
        const d = parseDateSafe(s.startedAt);
        if (d) dates.push(d);
      }
      if (s.endedAt) {
        const d = parseDateSafe(s.endedAt);
        if (d) dates.push(d);
      }
    }
  } else {
    // Only fallback to manual start/end dates if NO sessions exist
    if (currentStartDate) {
      const d = parseDateSafe(currentStartDate);
      if (d) dates.push(d);
    }
    if (currentEndDate) {
      const d = parseDateSafe(currentEndDate);
      if (d) dates.push(d);
    }
  }

  if (dates.length === 0) {
    return {
      actualStartDate: null,
      actualEndDate: null,
    };
  }

  let minMs = Infinity;
  let maxMs = -Infinity;
  let minDateStr = '';
  let maxDateStr = '';

  for (const d of dates) {
    const time = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const isoDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (time < minMs) {
      minMs = time;
      minDateStr = isoDateStr;
    }
    if (time > maxMs) {
      maxMs = time;
      maxDateStr = isoDateStr;
    }
  }

  return {
    actualStartDate: minDateStr || null,
    actualEndDate: maxDateStr || null,
  };
}

/**
 * Validates manual realization dates against recorded session timer history (boundary check).
 */
export function validateRealizationDates(
  sessions: Session[],
  manualStartDate?: string | null,
  manualEndDate?: string | null
): { valid: boolean; error?: string; earliestSessionDateStr?: string; latestSessionDateStr?: string } {
  // Check if start date > end date
  if (manualStartDate && manualEndDate) {
    const startObj = new Date(manualStartDate);
    const endObj = new Date(manualEndDate);
    if (!isNaN(startObj.getTime()) && !isNaN(endObj.getTime()) && startObj > endObj) {
      return {
        valid: false,
        error: 'Actual start date cannot be later than actual end date.',
      };
    }
  }

  if (!sessions || sessions.length === 0) {
    return { valid: true };
  }

  let earliestMs = Infinity;
  let latestMs = -Infinity;
  let earliestDateStr = '';
  let latestDateStr = '';

  for (const s of sessions) {
    const startObj = new Date(s.startedAt);
    const startMs = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate()).getTime();
    if (!isNaN(startMs) && startMs < earliestMs) {
      earliestMs = startMs;
      earliestDateStr = startObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    const endStr = s.endedAt || s.startedAt;
    const endObj = new Date(endStr);
    const endMs = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate()).getTime();
    if (!isNaN(endMs) && endMs > latestMs) {
      latestMs = endMs;
      latestDateStr = endObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }

  // Validate manualStartDate against earliest session
  if (manualStartDate) {
    const mStart = new Date(manualStartDate);
    const mStartMs = new Date(mStart.getFullYear(), mStart.getMonth(), mStart.getDate()).getTime();
    if (!isNaN(mStartMs) && mStartMs > earliestMs) {
      return {
        valid: false,
        error: `Actual Start Date Conflict: Actual start date (${mStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}) conflicts because the first timer session was recorded on ${earliestDateStr}. Start date cannot be after the first session.`,
        earliestSessionDateStr: earliestDateStr,
        latestSessionDateStr: latestDateStr,
      };
    }
  }

  // Validate manualEndDate against latest session
  if (manualEndDate) {
    const mEnd = new Date(manualEndDate);
    const mEndMs = new Date(mEnd.getFullYear(), mEnd.getMonth(), mEnd.getDate()).getTime();
    if (!isNaN(mEndMs) && mEndMs < latestMs) {
      return {
        valid: false,
        error: `Actual End Date Conflict: Actual end date (${mEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}) conflicts because the last timer session was recorded on ${latestDateStr}. End date cannot be before the last session.`,
        earliestSessionDateStr: earliestDateStr,
        latestSessionDateStr: latestDateStr,
      };
    }
  }

  return {
    valid: true,
    earliestSessionDateStr: earliestDateStr,
    latestSessionDateStr: latestDateStr,
  };
}

/**
 * Safely parses ISO or YYYY-MM-DD string to Date without timezone shifts.
 */
function parseDateSafe(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Collects earliest start date and latest end date for an item and all its subItems.
 */
export function getRealizationDatesForTree(item: ItemNode): { minDate: Date | null; maxDate: Date | null } {
  const dates: Date[] = [];

  const addDateStr = (dateStr?: string | null) => {
    const d = parseDateSafe(dateStr);
    if (d) dates.push(d);
  };

  const collect = (node: ItemNode) => {
    addDateStr(node.actualStartDate);
    addDateStr(node.actualEndDate);

    if (node.sessions) {
      node.sessions.forEach((s) => {
        addDateStr(s.startedAt);
        if (s.endedAt) addDateStr(s.endedAt);
      });
    }

    if (node.subItems) {
      node.subItems.forEach((child) => collect(child));
    }
  };

  collect(item);

  if (dates.length === 0) {
    return { minDate: null, maxDate: null };
  }

  let minMs = Infinity;
  let maxMs = -Infinity;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const d of dates) {
    const time = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (time < minMs) {
      minMs = time;
      minDate = d;
    }
    if (time > maxMs) {
      maxMs = time;
      maxDate = d;
    }
  }

  return { minDate, maxDate };
}

/**
 * Collects earliest start date and latest end date for all items in a project.
 */
export function getRealizationDatesForProject(project: ProjectNode): { minDate: Date | null; maxDate: Date | null } {
  const dates: Date[] = [];

  const addDateStr = (dateStr?: string | null) => {
    const d = parseDateSafe(dateStr);
    if (d) dates.push(d);
  };

  addDateStr(project.actualStartDate);
  addDateStr(project.actualEndDate);

  const collect = (node: ItemNode) => {
    addDateStr(node.actualStartDate);
    addDateStr(node.actualEndDate);

    if (node.sessions) {
      node.sessions.forEach((s) => {
        addDateStr(s.startedAt);
        if (s.endedAt) addDateStr(s.endedAt);
      });
    }

    if (node.subItems) {
      node.subItems.forEach((child) => collect(child));
    }
  };

  if (project.items) {
    project.items.forEach(collect);
  }

  if (dates.length === 0) {
    return { minDate: null, maxDate: null };
  }

  let minMs = Infinity;
  let maxMs = -Infinity;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const d of dates) {
    const time = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (time < minMs) {
      minMs = time;
      minDate = d;
    }
    if (time > maxMs) {
      maxMs = time;
      maxDate = d;
    }
  }

  return { minDate, maxDate };
}

/**
 * Formats realization start and end date range for display next to Timer.
 * Example: "1 Aug 2026 - 2 Aug 2026" or "1 Aug 2026"
 */
export function formatStartEndDateRange(item: ItemNode): string {
  const { minDate, maxDate } = getRealizationDatesForTree(item);

  if (!minDate) {
    return '';
  }

  const formatDate = (d: Date): string => {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const minStr = formatDate(minDate);

  if (!maxDate) {
    return minStr;
  }

  const isSameDay =
    minDate.getFullYear() === maxDate.getFullYear() &&
    minDate.getMonth() === maxDate.getMonth() &&
    minDate.getDate() === maxDate.getDate();

  if (isSameDay) {
    return minStr;
  }

  const maxStr = formatDate(maxDate);
  return `${minStr} - ${maxStr}`;
}

/**
 * Recursively reassigns all tasks assigned to oldPersonId to newPersonId (or unassigns if undefined).
 * Returns updated projects array and count of reassigned tasks.
 */
export function reassignPersonTasksInProjects(
  projects: ProjectNode[],
  oldPersonId: string,
  newPersonId?: string
): { projects: ProjectNode[]; reassignedCount: number } {
  let count = 0;

  const updateItem = (item: ItemNode): ItemNode => {
    const updatedItem: ItemNode = { ...item };
    if (updatedItem.assigneeId === oldPersonId) {
      updatedItem.assigneeId = newPersonId || undefined;
      count++;
    }
    if (updatedItem.subItems && Array.isArray(updatedItem.subItems)) {
      updatedItem.subItems = updatedItem.subItems.map(updateItem);
    }
    return updatedItem;
  };

  const updatedProjects = projects.map((project) => ({
    ...project,
    items: (project.items || []).map(updateItem),
  }));

  return { projects: updatedProjects, reassignedCount: count };
}

/**
 * Reorder / Move an active project up or down in the projects list.
 */
export function reorderProject(
  projects: ProjectNode[],
  projectId: string,
  direction: 'up' | 'down'
): ProjectNode[] {
  const activeProjects = projects.filter((p) => p.status === 'active');
  const activeIdx = activeProjects.findIndex((p) => p.id === projectId);
  if (activeIdx === -1) return projects;

  const targetActiveIdx = direction === 'up' ? activeIdx - 1 : activeIdx + 1;
  if (targetActiveIdx < 0 || targetActiveIdx >= activeProjects.length) {
    return projects;
  }

  const targetProjId = activeProjects[targetActiveIdx].id;
  const fromIdx = projects.findIndex((p) => p.id === projectId);
  const toIdx = projects.findIndex((p) => p.id === targetProjId);
  if (fromIdx === -1 || toIdx === -1) return projects;

  const newProjects = [...projects];
  const temp = newProjects[fromIdx];
  newProjects[fromIdx] = newProjects[toIdx];
  newProjects[toIdx] = temp;
  return newProjects;
}

/**
 * Duplicate an entire project along with all its tasks and nested sub-tasks.
 * New unique IDs are generated for project and tasks, sessions and actual dates reset,
 * and the new project is placed directly below the original.
 */
export function duplicateProject(
  projects: ProjectNode[],
  projectId: string
): { projects: ProjectNode[]; newProject: ProjectNode | null } {
  const index = projects.findIndex((p) => p.id === projectId);
  if (index === -1) return { projects, newProject: null };

  const orig = projects[index];
  const newProjId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const clonedItems = (orig.items || []).map((item) => cloneItemWithDefaultsRecursive(item, false));

  const newProject: ProjectNode = {
    id: newProjId,
    type: 'project-node',
    title: `${orig.title} (Copy)`,
    color: orig.color || '#f97316',
    status: 'active',
    items: clonedItems,
  };

  const newProjects = [...projects];
  newProjects.splice(index + 1, 0, newProject);

  return { projects: newProjects, newProject };
}



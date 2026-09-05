import { ItemNode, ProjectNode, ItemStatus } from '../types';
import { getItemLoggedSeconds } from './treeUtils';

export type TreeSortBy = 'default' | 'name' | 'sessions' | 'duration' | 'status';
export type TreeSortDirection = 'asc' | 'desc';

export interface TreeSortOption {
  id: TreeSortBy;
  label: string;
  shortLabel: string;
  description: string;
}

export const TREE_SORT_OPTIONS: TreeSortOption[] = [
  {
    id: 'default',
    label: 'Default Order',
    shortLabel: 'Sort',
    description: 'Manual order as arranged',
  },
  {
    id: 'name',
    label: 'Alphabetical',
    shortLabel: 'Abc',
    description: 'Sort by task name (A–Z)',
  },
  {
    id: 'status',
    label: 'Status',
    shortLabel: 'Stat',
    description: 'In Progress → Review → Not Started → Done',
  },
  {
    id: 'sessions',
    label: 'Sessions',
    shortLabel: 'Ses',
    description: 'Sort by cumulative work sessions',
  },
  {
    id: 'duration',
    label: 'Duration',
    shortLabel: 'Time',
    description: 'Sort by cumulative recorded time',
  },
];

/**
 * Priority rank for ItemStatus when sorting:
 * 1. in-progress (paling aktif dikerjakan)
 * 2. review (dalam peninjauan)
 * 3. not-started (belum dimulai)
 * 4. completed (selesai)
 */
const STATUS_PRIORITY_MAP: Record<ItemStatus, number> = {
  'in-progress': 1,
  review: 2,
  'not-started': 3,
  completed: 4,
};

/**
 * Calculates total session count for an item including all subitems.
 */
export function getItemTotalSessionsCount(item: ItemNode): number {
  const direct = Array.isArray(item.sessions) ? item.sessions.length : 0;
  let subSessions = 0;
  if (Array.isArray(item.subItems)) {
    for (const child of item.subItems) {
      subSessions += getItemTotalSessionsCount(child);
    }
  }
  return direct + subSessions;
}

/**
 * Compare two sibling items based on selected criteria.
 */
function compareItems(
  a: ItemNode,
  b: ItemNode,
  sortBy: TreeSortBy,
  direction: TreeSortDirection
): number {
  const modifier = direction === 'desc' ? -1 : 1;

  if (sortBy === 'name') {
    const cmp = a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    return cmp * modifier;
  }

  if (sortBy === 'status') {
    const priorityA = STATUS_PRIORITY_MAP[a.status] || 99;
    const priorityB = STATUS_PRIORITY_MAP[b.status] || 99;
    if (priorityA !== priorityB) {
      return (priorityA - priorityB) * modifier;
    }
    // Fallback tie-breaker: name
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  }

  if (sortBy === 'sessions') {
    const sessionsA = getItemTotalSessionsCount(a);
    const sessionsB = getItemTotalSessionsCount(b);
    if (sessionsA !== sessionsB) {
      // By default asc: fewest to most, desc: most to fewest
      return (sessionsA - sessionsB) * modifier;
    }
    // Fallback tie-breaker: name
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  }

  if (sortBy === 'duration') {
    const durationA = getItemLoggedSeconds(a);
    const durationB = getItemLoggedSeconds(b);
    if (durationA !== durationB) {
      return (durationA - durationB) * modifier;
    }
    // Fallback tie-breaker: name
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  }

  return 0;
}

/**
 * Recursively sorts tree nodes level by level without mutating the original array.
 * Subtasks remain under their respective parent task, but siblings are ordered
 * according to the chosen sort strategy and direction.
 */
export function sortItemsRecursively(
  items: ItemNode[],
  sortBy: TreeSortBy,
  direction: TreeSortDirection = 'asc'
): ItemNode[] {
  if (!items || !Array.isArray(items)) return [];

  // Deep clone or shallow clone array to preserve immutability
  const cloned = [...items];

  // If not default, sort sibling items at this current level
  if (sortBy !== 'default') {
    cloned.sort((a, b) => compareItems(a, b, sortBy, direction));
  }

  // Recurse into children of each item
  return cloned.map((item) => {
    if (item.subItems && Array.isArray(item.subItems) && item.subItems.length > 0) {
      return {
        ...item,
        subItems: sortItemsRecursively(item.subItems, sortBy, direction),
      };
    }
    return item;
  });
}

/**
 * Sorts all projects' item trees according to the selected sorting strategy.
 */
export function sortProjectItemsTree(
  projects: ProjectNode[],
  sortBy: TreeSortBy,
  direction: TreeSortDirection = 'asc'
): ProjectNode[] {
  if (!projects || !Array.isArray(projects)) return [];
  if (sortBy === 'default') return projects;

  return projects.map((project) => ({
    ...project,
    items: sortItemsRecursively(project.items || [], sortBy, direction),
  }));
}

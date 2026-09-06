export type ItemStatus = 'not-started' | 'in-progress' | 'review' | 'completed';

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';

export type ProjectStatus = 'active' | 'archived';

export interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  color?: string;
  avatar: string;
}

export type SessionType = 'timer' | 'manual-range';

export interface Session {
  id: string;
  type?: SessionType;
  startedAt: string;
  endedAt: string | null;
  loggedSeconds: number;
  title?: string;
}

export interface ItemNode {
  id: string;
  type: 'item-node';
  name: string;
  isExpanded?: boolean;
  targetDate?: string;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  status: ItemStatus;
  assigneeId?: string;
  reviewerId?: string | null;
  estimatedSeconds?: number;
  notes?: string;
  priority?: PriorityLevel;
  icon?: string;
  sessions: Session[];
  showInSummary?: boolean;
  subItems: ItemNode[];
}

export interface ProjectNode {
  id: string;
  type: 'project-node';
  title: string;
  status: ProjectStatus;
  color?: string;
  icon?: string;
  description?: string;
  isExpanded?: boolean;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  items: ItemNode[];
}

export interface ActiveTimer {
  itemId: string;
  itemPathIds: string[]; // [projectId, ...ancestorItemIds, itemId]
  startedAt: string; // ISO string
  description?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  action: string;
  details: string;
  itemId?: string;
  itemTitle?: string;
}

export type AppTheme = 'dark' | 'light';
export type AccentColor = 'orange' | 'blue' | 'emerald' | 'purple' | 'rose';

export interface AppSettings {
  theme: AppTheme;
  accentColor?: AccentColor;
  language: string;
  autoSave: boolean;
  version: string;
  auth: {
    username: string;
    passwordHash: string;
  };
  activeTimer: ActiveTimer | null;
}

export interface AppData {
  settings: AppSettings;
  persons: Person[];
  projects: ProjectNode[];
  activityLogs: ActivityLog[];
  _lastModified?: number;
}

export type ViewMode = 'dashboard' | 'projects' | 'notion' | 'tasks' | 'timeline' | 'calendar' | 'analytics' | 'team' | 'archived';

export type TimeScale = 'day' | 'week' | 'month' | 'year';
export type CalendarViewType = TimeScale;

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error' | 'dev-preview' | 'unsynced';

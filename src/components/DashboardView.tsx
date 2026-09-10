import React from 'react';
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  Activity,
  TrendingUp,
  PieChart,
  Check,
} from 'lucide-react';
import { AppData, ViewMode, ItemStatus } from '../types';
import {
  getLeafFlatItems,
  getProjectLoggedSeconds,
  formatDuration,
  getStatusConfig,
} from '../utils/treeUtils';

interface DashboardViewProps {
  appData: AppData;
  onSelectView: (view: ViewMode) => void;
  onOpenAddItemModal?: () => void;
  onOpenCreateProjectModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  appData,
  onSelectView,
}) => {
  const activeProjects = appData.projects.filter((p) => p.status === 'active');
  const leafTasks = getLeafFlatItems(activeProjects);
  const completedTasks = leafTasks.filter((f) => f.item.status === 'completed');
  const inProgressTasks = leafTasks.filter((f) => f.item.status === 'in-progress');

  const statusCounts = {
    completed: leafTasks.filter((f) => f.item.status === 'completed').length,
    'in-progress': leafTasks.filter((f) => f.item.status === 'in-progress').length,
    review: leafTasks.filter((f) => f.item.status === 'review').length,
    'not-started': leafTasks.filter((f) => f.item.status === 'not-started').length,
  };

  // Total seconds logged across all projects
  const totalLoggedSeconds = activeProjects.reduce(
    (acc, proj) =>
      acc +
      getProjectLoggedSeconds(
        proj,
        appData.settings.activeTimer?.itemId,
        appData.settings.activeTimer?.startedAt
      ),
    0
  );

  return (
    <div className="space-y-6 w-full pb-16 pt-4 md:pt-6">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Projects */}
        <div className="bg-[#121215] border border-[#27272a] rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-mono uppercase text-[#71717a]">Active Projects</p>
            <h3 className="text-2xl font-bold text-[#f4f4f5] mt-1">{activeProjects.length}</h3>
            <p className="text-[10px] text-[#10b981] mt-1 flex items-center gap-1 font-mono">
              <TrendingUp className="w-3 h-3" /> 100% synchronized
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500">
            <FolderOpen className="w-5 h-5" />
          </div>
        </div>

        {/* Total Tasks Completed */}
        <div className="bg-[#121215] border border-[#27272a] rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-mono uppercase text-[#71717a]">Tasks Completed</p>
            <h3 className="text-2xl font-bold text-[#f4f4f5] mt-1">
              {completedTasks.length} / {leafTasks.length}
            </h3>
            <p className="text-[10px] text-orange-400 mt-1 font-mono">
              {leafTasks.length > 0
                ? `${Math.round((completedTasks.length / leafTasks.length) * 100)}% completion rate`
                : '0%'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Hours Logged */}
        <div className="bg-[#121215] border border-[#27272a] rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-mono uppercase text-[#71717a]">Total Logged Hours</p>
            <h3 className="text-2xl font-bold text-[#f4f4f5] mt-1 font-mono">
              {formatDuration(totalLoggedSeconds)}
            </h3>
            <p className="text-[10px] text-orange-400 mt-1 font-mono">
              {inProgressTasks.length} tasks currently active
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Middle Grid: Time Budget Breakdown, Task Status Breakdown & Activity Logs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Time Budgeting per Project */}
        <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
            <h3 className="text-sm font-bold text-[#f4f4f5] flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Time Budgeting
            </h3>
            <button
              onClick={() => onSelectView('projects')}
              className="text-xs text-orange-400 hover:underline"
            >
              View Tree
            </button>
          </div>

          <div className="space-y-4">
            {activeProjects.map((proj) => {
              const logged = getProjectLoggedSeconds(
                proj,
                appData.settings.activeTimer?.itemId,
                appData.settings.activeTimer?.startedAt
              );

              return (
                <div key={proj.id} className="bg-[#18181b] p-3.5 rounded-lg space-y-2 border border-[#27272a]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#f4f4f5] flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj.color || '#f97316' }}></span>
                      <span className="truncate">{proj.title}</span>
                    </span>
                    <span className="font-mono text-orange-400 font-bold shrink-0">
                      {formatDuration(logged)}
                    </span>
                  </div>

                  <div className="w-full bg-[#27272a] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-orange-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, logged > 0 ? 65 : 5)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task Status Breakdown */}
        <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
            <h3 className="text-sm font-bold text-[#f4f4f5] flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#10b981]" /> Status Breakdown
            </h3>
            <button
              onClick={() => onSelectView('tasks')}
              className="text-xs text-orange-400 hover:underline cursor-pointer"
            >
              View Kanban
            </button>
          </div>

          <div className="space-y-2.5">
            {/* 1. Not Started */}
            <div className="flex items-center justify-between p-2.5 bg-[#18181b] rounded-lg border border-[#27272a]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#71717a]"></span>
                <span className="text-xs text-[#a1a1aa]">Not Started</span>
              </div>
              <span className="text-xs font-bold font-mono text-[#71717a]">
                {statusCounts['not-started']} tasks
              </span>
            </div>

            {/* 2. In Progress */}
            <div className="flex items-center justify-between p-2.5 bg-[#18181b] rounded-lg border border-[#27272a]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="text-xs text-[#a1a1aa]">In Progress</span>
              </div>
              <span className="text-xs font-bold font-mono text-orange-400">
                {statusCounts['in-progress']} tasks
              </span>
            </div>

            {/* 3. Review */}
            <div className="flex items-center justify-between p-2.5 bg-[#18181b] rounded-lg border border-[#27272a]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span>
                <span className="text-xs text-[#a1a1aa]">Review</span>
              </div>
              <span className="text-xs font-bold font-mono text-[#f59e0b]">
                {statusCounts.review} tasks
              </span>
            </div>

            {/* 4. Completed */}
            <div className="flex items-center justify-between p-2.5 bg-[#18181b] rounded-lg border border-[#27272a]">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#10b981]" />
                <span className="text-xs text-[#a1a1aa]">Completed</span>
              </div>
              <span className="text-xs font-bold font-mono text-[#10b981]">
                {statusCounts.completed} tasks
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity Log */}
        <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
            <h3 className="text-sm font-bold text-[#f4f4f5] flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-400" /> Activity Log
            </h3>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {appData.activityLogs && appData.activityLogs.length > 0 ? (
              appData.activityLogs.map((log) => (
                <div key={log.id} className="bg-[#18181b] p-2.5 rounded-lg text-xs space-y-1 border border-[#27272a]">
                  <div className="flex justify-between items-center text-[10px] text-[#71717a] font-mono">
                    <span className="text-orange-400 font-bold">{log.userName || 'System'}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[#f4f4f5] font-medium">{log.details}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#71717a] text-center py-6">No recent logs recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

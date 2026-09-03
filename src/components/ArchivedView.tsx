import React from 'react';
import { Archive, RefreshCw, Trash2, Folder } from 'lucide-react';
import { AppData, ProjectNode } from '../types';

interface ArchivedViewProps {
  appData: AppData;
  onRestoreProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ArchivedView: React.FC<ArchivedViewProps> = ({
  appData,
  onRestoreProject,
  onDeleteProject,
}) => {
  const archivedProjects = appData.projects.filter((p) => p.status === 'archived');

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      <div>
        <h2 className="text-xl font-bold text-[#dae2fd]">Archived Projects</h2>
        <p className="text-xs text-[#8c909f] mt-0.5">
          Projects and tasks that have been archived. Restore them anytime to reactivate tracking.
        </p>
      </div>

      <div className="space-y-4">
        {archivedProjects.length > 0 ? (
          archivedProjects.map((proj) => (
            <div
              key={proj.id}
              className="bg-[#1e293b] border border-[#424754] rounded-xl p-4 flex items-center justify-between shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#64748b]/20 border border-[#64748b]/40 flex items-center justify-center text-[#64748b]">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#dae2fd]">{proj.title}</h3>
                  <p className="text-xs font-mono text-[#8c909f]">
                    {proj.items.length} items archived
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRestoreProject(proj.id)}
                  className="bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 border border-[#3b82f6]/50 text-[#adc6ff] text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Restore
                </button>
                <button
                  onClick={() => onDeleteProject(proj.id)}
                  className="bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444]/30 text-[#ef4444] text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[#1e293b] border border-[#424754] rounded-xl p-12 text-center text-[#8c909f] space-y-2">
            <Archive className="w-10 h-10 mx-auto text-[#424754]" />
            <p className="text-sm font-medium">No archived projects</p>
          </div>
        )}
      </div>
    </div>
  );
};

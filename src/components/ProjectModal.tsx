import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Archive, Copy, LayoutGrid, CheckSquare } from 'lucide-react';
import { ProjectNode, ProjectStatus } from '../types';

const PROJECT_EMOJIS = ['🌳', '📁', '💻', '🎬', '📄', '📝', '⚡', '🚀', '🎯', '✨', '🔥', '📌', '🎨', '⚙️', '💡', '🏷️'];

export const DEFAULT_TREE_COLUMNS: Record<string, boolean> = {
  name: true,
  status: true,
  progress: true,
  date: true,
  assignee: true,
  reviewer: true,
  timer: true,
  actions: true,
};

export const AVAILABLE_COLUMNS: { id: string; label: string; desc: string; required?: boolean }[] = [
  { id: 'name', label: 'Task Name', desc: 'Main hierarchy title', required: true },
  { id: 'status', label: 'Status', desc: 'Task execution state' },
  { id: 'progress', label: 'Progress', desc: 'Percentage progress bar' },
  { id: 'date', label: 'Date / Schedule', desc: 'Target date or active period' },
  { id: 'assignee', label: 'Assignee', desc: 'Assigned team member' },
  { id: 'reviewer', label: 'Reviewer', desc: 'Assigned reviewer member' },
  { id: 'timer', label: 'Timer', desc: 'Time logged & play/stop button' },
  { id: 'actions', label: 'Actions / More', desc: 'Context menu button' },
];

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProject: (
    title: string,
    color: string,
    status?: ProjectStatus,
    icon?: string,
    description?: string,
    columnSettings?: Record<string, boolean>
  ) => void;
  onArchiveProject?: (projectId: string) => void;
  onDuplicateProject?: (projectId: string) => void;
  initialProject?: ProjectNode | null;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSaveProject,
  onArchiveProject,
  onDuplicateProject,
  initialProject,
}) => {
  const [title, setTitle] = useState<string>('');
  const [color, setColor] = useState<string>('#f97316');
  const [icon, setIcon] = useState<string>('🌳');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [description, setDescription] = useState<string>('');
  const [columnSettings, setColumnSettings] = useState<Record<string, boolean>>({ ...DEFAULT_TREE_COLUMNS });

  const isEditing = Boolean(initialProject && typeof initialProject === 'object' && 'id' in initialProject && typeof initialProject.id === 'string');

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialProject) {
        setTitle(initialProject.title || '');
        setColor(initialProject.color || '#f97316');
        setIcon(initialProject.icon || '🌳');
        setStatus(initialProject.status || 'active');
        setDescription(initialProject.description || '');
        setColumnSettings(initialProject.columnSettings || { ...DEFAULT_TREE_COLUMNS });
      } else {
        setTitle('');
        setColor('#f97316');
        setIcon('🌳');
        setStatus('active');
        setDescription('');
        setColumnSettings({ ...DEFAULT_TREE_COLUMNS });
      }
    }
  }, [isOpen, isEditing, initialProject?.id, initialProject?.icon, initialProject?.description, initialProject?.columnSettings]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!title.trim()) return;
    onSaveProject(title, color, status, icon, description, columnSettings);
    onClose();
  };

  const handleToggleColumn = (colId: string) => {
    if (colId === 'name') return; // Name is always required
    setColumnSettings((prev) => ({
      ...prev,
      [colId]: !prev[colId],
    }));
  };

  const handleArchiveToggle = () => {
    if (isEditing && initialProject && onArchiveProject) {
      onArchiveProject(initialProject.id);
      onClose();
    } else {
      setStatus(status === 'active' ? 'archived' : 'active');
    }
  };

  const handleDuplicate = () => {
    if (isEditing && initialProject && onDuplicateProject) {
      onDuplicateProject(initialProject.id);
      onClose();
    }
  };

  const presetColors = ['#f97316', '#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b border-[#27272a]">
          <h3 className="text-lg font-bold text-[#f4f4f5] flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-orange-500" />
            {isEditing ? 'Project Settings' : 'Create New Project'}
          </h3>
          <button onClick={onClose} className="text-[#71717a] hover:text-[#f4f4f5] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#a1a1aa] mb-1 font-mono uppercase">Project Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Digital Literacy Video"
              className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 text-[#f4f4f5] outline-none focus:border-orange-500 text-sm"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[#a1a1aa] mb-1 font-mono uppercase">Project Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary or scope of this project..."
              rows={2}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 text-[#f4f4f5] outline-none focus:border-orange-500 text-xs placeholder-[#71717a] resize-none"
            />
          </div>

          <div>
            <label className="block text-[#a1a1aa] mb-2 font-mono uppercase">Project Icon</label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#18181b] border border-[#27272a] rounded-xl">
              {PROJECT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg cursor-pointer transition-all ${
                    icon === e ? 'bg-orange-500/20 border border-orange-500/50 scale-110' : 'hover:bg-[#27272a]'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[#a1a1aa] mb-2 font-mono uppercase">Accent Color</label>
            <div className="flex items-center gap-2">
              {presetColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                    color === c ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                ></button>
              ))}
            </div>
          </div>

          {/* TreeView Column Settings */}
          <div className="pt-2 border-t border-[#27272a]">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#a1a1aa] font-mono uppercase flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-orange-400" />
                <span>TreeView Column Settings</span>
              </label>
              <button
                type="button"
                onClick={() => setColumnSettings({ ...DEFAULT_TREE_COLUMNS })}
                className="text-[10px] text-orange-400 hover:underline cursor-pointer"
              >
                Reset Default
              </button>
            </div>
            <p className="text-[11px] text-[#71717a] mb-2.5">
              Select which columns to display in TreeView for this project:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#18181b] border border-[#27272a] p-3 rounded-xl">
              {AVAILABLE_COLUMNS.map((col) => {
                const isChecked = col.required || columnSettings[col.id] !== false;
                return (
                  <label
                    key={col.id}
                    className={`flex items-center gap-2.5 p-1.5 rounded-lg transition-colors cursor-pointer select-none ${
                      isChecked ? 'bg-[#27272a]/60 text-[#f4f4f5]' : 'text-[#71717a] hover:bg-[#27272a]/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={col.required}
                      onChange={() => handleToggleColumn(col.id)}
                      className="w-3.5 h-3.5 rounded accent-orange-500 cursor-pointer disabled:opacity-50"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-xs block leading-tight">{col.label}</span>
                      <span className="text-[10px] text-[#71717a] block leading-tight truncate">{col.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#27272a] gap-2">
            {isEditing && initialProject ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  className="px-2.5 py-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/20 font-medium flex items-center gap-1.5 transition-colors text-xs cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {initialProject.status === 'archived' ? 'Restore' : 'Archive'}
                </button>

                {onDuplicateProject && (
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="px-2.5 py-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#60a5fa] hover:bg-[#3b82f6]/20 font-medium flex items-center gap-1.5 transition-colors text-xs cursor-pointer"
                    title="Duplicate project and all tasks"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicate</span>
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-md shadow-orange-500/20 cursor-pointer"
              >
                Save Project
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};


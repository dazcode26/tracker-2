import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Archive, Copy } from 'lucide-react';
import { ProjectNode, ProjectStatus } from '../types';

const PROJECT_EMOJIS = ['🌳', '📁', '💻', '🎬', '📄', '📝', '⚡', '🚀', '🎯', '✨', '🔥', '📌', '🎨', '⚙️', '💡', '🏷️'];

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProject: (title: string, color: string, status?: ProjectStatus, icon?: string, description?: string) => void;
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

  const isEditing = Boolean(initialProject && typeof initialProject === 'object' && 'id' in initialProject && typeof initialProject.id === 'string');

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialProject) {
        setTitle(initialProject.title || '');
        setColor(initialProject.color || '#f97316');
        setIcon(initialProject.icon || '🌳');
        setStatus(initialProject.status || 'active');
        setDescription(initialProject.description || '');
      } else {
        setTitle('');
        setColor('#f97316');
        setIcon('🌳');
        setStatus('active');
        setDescription('');
      }
    }
  }, [isOpen, isEditing, initialProject?.id, initialProject?.icon, initialProject?.description]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSaveProject(title, color, status, icon, description);
    onClose();
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
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-[#27272a]">
          <h3 className="text-lg font-bold text-[#f4f4f5] flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-orange-500" />
            {isEditing ? 'Edit Project' : 'Create New Project'}
          </h3>
          <button onClick={onClose} className="text-[#71717a] hover:text-[#f4f4f5]">
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
              rows={3}
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
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                ></button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#27272a] gap-2">
            {isEditing && initialProject ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  className="px-2.5 py-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/20 font-medium flex items-center gap-1.5 transition-colors text-xs"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {initialProject.status === 'archived' ? 'Restore' : 'Archive'}
                </button>

                {onDuplicateProject && (
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="px-2.5 py-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#60a5fa] hover:bg-[#3b82f6]/20 font-medium flex items-center gap-1.5 transition-colors text-xs"
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
                className="px-4 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-md shadow-orange-500/20"
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


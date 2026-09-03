import React, { useState } from 'react';
import { Users, Mail, Shield, Plus, Clock, CheckCircle, Pencil, Trash2, ArrowRight, AlertTriangle, X } from 'lucide-react';
import { AppData, Person } from '../types';
import { getLeafFlatItems, formatDuration, getItemLoggedSeconds } from '../utils/treeUtils';

interface TeamViewProps {
  appData: AppData;
  onAddPerson: (person: Person) => void;
  onUpdatePerson: (person: Person) => void;
  onDeletePerson: (personId: string, transferToPersonId?: string) => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
];

export const TeamView: React.FC<TeamViewProps> = ({
  appData,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
}) => {
  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('Developer');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_PRESETS[0]);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string>('');

  // Edit Member Modal State
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('');
  const [editAvatar, setEditAvatar] = useState<string>('');
  const [editCustomAvatar, setEditCustomAvatar] = useState<string>('');

  // Delete / Reassign Modal State
  const [deletingPerson, setDeletingPerson] = useState<Person | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string>('');

  const flatItems = getLeafFlatItems(appData.projects.filter((p) => p.status === 'active'));

  // Open Edit Modal with Member Data
  const handleOpenEditModal = (person: Person) => {
    setEditingPerson(person);
    setEditName(person.name);
    setEditEmail(person.email);
    setEditRole(person.role);
    setEditAvatar(person.avatar);
    setEditCustomAvatar(AVATAR_PRESETS.includes(person.avatar) ? '' : person.avatar);
  };

  // Open Delete / Reassign Modal
  const handleOpenDeleteModal = (person: Person) => {
    setDeletingPerson(person);
    // Default transfer target to the first available other member
    const otherPersons = appData.persons.filter((p) => p.id !== person.id);
    setTransferTargetId(otherPersons.length > 0 ? otherPersons[0].id : '');
  };

  // Handle Add Member Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const avatar = customAvatarUrl.trim() || selectedAvatar;

    const newPerson: Person = {
      id: `person-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role: role.trim() || 'Developer',
      color: '#3b82f6',
      avatar,
    };

    onAddPerson(newPerson);
    setName('');
    setEmail('');
    setRole('Developer');
    setCustomAvatarUrl('');
    setSelectedAvatar(AVATAR_PRESETS[0]);
    setShowAddModal(false);
  };

  // Handle Edit Member Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson || !editName.trim() || !editEmail.trim()) return;

    const avatar = editCustomAvatar.trim() || editAvatar;

    const updated: Person = {
      ...editingPerson,
      name: editName.trim(),
      email: editEmail.trim(),
      role: editRole.trim() || 'Member',
      avatar,
    };

    onUpdatePerson(updated);
    setEditingPerson(null);
  };

  // Handle Confirm Delete with Reassignment
  const handleConfirmDelete = () => {
    if (!deletingPerson) return;
    onDeletePerson(deletingPerson.id, transferTargetId ? transferTargetId : undefined);
    setDeletingPerson(null);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#f4f4f5]">Team Directory</h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Manage team members, delegate tasks, update profiles, and reassign tasks automatically upon deletion.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Persons Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appData.persons.map((person) => {
          const assignedItems = flatItems.filter((f) => f.item.assigneeId === person.id);
          const completedCount = assignedItems.filter((f) => f.item.status === 'completed').length;

          // Calculate total seconds logged by person
          const personSeconds = assignedItems.reduce((acc, { item }) => {
            return (
              acc +
              getItemLoggedSeconds(
                item,
                appData.settings.activeTimer?.itemId,
                appData.settings.activeTimer?.startedAt
              )
            );
          }, 0);

          return (
            <div
              key={person.id}
              className="bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] rounded-xl p-5 shadow-xl space-y-4 flex flex-col justify-between transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  <img
                    src={person.avatar}
                    alt={person.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-orange-500/40 shrink-0 shadow-sm"
                  />
                  <div className="overflow-hidden min-w-0">
                    <h3 className="text-sm font-bold text-[#f4f4f5] truncate">{person.name}</h3>
                    <p className="text-xs font-mono text-orange-400 flex items-center gap-1 mt-0.5 truncate">
                      <Shield className="w-3 h-3 shrink-0" /> {person.role}
                    </p>
                    <p className="text-[11px] font-mono text-[#a1a1aa] truncate flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3 shrink-0" /> {person.email}
                    </p>
                  </div>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEditModal(person)}
                    className="p-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] hover:border-[#3f3f46] transition-colors"
                    title="Edit Member"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenDeleteModal(person)}
                    className="p-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                    title="Delete Member (Reassign Tasks)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Task & Work Stats */}
              <div className="pt-3 border-t border-[#27272a] grid grid-cols-2 gap-2 text-center">
                <div className="bg-[#18181b] p-2.5 rounded-lg border border-[#27272a]/60">
                  <span className="text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider">Assigned Tasks</span>
                  <p className="text-xs font-bold text-[#f4f4f5] mt-0.5 font-mono">
                    {completedCount} / {assignedItems.length}
                  </p>
                </div>
                <div className="bg-[#18181b] p-2.5 rounded-lg border border-[#27272a]/60">
                  <span className="text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider">Hours Logged</span>
                  <p className="text-xs font-bold text-orange-400 font-mono mt-0.5">
                    {formatDuration(personSeconds)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <h3 className="text-base font-bold text-[#f4f4f5] flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-400" /> Add Team Member
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-[#27272a]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#a1a1aa] mb-1 font-mono">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-[#121215] border border-[#27272a] rounded-lg p-2.5 text-[#f4f4f5] outline-none focus:border-orange-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[#a1a1aa] mb-1 font-mono">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alex@example.com"
                  className="w-full bg-[#121215] border border-[#27272a] rounded-lg p-2.5 text-[#f4f4f5] outline-none focus:border-orange-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[#a1a1aa] mb-1 font-mono">Role / Title</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Lead Designer / Fullstack Developer"
                  className="w-full bg-[#121215] border border-[#27272a] rounded-lg p-2.5 text-[#f4f4f5] outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#a1a1aa] mb-1.5 font-mono">Choose Avatar</label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {AVATAR_PRESETS.map((avUrl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSelectedAvatar(avUrl);
                        setCustomAvatarUrl('');
                      }}
                      className={`relative rounded-full shrink-0 transition-transform ${
                        selectedAvatar === avUrl && !customAvatarUrl
                          ? 'ring-2 ring-orange-500 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={avUrl} alt={`Avatar ${i + 1}`} className="w-9 h-9 rounded-full object-cover" />
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                  placeholder="Or enter custom image URL..."
                  className="w-full bg-[#121215] border border-[#27272a] rounded-lg p-2 text-[#f4f4f5] outline-none focus:border-orange-500 transition-colors mt-2 text-[11px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#3f3f46] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <h3 className="text-base font-bold text-[#f4f4f5] flex items-center gap-2">
                <Pencil className="w-4 h-4 text-orange-400" /> Edit Member Details
              </h3>
              <button
                onClick={() => setEditingPerson(null)}
                className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-[#27272a]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#a1a1aa] mb-1 font-mono">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#121215] border border-[#27272a] rounded-lg p-2.5 text-[#f4f4f5] outline-none focus:border-orange-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[#a1a1aa] mb-1 font-mono">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-[#121215] border border-[#27272a] rounded-lg p-2.5 text-[#f4f4f5] outline-none focus:border-orange-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[#a1a1aa] mb-1 font-mono">Role / Title</label>
                <input
                  type="text"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-[#121215] border border-[#27272a] rounded-lg p-2.5 text-[#f4f4f5] outline-none focus:border-orange-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[#a1a1aa] mb-1.5 font-mono">Avatar Selection</label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {AVATAR_PRESETS.map((avUrl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setEditAvatar(avUrl);
                        setEditCustomAvatar('');
                      }}
                      className={`relative rounded-full shrink-0 transition-transform ${
                        editAvatar === avUrl && !editCustomAvatar
                          ? 'ring-2 ring-orange-500 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={avUrl} alt={`Preset ${i + 1}`} className="w-9 h-9 rounded-full object-cover" />
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  value={editCustomAvatar}
                  onChange={(e) => {
                    setEditCustomAvatar(e.target.value);
                    if (e.target.value) setEditAvatar(e.target.value);
                  }}
                  placeholder="Or enter custom image URL..."
                  className="w-full bg-[#121215] border border-[#27272a] rounded-lg p-2 text-[#f4f4f5] outline-none focus:border-orange-500 transition-colors mt-2 text-[11px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setEditingPerson(null)}
                  className="px-4 py-2 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#3f3f46] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Member with Task Reassignment Modal */}
      {deletingPerson && (() => {
        const assignedTasks = flatItems.filter((f) => f.item.assigneeId === deletingPerson.id);
        const otherPersons = appData.persons.filter((p) => p.id !== deletingPerson.id);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[#27272a]">
                <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#f4f4f5]">Delete Member</h3>
                  <p className="text-xs text-[#a1a1aa]">
                    Confirm member deletion & task reassignment
                  </p>
                </div>
              </div>

              {/* Member Card Summary */}
              <div className="bg-[#121215] border border-[#27272a] rounded-xl p-3.5 flex items-center gap-3">
                <img
                  src={deletingPerson.avatar}
                  alt={deletingPerson.name}
                  className="w-10 h-10 rounded-full object-cover border border-[#3f3f46]"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#f4f4f5] truncate">{deletingPerson.name}</div>
                  <div className="text-[11px] font-mono text-[#a1a1aa] truncate">{deletingPerson.email} • {deletingPerson.role}</div>
                </div>
              </div>

              {/* Task Reassignment Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#f4f4f5]">
                  <span>Task Reassignment</span>
                  <span className="text-[11px] font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                    {assignedTasks.length} active tasks
                  </span>
                </div>

                {assignedTasks.length > 0 ? (
                  <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                    Currently, there are <strong className="text-[#f4f4f5]">{assignedTasks.length} tasks</strong> assigned to <strong className="text-[#f4f4f5]">{deletingPerson.name}</strong>. Select a team member to reassign these tasks to:
                  </p>
                ) : (
                  <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                    No active tasks are assigned to this member.
                  </p>
                )}

                {otherPersons.length > 0 ? (
                  <div>
                    <label className="block text-[11px] text-[#a1a1aa] mb-1 font-mono">
                      Reassign All Tasks To:
                    </label>
                    <select
                      value={transferTargetId}
                      onChange={(e) => setTransferTargetId(e.target.value)}
                      className="w-full bg-[#121215] border border-[#27272a] rounded-lg p-2.5 text-xs text-[#f4f4f5] outline-none focus:border-orange-500 cursor-pointer"
                    >
                      {otherPersons.map((other) => (
                        <option key={other.id} value={other.id} className="bg-[#18181b] text-[#f4f4f5]">
                          {other.name} ({other.role})
                        </option>
                      ))}
                      <option value="" className="bg-[#18181b] text-[#a1a1aa]">
                        — Do not reassign (Make Unassigned) —
                      </option>
                    </select>
                  </div>
                ) : (
                  <div className="bg-[#27272a]/50 p-2.5 rounded-lg text-[11px] text-[#a1a1aa]">
                    No other team members available. All corresponding tasks will automatically become <em>Unassigned</em>.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setDeletingPerson(null)}
                  className="px-4 py-2 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#3f3f46] text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-md shadow-red-600/20 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete & Reassign
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};


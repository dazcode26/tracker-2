import React, { useState, useRef, useEffect } from 'react';
import { Folder, Search, X, ChevronDown, Plus, Users } from 'lucide-react';
import { Person, ProjectNode } from '../types';

export interface StructureToolbarProps {
  // Project Filter
  projects: ProjectNode[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;

  // Team Member Filter (Assignee & Reviewer)
  persons?: Person[];
  selectedPersonId?: string;
  onSelectPerson?: (personId: string) => void;

  // Search Input
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Action Button
  onOpenProjectModal: () => void;
}

export const StructureToolbar: React.FC<StructureToolbarProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  persons = [],
  selectedPersonId = 'all',
  onSelectPerson,
  searchQuery,
  onSearchChange,
  onOpenProjectModal,
}) => {
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(false);
  const [isPersonFilterOpen, setIsPersonFilterOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const projectFilterRef = useRef<HTMLDivElement>(null);
  const personFilterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when mobile search is opened
  useEffect(() => {
    if (isMobileSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        projectFilterRef.current &&
        !projectFilterRef.current.contains(event.target as Node)
      ) {
        setIsProjectFilterOpen(false);
      }
      if (
        personFilterRef.current &&
        !personFilterRef.current.contains(event.target as Node)
      ) {
        setIsPersonFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCloseMobileSearch = () => {
    onSearchChange('');
    setIsMobileSearchOpen(false);
  };

  const handleClearSearch = () => {
    onSearchChange('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleCloseMobileSearch();
    }
  };

  const activeProjects = projects.filter((p) => p.status === 'active');
  const selectedProject = activeProjects.find((p) => p.id === selectedProjectId);
  const selectedPerson = persons.find((u) => u.id === selectedPersonId);

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 pb-2 border-b border-[#27272a] h-10 relative">
      {/* MOBILE / TABLET FULL-WIDTH SEARCH BAR (Spans the entire toolbar on < md, covering filters on left & Add Project on right) */}
      {isMobileSearchOpen && (
        <div className="md:hidden flex items-center gap-2 w-full h-full animate-in fade-in duration-150">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search projects, tasks, milestones..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-8 pl-8.5 pr-8 rounded-xl bg-[#18181b] border border-orange-500/50 text-xs text-[#f4f4f5] placeholder-[#71717a] focus:outline-none shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white cursor-pointer p-0.5 rounded-full hover:bg-[#27272a] transition-colors"
                title="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleCloseMobileSearch}
            className="h-8 px-2.5 rounded-xl text-xs font-semibold text-orange-400 hover:text-orange-300 hover:bg-[#27272a] transition-colors cursor-pointer shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* NORMAL TOOLBAR CONTENT (Hidden on < md when search is open, always visible on md+) */}
      <div className={`items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 min-w-0 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
        {/* Project Selector Dropdown */}
        <div className="relative shrink-0" ref={projectFilterRef}>
          <button
            type="button"
            onClick={() => {
              setIsProjectFilterOpen(!isProjectFilterOpen);
              setIsPersonFilterOpen(false);
            }}
            className="h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5] text-xs font-semibold shadow-xs hover:border-orange-500/40 transition-all cursor-pointer max-w-[120px] xs:max-w-[135px] sm:max-w-[160px] md:max-w-[190px]"
            title="Filter by Project"
          >
            {selectedProjectId === 'all' || !selectedProject ? (
              <>
                <Folder className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">All Projects</span>
              </>
            ) : (
              <>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedProject.color || '#f97316' }}
                />
                <span className="truncate">{selectedProject.title}</span>
              </>
            )}
            <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0 ml-auto" />
          </button>

          {isProjectFilterOpen && (
            <div className="absolute left-0 mt-1.5 w-56 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  onSelectProject('all');
                  setIsProjectFilterOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                  selectedProjectId === 'all'
                    ? 'bg-orange-500/15 text-orange-400 font-bold'
                    : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">All Projects</span>
              </button>

              <div className="h-px bg-[#27272a] my-0.5" />

              {activeProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectProject(p.id);
                    setIsProjectFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                    selectedProjectId === p.id
                      ? 'bg-orange-500/15 text-orange-400 font-bold'
                      : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || '#f97316' }}
                  />
                  <span className="truncate">{p.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TEAM Filter Dropdown (Assignee & Reviewer) */}
        {persons && persons.length > 0 && onSelectPerson && (
          <div className="relative shrink-0" ref={personFilterRef}>
            <button
              type="button"
              onClick={() => {
                setIsPersonFilterOpen(!isPersonFilterOpen);
                setIsProjectFilterOpen(false);
              }}
              className="h-8 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5] text-xs font-semibold shadow-xs hover:border-orange-500/40 transition-all cursor-pointer max-w-[115px] xs:max-w-[130px] sm:max-w-[155px] md:max-w-[180px]"
              title="Filter by Team Member (Assignee & Reviewer)"
            >
              {selectedPersonId === 'all' || !selectedPerson ? (
                <>
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">All Team</span>
                </>
              ) : (
                <>
                  {selectedPerson.avatar ? (
                    <img
                      src={selectedPerson.avatar}
                      alt={selectedPerson.name}
                      className="w-4 h-4 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                    />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white uppercase shrink-0">
                      {selectedPerson.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate">{selectedPerson.name}</span>
                </>
              )}
              <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0 ml-auto" />
            </button>

            {isPersonFilterOpen && (
              <div className="absolute left-0 mt-1.5 w-60 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    onSelectPerson('all');
                    setIsPersonFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                    selectedPersonId === 'all'
                      ? 'bg-orange-500/15 text-orange-400 font-bold'
                      : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">All Team Members</span>
                </button>

                <div className="h-px bg-[#27272a] my-0.5" />

                {persons.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onSelectPerson(u.id);
                      setIsPersonFilterOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      selectedPersonId === u.id
                        ? 'bg-orange-500/15 text-orange-400 font-bold'
                        : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate">{u.name}</span>
                    </div>
                    {u.role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#27272a] text-[#71717a] font-mono shrink-0">
                        {u.role}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Trigger Button (shown on < md when search is collapsed) */}
        {!isMobileSearchOpen && (
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(true)}
            className="md:hidden h-8 w-8 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] hover:border-orange-500/40 flex items-center justify-center text-[#a1a1aa] hover:text-white transition-all cursor-pointer shrink-0"
            title="Search items"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Desktop Search Input (Always visible on md+ screens) */}
        <div className="hidden md:flex relative items-center">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 pr-7 sm:pr-8 rounded-xl bg-[#18181b] border border-[#27272a] text-xs text-[#f4f4f5] placeholder-[#71717a] focus:outline-none focus:border-orange-500/50 w-28 sm:w-36 lg:w-44 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white cursor-pointer p-0.5 rounded-full hover:bg-[#27272a]"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: Action Button (+ Project on mobile, + New Project on desktop) */}
      <div className={`shrink-0 ${isMobileSearchOpen ? 'hidden md:block' : 'block'}`}>
        <button
          type="button"
          onClick={() => onOpenProjectModal()}
          className="h-8 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold px-3 sm:px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 hover:shadow-orange-500/30 cursor-pointer shrink-0 whitespace-nowrap"
          title="Create New Project"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          <span>
            <span className="hidden sm:inline">New </span>
            Project
          </span>
        </button>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import {
  LayoutDashboard,
  ListTree,
  Table2,
  Kanban,
  SquareChartGantt,
  CalendarDays,
  CalendarRange,
  BarChart3,
  Users,
  Archive,
  Settings,
  LogOut,
  Sun,
  Moon,
  Cloud,
  CloudOff,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Terminal,
} from 'lucide-react';
import { ViewMode, AppData, AppTheme, AccentColor, AuthUser, SyncStatus } from '../types';

interface HeaderProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  appData: AppData;
  onStopTimer: () => void;
  onOpenSettings: () => void;
  onSignOut?: () => void;
  onUpdateTheme?: (theme: AppTheme, accent: AccentColor) => void;
  currentUser?: AuthUser | null;
  syncStatus?: SyncStatus;
  lastSyncedAt?: Date | null;
  onTriggerSync?: () => Promise<void>;
  onPullFromCloud?: () => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  appData,
  onStopTimer,
  onOpenSettings,
  onSignOut,
  onUpdateTheme,
  currentUser,
  syncStatus = 'synced',
  lastSyncedAt = null,
  onTriggerSync,
  onPullFromCloud,
}) => {
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [isSyncingManual, setIsSyncingManual] = useState<boolean>(false);
  const [isPullingManual, setIsPullingManual] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleManualSyncClick = async () => {
    if (!onTriggerSync || isSyncingManual || isPullingManual) return;
    try {
      setIsSyncingManual(true);
      setSyncFeedback(null);
      await onTriggerSync();
      setSyncFeedback('Data berhasil diupload ke cloud!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (e: any) {
      console.warn('Manual sync failed:', e);
      setSyncFeedback(e?.message || 'Gagal sinkronisasi');
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncingManual(false);
    }
  };

  const handleManualPullClick = async () => {
    if (!onPullFromCloud || isPullingManual || isSyncingManual) return;
    if (
      !window.confirm(
        'Muat data dari Cloud? Data lokal Anda saat ini akan digantikan dengan data yang tersimpan di Cloud Firestore.'
      )
    ) {
      return;
    }
    try {
      setIsPullingManual(true);
      setSyncFeedback(null);
      await onPullFromCloud();
      setSyncFeedback('Data dari cloud berhasil dimuat!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (e: any) {
      console.warn('Manual pull failed:', e);
      setSyncFeedback(e?.message || 'Gagal memuat data dari cloud');
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsPullingManual(false);
    }
  };

  const isDarkMode = appData.settings.theme !== 'light';
  const toggleTheme = () => {
    if (onUpdateTheme) {
      const nextTheme: AppTheme = isDarkMode ? 'light' : 'dark';
      const currentAccent: AccentColor = appData.settings.accentColor || 'orange';
      onUpdateTheme(nextTheme, currentAccent);
    }
  };

  const userAvatar = currentUser?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuA1gBlTYTp8-GLp4CO1qKF_MK8QS-LA0aGsNKem6-6o_4_kEWyIafMIjtGdFJLSChSRZeU5qveJXatyijFu88fBcOUmzSNyDmkFyxdAa6JWQJTVVVLdgAngROsgmZQPkR7VqQiKmbWoKabGJfDonVDgA_E2MUIsh9YZ-ZEi6BiRpP8oXom4wHTW_khz6FgpFnwmHFfhATrVxUorwTOoFluJPwfrtMQD-6EcrC5tRIrTk12f6KVpARIHIA";
  const userDisplayName = currentUser?.displayName || "Project Manager";
  const userEmail = currentUser?.email || "admin@tracker.com";

  const navItems: { view: ViewMode; label: string; icon: React.ReactNode }[] = [
    { view: 'projects', label: 'Tree', icon: <ListTree className="w-5 h-5 shrink-0" /> },
    { view: 'tasks', label: 'Kanban', icon: <Kanban className="w-5 h-5 shrink-0" /> },
    { view: 'timeline', label: 'Timeline', icon: <CalendarRange className="w-5 h-5 shrink-0" /> },
    { view: 'gantt', label: 'Gantt', icon: <SquareChartGantt className="w-5 h-5 shrink-0" /> },
    { view: 'calendar', label: 'Calendar', icon: <CalendarDays className="w-5 h-5 shrink-0" /> },
    { view: 'analytics', label: 'Summary', icon: <BarChart3 className="w-5 h-5 shrink-0" /> },
  ];

  const hasActiveTimer = !!appData.settings.activeTimer;

  return (
    <>
      {/* Desktop Left Navigation Sidebar (Icon Rail Style) */}
      <aside
        className={`hidden md:flex fixed ${
          hasActiveTimer ? 'top-9' : 'top-0'
        } left-0 bottom-0 z-40 bg-[#101010] flex-col items-center justify-between transition-all duration-200 w-16 py-3.5 select-none`}
      >
        {/* Top Section: Nav Items directly at the top */}
        <div className="flex flex-col items-center w-full px-2">
          {/* Navigation Items List */}
          <nav className="flex flex-col items-center gap-2.5 w-full">
            {navItems.map((item) => {
              const isActive = currentView === item.view;
              return (
                <div key={item.view} className="relative group w-full flex justify-center">
                  <button
                    onClick={() => onSelectView(item.view)}
                    className={`flex items-center justify-center w-11 h-11 text-sm font-medium rounded-xl transition-all relative cursor-pointer ${
                      isActive
                        ? 'text-orange-400 font-semibold bg-orange-500/15'
                        : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b]'
                    }`}
                  >
                    <span className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-orange-400' : 'text-[#71717a] group-hover:text-orange-400'}`}>
                      {item.icon}
                    </span>
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-orange-500 rounded-r-full" />
                    )}
                  </button>

                  {/* Label floating badge shown ONLY on hover */}
                  <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-2 transition-all duration-200 pointer-events-none bg-[#18181b] border border-[#27272a] text-[#f4f4f5] text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-2xl z-50">
                    {item.label}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Sync Status, Theme Toggle & User Profile Avatar */}
        <div className="relative pt-2.5 w-full flex flex-col items-center gap-2">
          {/* Cloud Sync Status Indicator Icon */}
          <div className="relative group w-full flex justify-center">
            <button
              onClick={handleManualSyncClick}
              disabled={isSyncingManual || isPullingManual}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b] transition-all cursor-pointer relative"
              title="Manual Sync (Klik untuk Upload ke Cloud)"
            >
              {isSyncingManual || syncStatus === 'saving' || isPullingManual ? (
                <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
              ) : syncStatus === 'synced' ? (
                <Cloud className="w-4 h-4 text-emerald-400" />
              ) : syncStatus === 'unsynced' ? (
                <Cloud className="w-4 h-4 text-amber-400" />
              ) : syncStatus === 'offline' ? (
                <CloudOff className="w-4 h-4 text-neutral-400" />
              ) : (
                <Terminal className="w-4 h-4 text-amber-400" />
              )}
              {/* Subtle status indicator dot */}
              <span
                className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500'
                    : isSyncingManual || syncStatus === 'saving' || isPullingManual
                    ? 'bg-orange-500 animate-ping'
                    : syncStatus === 'unsynced'
                    ? 'bg-amber-400 animate-pulse'
                    : syncStatus === 'offline'
                    ? 'bg-neutral-500'
                    : 'bg-red-400'
                }`}
              />
            </button>

            {/* Hover Tooltip for Cloud Sync */}
            <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-2 transition-all duration-200 pointer-events-none bg-[#18181b] border border-[#27272a] text-[#f4f4f5] text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-2xl z-50">
              {isSyncingManual
                ? 'Sedang mengunggah ke Cloud...'
                : isPullingManual
                ? 'Sedang memuat dari Cloud...'
                : syncStatus === 'synced'
                ? 'Cloud Synced (Klik untuk Sync)'
                : syncStatus === 'unsynced'
                ? 'Perubahan lokal tersimpan (Klik untuk Sync ke Cloud)'
                : syncStatus === 'offline'
                ? 'Penyimpanan Lokal (Offline)'
                : syncStatus === 'dev-preview'
                ? 'Dev Preview Mode (Local)'
                : 'Sync Issue (Klik untuk coba lagi)'}
            </div>
          </div>

          {/* Light / Dark Mode Toggle Button above Profile Avatar */}
          <div className="relative group w-full flex justify-center">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#18181b] transition-all cursor-pointer relative"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-400 -rotate-12 transition-transform duration-300" />
              )}
            </button>

            {/* Hover Tooltip for Theme Switcher */}
            <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-2 transition-all duration-200 pointer-events-none bg-[#18181b] border border-[#27272a] text-[#f4f4f5] text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-2xl z-50">
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </div>
          </div>

          {/* Profile Avatar Dropdown */}
          <div className="relative group">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center justify-center p-1 rounded-full hover:ring-2 hover:ring-orange-500/50 transition-all cursor-pointer relative"
            >
              <img
                src={userAvatar}
                alt={userDisplayName}
                className="w-9 h-9 rounded-full object-cover border border-[#3f3f46] group-hover:border-orange-500/50 transition-colors shrink-0"
              />
              <span
                className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-[#101010] ${
                  syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'saving' ? 'bg-orange-500' : 'bg-amber-400'
                }`}
              />
            </button>

            {/* Hover Tooltip when popover is closed */}
            {!showUserMenu && (
              <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-2 transition-all duration-200 pointer-events-none bg-[#18181b] border border-[#27272a] text-[#f4f4f5] text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-2xl z-50">
                {userDisplayName}
              </div>
            )}
          </div>

          {/* User Menu Popover Desktop */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              ></div>
              <div className="absolute bottom-2 left-16 w-60 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl p-2.5 z-50 text-xs animate-in fade-in slide-in-from-left-2">
                <div className="px-2.5 py-2 border-b border-[#27272a]">
                  <p className="font-bold text-[#f4f4f5] truncate">{userDisplayName}</p>
                  <p className="text-[11px] font-mono text-[#a1a1aa] truncate">{userEmail}</p>
                </div>

                {/* Cloud Sync Status Info Block */}
                <div className="p-2.5 my-2 rounded-xl bg-[#121215] border border-[#27272a] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#d4d4d8] flex items-center gap-1.5">
                      {syncStatus === 'synced' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : syncStatus === 'saving' || isSyncingManual || isPullingManual ? (
                        <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin shrink-0" />
                      ) : syncStatus === 'unsynced' ? (
                        <Cloud className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : syncStatus === 'offline' ? (
                        <CloudOff className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      ) : (
                        <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      {syncStatus === 'synced' && 'Tersimpan di Cloud'}
                      {(syncStatus === 'saving' || isSyncingManual) && 'Menyimpan ke Cloud...'}
                      {isPullingManual && 'Memuat dari Cloud...'}
                      {syncStatus === 'unsynced' && 'Perubahan Belum Sync'}
                      {syncStatus === 'offline' && 'Offline Mode'}
                      {syncStatus === 'dev-preview' && 'Dev Preview'}
                      {syncStatus === 'error' && 'Sync Error'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    {onTriggerSync && (
                      <button
                        onClick={handleManualSyncClick}
                        disabled={isSyncingManual || isPullingManual}
                        className="flex-1 py-1 px-2 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-[10px] font-medium text-orange-400 hover:text-orange-300 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                        title="Upload perubahan data lokal saat ini ke Cloud"
                      >
                        <CloudUpload className={`w-3 h-3 ${isSyncingManual ? 'animate-bounce' : ''}`} />
                        Sync ke Cloud
                      </button>
                    )}
                    {onPullFromCloud && (
                      <button
                        onClick={handleManualPullClick}
                        disabled={isSyncingManual || isPullingManual}
                        className="flex-1 py-1 px-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[10px] font-medium text-[#d4d4d8] hover:text-[#f4f4f5] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                        title="Muat data tersimpan dari Cloud ke perangkat lokal"
                      >
                        <CloudDownload className={`w-3 h-3 ${isPullingManual ? 'animate-bounce' : ''}`} />
                        Load dari Cloud
                      </button>
                    )}
                  </div>

                  {syncFeedback && (
                    <p className="text-[10px] text-orange-300 font-medium">{syncFeedback}</p>
                  )}

                  <p className="text-[10px] text-[#71717a] leading-tight">
                    {lastSyncedAt
                      ? `Terakhir sync: ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                      : 'Data aman di browser lokal. Klik Sync untuk simpan ke cloud.'}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSelectView('dashboard');
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentView === 'dashboard' ? 'text-orange-400 font-semibold bg-orange-500/10' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <LayoutDashboard className={`w-4 h-4 ${currentView === 'dashboard' ? 'text-orange-400' : 'text-[#71717a]'}`} />
                    <span>Analytics</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSelectView('team');
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentView === 'team' ? 'text-orange-400 font-semibold bg-orange-500/10' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <Users className={`w-4 h-4 ${currentView === 'team' ? 'text-orange-400' : 'text-[#71717a]'}`} />
                    <span>Team</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSelectView('archived');
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentView === 'archived' ? 'text-orange-400 font-semibold bg-orange-500/10' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <Archive className={`w-4 h-4 ${currentView === 'archived' ? 'text-orange-400' : 'text-[#71717a]'}`} />
                    <span>Archived</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSettings();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-[#71717a]" />
                    <span>Preferences & Settings</span>
                  </button>
                  {onSignOut && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onSignOut();
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-red-400 hover:text-red-300 flex items-center gap-2.5 transition-colors mt-1 pt-2 border-t border-[#27272a] cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#101010] [data-theme=light]:bg-[#f8fafc] border-t border-[#27272a] [data-theme=light]:border-[#e2e8f0] px-3 py-2 flex items-center justify-around select-none transition-colors">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onSelectView(item.view)}
              title={item.label}
              className={`flex items-center justify-center p-2.5 rounded-xl transition-all relative cursor-pointer ${
                isActive
                  ? 'text-orange-500 font-semibold'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              <div className={`p-1 rounded-lg transition-transform ${isActive ? 'scale-110 text-orange-500 bg-orange-500/10' : ''}`}>
                {item.icon}
              </div>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 bg-orange-500 rounded-full" />
              )}
            </button>
          );
        })}

        {/* Profile Avatar Tab on Mobile */}
        <div className="flex items-center justify-center p-2 relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            title="Profile & Settings"
            className={`flex items-center justify-center p-0.5 rounded-full transition-all cursor-pointer relative ${
              showUserMenu || currentView === 'dashboard' || currentView === 'team' || currentView === 'archived'
                ? 'ring-2 ring-orange-500/70'
                : 'hover:ring-1 hover:ring-white/20'
            }`}
          >
            <img
              src={userAvatar}
              alt={userDisplayName}
              className="w-6 h-6 rounded-full object-cover border border-[#3f3f46]"
            />
            <span
              className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#18181b] ${
                syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'saving' ? 'bg-orange-500' : 'bg-amber-400'
              }`}
            />
          </button>

          {/* User Menu Popover Mobile */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
                onClick={() => setShowUserMenu(false)}
              ></div>
              <div className="fixed bottom-16 right-3 w-64 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl p-2.5 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-2 border-b border-[#27272a]">
                  <p className="font-bold text-[#f4f4f5] truncate">{userDisplayName}</p>
                  <p className="text-[11px] font-mono text-[#a1a1aa] truncate">{userEmail}</p>
                </div>

                {/* Cloud Sync Status Info Block (Mobile) */}
                <div className="p-2.5 my-2 rounded-xl bg-[#121215] border border-[#27272a] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#d4d4d8] flex items-center gap-1.5">
                      {syncStatus === 'synced' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : syncStatus === 'saving' || isSyncingManual || isPullingManual ? (
                        <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin shrink-0" />
                      ) : syncStatus === 'unsynced' ? (
                        <Cloud className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : syncStatus === 'offline' ? (
                        <CloudOff className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      ) : (
                        <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      {syncStatus === 'synced' && 'Tersimpan di Cloud'}
                      {(syncStatus === 'saving' || isSyncingManual) && 'Menyimpan ke Cloud...'}
                      {isPullingManual && 'Memuat dari Cloud...'}
                      {syncStatus === 'unsynced' && 'Perubahan Belum Sync'}
                      {syncStatus === 'offline' && 'Offline Mode'}
                      {syncStatus === 'dev-preview' && 'Dev Preview'}
                      {syncStatus === 'error' && 'Sync Error'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    {onTriggerSync && (
                      <button
                        onClick={handleManualSyncClick}
                        disabled={isSyncingManual || isPullingManual}
                        className="flex-1 py-1 px-2 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-[10px] font-medium text-orange-400 hover:text-orange-300 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                        title="Upload perubahan data lokal saat ini ke Cloud"
                      >
                        <CloudUpload className={`w-3 h-3 ${isSyncingManual ? 'animate-bounce' : ''}`} />
                        Sync ke Cloud
                      </button>
                    )}
                    {onPullFromCloud && (
                      <button
                        onClick={handleManualPullClick}
                        disabled={isSyncingManual || isPullingManual}
                        className="flex-1 py-1 px-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[10px] font-medium text-[#d4d4d8] hover:text-[#f4f4f5] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                        title="Muat data tersimpan dari Cloud ke perangkat lokal"
                      >
                        <CloudDownload className={`w-3 h-3 ${isPullingManual ? 'animate-bounce' : ''}`} />
                        Load dari Cloud
                      </button>
                    )}
                  </div>

                  {syncFeedback && (
                    <p className="text-[10px] text-orange-300 font-medium">{syncFeedback}</p>
                  )}

                  <p className="text-[10px] text-[#71717a] leading-tight">
                    {lastSyncedAt
                      ? `Terakhir sync: ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                      : 'Data aman di browser lokal. Klik Sync untuk simpan ke cloud.'}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSelectView('dashboard');
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentView === 'dashboard' ? 'text-orange-400 font-semibold bg-orange-500/10' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <LayoutDashboard className={`w-4 h-4 ${currentView === 'dashboard' ? 'text-orange-400' : 'text-[#71717a]'}`} />
                    <span>Analytics</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSelectView('team');
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentView === 'team' ? 'text-orange-400 font-semibold bg-orange-500/10' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <Users className={`w-4 h-4 ${currentView === 'team' ? 'text-orange-400' : 'text-[#71717a]'}`} />
                    <span>Team</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSelectView('archived');
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] flex items-center gap-2.5 transition-colors cursor-pointer ${
                      currentView === 'archived' ? 'text-orange-400 font-semibold bg-orange-500/10' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <Archive className={`w-4 h-4 ${currentView === 'archived' ? 'text-orange-400' : 'text-[#71717a]'}`} />
                    <span>Archived</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSettings();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-[#71717a]" />
                    <span>Preferences & Settings</span>
                  </button>
                  {onSignOut && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onSignOut();
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#27272a] text-red-400 hover:text-red-300 flex items-center gap-2.5 transition-colors mt-1 pt-2 border-t border-[#27272a] cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </nav>
    </>
  );
};


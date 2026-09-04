import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  Palette,
  Sun,
  Moon,
  Check,
  Cloud,
  RefreshCw,
  ExternalLink,
  Eye,
  AlertCircle,
  Copy,
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  UserCheck,
  History,
  RotateCcw,
} from 'lucide-react';
import { AppData, AppTheme, AccentColor, AuthUser, SyncStatus } from '../types';
import { CloudSnapshotInfo, CloudHistoryItem } from '../hooks/useWorkspaceSync';
import firebaseConfigJson from '../../firebase-applet-config.json';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppData;
  onImportJson: (json: AppData) => void;
  onResetDatabase?: () => void;
  onUpdateTheme?: (theme: AppTheme, accent: AccentColor) => void;
  currentUser?: AuthUser | null;
  isDevBypass?: boolean;
  syncStatus?: SyncStatus;
  lastSyncedAt?: Date | null;
  fetchCloudSnapshotInfo?: () => Promise<CloudSnapshotInfo>;
  forcePushToCloud?: () => Promise<void>;
  forcePullFromCloud?: () => Promise<void>;
  fetchCloudHistory?: () => Promise<CloudHistoryItem[]>;
  restoreCloudSnapshot?: (historyItem: CloudHistoryItem) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  appData,
  onImportJson,
  onUpdateTheme,
  currentUser,
  isDevBypass,
  syncStatus,
  lastSyncedAt,
  fetchCloudSnapshotInfo,
  forcePushToCloud,
  forcePullFromCloud,
  fetchCloudHistory,
  restoreCloudSnapshot,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isInspectingCloud, setIsInspectingCloud] = useState(false);
  const [cloudInfo, setCloudInfo] = useState<CloudSnapshotInfo | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyList, setHistoryList] = useState<CloudHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistorySection, setShowHistorySection] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTheme: AppTheme = appData.settings.theme || 'dark';
  const currentAccent: AccentColor = appData.settings.accentColor || 'orange';

  const accentOptions: { id: AccentColor; label: string; color: string; border: string }[] = [
    { id: 'orange', label: 'Orange', color: '#f97316', border: 'border-orange-500' },
    { id: 'blue', label: 'Blue', color: '#3b82f6', border: 'border-blue-500' },
    { id: 'emerald', label: 'Emerald', color: '#10b981', border: 'border-emerald-500' },
    { id: 'purple', label: 'Purple', color: '#8b5cf6', border: 'border-purple-500' },
    { id: 'rose', label: 'Rose', color: '#f43f5e', border: 'border-rose-500' },
  ];

  const handleInspectCloud = async () => {
    if (!fetchCloudSnapshotInfo) return;
    setIsInspectingCloud(true);
    setActionMessage(null);
    try {
      const res = await fetchCloudSnapshotInfo();
      setCloudInfo(res);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Gagal membaca status cloud.' });
    } finally {
      setIsInspectingCloud(false);
    }
  };

  const handleForcePush = async () => {
    if (!forcePushToCloud) return;
    if (!window.confirm('Yakin ingin menimpa data Cloud Firestore dengan data lokal saat ini?')) return;
    setIsProcessing(true);
    setActionMessage(null);
    try {
      await forcePushToCloud();
      setActionMessage({ type: 'success', text: 'Data lokal berhasil diunggah dan disimpan ke Cloud Firestore!' });
      // Refresh cloud info if previously inspected
      if (fetchCloudSnapshotInfo) {
        const res = await fetchCloudSnapshotInfo();
        setCloudInfo(res);
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Gagal mengunggah ke cloud.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForcePull = async () => {
    if (!forcePullFromCloud) return;
    if (!window.confirm('Yakin ingin mengganti data lokal dengan versi terbaru yang tersimpan di Cloud Firestore?')) return;
    setIsProcessing(true);
    setActionMessage(null);
    try {
      await forcePullFromCloud();
      setActionMessage({ type: 'success', text: 'Data Cloud Firestore berhasil ditarik dan menggantikan data lokal!' });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Gagal menarik dari cloud.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyRawJson = () => {
    if (!cloudInfo?.rawJson) return;
    navigator.clipboard.writeText(cloudInfo.rawJson);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleFetchHistory = async () => {
    if (!fetchCloudHistory) return;
    setIsLoadingHistory(true);
    setShowHistorySection(true);
    setActionMessage(null);
    try {
      const list = await fetchCloudHistory();
      setHistoryList(list);
      if (list.length === 0) {
        setActionMessage({ type: 'error', text: 'Belum ada riwayat snapshot cloud tersimpan. Snapshot dibuat otomatis saat terjadi perubahan data.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Gagal memuat riwayat versi dari cloud.' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRestoreItem = async (item: CloudHistoryItem) => {
    if (!restoreCloudSnapshot) return;
    const formattedDate = new Date(item.createdAt).toLocaleString('id-ID');
    if (
      !window.confirm(
        `Yakin ingin me-restore workspace ke versi ${formattedDate} (${item.projectCount} project, ${item.taskCount} task)? Data saat ini akan digantikan dengan versi ini.`
      )
    ) {
      return;
    }
    setRestoringId(item.id);
    setActionMessage(null);
    try {
      await restoreCloudSnapshot(item);
      setActionMessage({
        type: 'success',
        text: `Workspace berhasil dikembalikan ke versi ${formattedDate}!`,
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Gagal merestore versi data.' });
    } finally {
      setRestoringId(null);
    }
  };

  const handleThemeChange = (newTheme: AppTheme) => {
    if (onUpdateTheme) {
      onUpdateTheme(newTheme, currentAccent);
    }
  };

  const handleAccentChange = (newAccent: AccentColor) => {
    if (onUpdateTheme) {
      onUpdateTheme(currentTheme, newAccent);
    }
  };

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `struktur_alur_db_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = e.target.files?.[0];
    if (!fileObj) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as AppData;
        if (parsed && parsed.projects && parsed.settings) {
          onImportJson(parsed);
          alert('Database JSON successfully imported!');
          onClose();
        } else {
          alert('Invalid JSON structure. Must match AppData schema.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(fileObj);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-[#27272a]">
          <h3 className="text-lg font-bold text-[#f4f4f5] flex items-center gap-2">
            <Palette className="w-5 h-5 text-orange-400" /> Preferences & Settings
          </h3>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-[#f4f4f5] p-1 rounded-lg hover:bg-[#27272a] transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Appearance / Theme Selector Section */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-orange-400" /> Appearance & Theme
            </h4>
            <span className="text-[11px] text-[#71717a] font-medium capitalize">
              {currentTheme} Mode • {currentAccent}
            </span>
          </div>

          {/* Mode Switch: Dark vs Light */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                currentTheme === 'dark'
                  ? 'border-orange-500/50 bg-orange-500/10 text-orange-400 shadow-sm'
                  : 'border-[#27272a] bg-[#101010] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#3f3f46]'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Dark Mode</span>
              {currentTheme === 'dark' && <Check className="w-3.5 h-3.5 ml-auto" />}
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                currentTheme === 'light'
                  ? 'border-orange-500/50 bg-orange-500/10 text-orange-400 shadow-sm'
                  : 'border-[#27272a] bg-[#101010] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#3f3f46]'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Light Mode</span>
              {currentTheme === 'light' && <Check className="w-3.5 h-3.5 ml-auto" />}
            </button>
          </div>

          {/* Accent Color Palette */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] text-[#71717a] font-medium">Accent Color</span>
            <div className="grid grid-cols-5 gap-2">
              {accentOptions.map((opt) => {
                const isSelected = currentAccent === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleAccentChange(opt.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500/60 bg-orange-500/10 shadow-xs'
                        : 'border-[#27272a] bg-[#101010] hover:bg-[#27272a] hover:border-[#3f3f46]'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shadow-xs transition-transform transform active:scale-90"
                      style={{ backgroundColor: opt.color }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </span>
                    <span className="text-[10px] font-semibold text-[#a1a1aa]">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cloud Firestore & Multi-Device Sync Diagnostics */}
        <div className="bg-[#101010] border border-[#27272a] rounded-xl p-4 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#f4f4f5] font-bold">
              <Cloud className="w-4 h-4 text-orange-400" />
              <span>Cloud Database (Firestore) & Sync</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                syncStatus === 'synced'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : syncStatus === 'saving'
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                  : isDevBypass
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30'
              }`}
            >
              {syncStatus === 'synced'
                ? 'Synced to Cloud'
                : syncStatus === 'saving'
                ? 'Syncing...'
                : isDevBypass
                ? 'Dev Mode (Local Storage)'
                : 'Offline / Disconnected'}
            </span>
          </div>

          <div className="text-[#a1a1aa] text-[11px] leading-relaxed space-y-1.5">
            <div className="flex items-center justify-between gap-1.5 text-[#d4d4d8]">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>
                  Akun Aktif:{' '}
                  <strong className="text-white">
                    {currentUser?.email || (isDevBypass ? 'Dev Bypass (Lokal)' : 'Belum Login')}
                  </strong>
                </span>
              </div>
            </div>
            {currentUser?.uid && !isDevBypass && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#18181b] border border-[#27272a]">
                <div className="truncate">
                  <span className="text-[#71717a] block text-[10px]">User ID (UID) Akun Ini:</span>
                  <span className="font-mono text-[10px] text-orange-400 select-all">{currentUser.uid}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentUser.uid);
                    setActionMessage({ type: 'success', text: 'UID berhasil disalin ke clipboard!' });
                    setTimeout(() => setActionMessage(null), 2500);
                  }}
                  className="px-2 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded text-[10px] font-medium flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Salin UID"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin UID</span>
                </button>
              </div>
            )}
            <p className="text-[#71717a]">
              Sinkronisasi antar-perangkat (PC dan HP) memerlukan akun Google yang sama di kedua perangkat.
            </p>
          </div>

          {/* Action Message Banner */}
          {actionMessage && (
            <div
              className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* Cloud Check & Inspector Button */}
          <div className="pt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleInspectCloud}
              disabled={isInspectingCloud}
              className="flex-1 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] hover:border-orange-500/40 text-[#f4f4f5] py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 font-semibold text-[11px] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isInspectingCloud ? 'animate-spin' : ''}`} />
              <span>{isInspectingCloud ? 'Memeriksa Cloud...' : 'Periksa Versi Data di Cloud'}</span>
            </button>

            <button
              type="button"
              onClick={handleFetchHistory}
              disabled={isLoadingHistory}
              className="bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] hover:border-purple-500/40 text-[#f4f4f5] py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 font-semibold text-[11px] cursor-pointer"
              title="Lihat riwayat snapshot versi yang tersimpan di cloud"
            >
              <History className={`w-3.5 h-3.5 text-purple-400 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>{isLoadingHistory ? 'Memuat Riwayat...' : 'Riwayat Versi Cloud'}</span>
            </button>

            <a
              href={`https://console.firebase.google.com/project/${firebaseConfigJson.projectId}/firestore/databases/${firebaseConfigJson.firestoreDatabaseId}/data`}
              target="_blank"
              rel="noreferrer"
              className="bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 font-medium text-[11px]"
              title="Buka Database di Firebase Console"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Firebase Console</span>
            </a>
          </div>

          {/* Cloud Version History Section */}
          {showHistorySection && (
            <div className="mt-3 p-3 rounded-xl bg-[#141416] border border-purple-500/30 space-y-2.5 text-[11px]">
              <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-purple-400" />
                  Riwayat Snapshot Cloud ({historyList.length} Versi Tersedia):
                </span>
                <button
                  type="button"
                  onClick={() => setShowHistorySection(false)}
                  className="text-[#71717a] hover:text-white text-[10px] cursor-pointer"
                >
                  Tutup
                </button>
              </div>

              {historyList.length === 0 && !isLoadingHistory && (
                <p className="text-[#71717a] py-2 text-center text-[11px]">
                  Belum ada riwayat snapshot cloud tersimpan. Snapshot akan tersimpan otomatis setiap kali ada pembaruan data atau saat 'Kirim ke Cloud' dijalankan.
                </p>
              )}

              {historyList.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {historyList.map((item, idx) => {
                    const dateFormatted = new Date(item.createdAt).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    });
                    const isRestoring = restoringId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white text-[11px] font-semibold">{dateFormatted}</span>
                            {idx === 0 && (
                              <span className="bg-purple-500/20 text-purple-300 font-mono text-[9px] px-1.5 py-0.5 rounded">
                                Snapshot Terbaru
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#a1a1aa] flex items-center gap-3">
                            <span>{item.projectCount} Project</span>
                            <span>•</span>
                            <span>{item.taskCount} Task</span>
                            {item.lastLogDetails && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[140px] text-[#71717a]">
                                  {item.lastLogDetails}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={restoringId !== null}
                          onClick={() => handleRestoreItem(item)}
                          className="shrink-0 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/60 text-purple-300 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          title="Kembalikan workspace ke versi tanggal ini"
                        >
                          <RotateCcw className={`w-3 h-3 ${isRestoring ? 'animate-spin' : ''}`} />
                          <span>{isRestoring ? 'Memulihkan...' : 'Restore Versi Ini'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Cloud Inspection Results */}
          {cloudInfo && (
            <div className="mt-3 p-3 rounded-xl bg-[#141416] border border-[#27272a] space-y-2.5 text-[11px]">
              <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-orange-400" />
                  Status Dokumen Cloud:
                </span>
                <span
                  className={`font-mono px-2 py-0.5 rounded text-[10px] ${
                    cloudInfo.exists ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {cloudInfo.exists ? 'DOKUMEN TERSEDIA' : 'BELUM TERSIMPAN'}
                </span>
              </div>

              {cloudInfo.error && (
                <p className="text-amber-400/90 text-[11px]">{cloudInfo.error}</p>
              )}

              {cloudInfo.exists && (
                <div className="space-y-1.5 text-[#a1a1aa]">
                  <div className="flex justify-between">
                    <span>Terakhir Update di Cloud:</span>
                    <span className="text-white font-mono">{cloudInfo.updatedAt || 'Tidak ada timestamp'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jumlah Project di Cloud:</span>
                    <span className="text-white font-bold">{cloudInfo.projectsCount} Project</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aktivitas Terakhir di Cloud:</span>
                    <span className="text-white font-mono">{cloudInfo.lastLogTimestamp || '-'}</span>
                  </div>
                  {cloudInfo.lastLogDetails && (
                    <div className="p-1.5 rounded bg-[#1c1c20] text-[10px] text-[#d4d4d8] truncate">
                      Detail: "{cloudInfo.lastLogDetails}"
                    </div>
                  )}

                  {/* Force Pull & Force Push Options */}
                  <div className="pt-2 border-t border-[#27272a] grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleForcePull}
                      disabled={isProcessing}
                      className="bg-[#18181b] hover:bg-emerald-500/10 border border-[#27272a] hover:border-emerald-500/40 text-emerald-400 p-2 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-all cursor-pointer"
                      title="Ganti data lokal dengan versi cloud"
                    >
                      <CloudDownload className="w-3.5 h-3.5" />
                      <span>Tarik dari Cloud</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleForcePush}
                      disabled={isProcessing}
                      className="bg-[#18181b] hover:bg-orange-500/10 border border-[#27272a] hover:border-orange-500/40 text-orange-400 p-2 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-all cursor-pointer"
                      title="Timpa data cloud dengan data lokal saat ini"
                    >
                      <CloudUpload className="w-3.5 h-3.5" />
                      <span>Kirim ke Cloud</span>
                    </button>
                  </div>

                  {/* Toggle View Raw JSON */}
                  <div className="pt-1 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setShowRawJson(!showRawJson)}
                      className="text-orange-400 hover:text-orange-300 text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{showRawJson ? 'Sembunyikan Raw JSON' : 'Lihat Raw JSON Cloud'}</span>
                    </button>

                    {showRawJson && (
                      <button
                        type="button"
                        onClick={handleCopyRawJson}
                        className="text-[#a1a1aa] hover:text-white text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{isCopied ? 'Tersalin' : 'Salin JSON'}</span>
                      </button>
                    )}
                  </div>

                  {showRawJson && cloudInfo.rawJson && (
                    <pre className="mt-2 p-2 bg-[#09090b] border border-[#27272a] rounded-lg text-[10px] font-mono text-[#a1a1aa] max-h-48 overflow-auto whitespace-pre-wrap select-all">
                      {cloudInfo.rawJson}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Database Backup & Restore Controls */}
        <div className="space-y-3 pt-1">
          <h4 className="text-xs font-mono font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-orange-400" /> Backup & Import Data
          </h4>

          <div className="grid grid-cols-2 gap-3">
            {/* Export JSON */}
            <button
              onClick={handleExport}
              className="bg-[#101010] hover:bg-orange-500/10 border border-[#27272a] hover:border-orange-500/40 text-[#f4f4f5] p-3 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Download className="w-5 h-5 text-orange-400" />
              <span>Export DB JSON</span>
            </button>

            {/* Import JSON */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#101010] hover:bg-emerald-500/10 border border-[#27272a] hover:border-emerald-500/40 text-[#f4f4f5] p-3 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Upload className="w-5 h-5 text-emerald-400" />
              <span>Import DB JSON</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  HardDrive,
  ShieldCheck,
  Palette,
  Sun,
  Moon,
  Check,
} from 'lucide-react';
import { AppData, AppTheme, AccentColor } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppData;
  onImportJson: (json: AppData) => void;
  onResetDatabase?: () => void;
  onUpdateTheme?: (theme: AppTheme, accent: AccentColor) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  appData,
  onImportJson,
  onUpdateTheme,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        {/* System Architecture Info Box */}
        <div className="bg-[#101010] border border-[#27272a] rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 text-[#f4f4f5] font-bold">
            <HardDrive className="w-4 h-4 text-orange-400" /> Single JSON Architecture
          </div>
          <p className="text-[#a1a1aa] leading-relaxed">
            All project trees, recursive sub-items, time sessions, team directory, and active timer
            states are persisted atomically to <span className="font-mono text-orange-400">data/db.json</span>.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#10b981] pt-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Atomic File Write Enabled
          </div>
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

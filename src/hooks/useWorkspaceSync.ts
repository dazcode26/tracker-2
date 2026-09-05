import React, { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppData, AuthUser, SyncStatus, ItemNode } from '../types';
import { initialAppData } from '../defaultData';

const LOCAL_STORAGE_DATA_KEY = 'struktur_app_data';

// Helper to enforce maximum wait time for network write/read operations
function withTimeout<T>(promise: Promise<T>, ms: number, fallbackMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(fallbackMessage));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Compute statistics to compare data richness and prevent stale cloud overwrite
interface DataStats {
  sessionCount: number;
  totalLoggedSeconds: number;
  itemCount: number;
  logCount: number;
}

function computeDataStats(data: AppData | null | undefined): DataStats {
  if (!data) return { sessionCount: 0, totalLoggedSeconds: 0, itemCount: 0, logCount: 0 };
  let sessionCount = 0;
  let totalLoggedSeconds = 0;
  let itemCount = 0;
  const countNode = (node: ItemNode) => {
    itemCount++;
    if (Array.isArray(node.sessions)) {
      sessionCount += node.sessions.length;
      for (const s of node.sessions) {
        totalLoggedSeconds += s.loggedSeconds || 0;
      }
    }
    if (Array.isArray(node.subItems)) {
      node.subItems.forEach(countNode);
    }
  };
  (data.projects || []).forEach((p) => (p.items || []).forEach(countNode));
  return {
    sessionCount,
    totalLoggedSeconds,
    itemCount,
    logCount: Array.isArray(data.activityLogs) ? data.activityLogs.length : 0,
  };
}

export interface CloudSnapshotInfo {
  exists: boolean;
  updatedAt?: string | null;
  ownerEmail?: string | null;
  projectsCount?: number;
  activityLogsCount?: number;
  lastLogTimestamp?: string | null;
  lastLogDetails?: string | null;
  rawJson?: string;
  userId?: string;
  error?: string;
}

export interface CloudHistoryItem {
  id: string;
  createdAt: string;
  projectCount: number;
  taskCount: number;
  lastLogDetails?: string;
  snapshotData?: AppData;
}

export interface WorkspaceSyncReturn {
  appData: AppData;
  setAppData: Dispatch<SetStateAction<AppData>>;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  isInitialCloudLoaded: boolean;
  syncError: string | null;
  persistData: (newData: AppData, options?: { localOnly?: boolean }) => void;
  triggerManualSync: () => Promise<void>;
  fetchCloudSnapshotInfo: () => Promise<CloudSnapshotInfo>;
  forcePushToCloud: () => Promise<void>;
  forcePullFromCloud: () => Promise<void>;
  fetchCloudHistory: () => Promise<CloudHistoryItem[]>;
  restoreCloudSnapshot: (historyItem: CloudHistoryItem) => Promise<void>;
}

export function useWorkspaceSync(
  currentUser: AuthUser | null,
  isDevBypass: boolean
): WorkspaceSyncReturn {
  // Initialize from local storage cache or fallback to initial template
  const [appData, setAppData] = useState<AppData>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_DATA_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.projects)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse local storage cache:', e);
    }
    return initialAppData;
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    if (isDevBypass) return 'dev-preview';
    const hasUnsynced = localStorage.getItem('struktur_has_unsynced') === 'true';
    return hasUnsynced ? 'unsynced' : 'synced';
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem('struktur_last_synced_at');
      if (saved) {
        const d = new Date(saved);
        if (!isNaN(d.getTime())) return d;
      }
    } catch {}
    return null;
  });
  const [isInitialCloudLoaded, setIsInitialCloudLoaded] = useState<boolean>(true);
  const isInitialCloudLoadedRef = useRef<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Keep a ref of current appData to avoid stale closure during remote sync
  const appDataRef = useRef<AppData>(appData);
  appDataRef.current = appData;

  const hasUnsyncedLocalChangesRef = useRef<boolean>(() => {
    return localStorage.getItem('struktur_has_unsynced') === 'true';
  });

  // Helper to count total tasks across all projects
  const countTotalTasks = (projects: any[]): number => {
    let count = 0;
    projects?.forEach((p) => {
      count += p.items?.length || 0;
    });
    return count;
  };

  // Helper to save a version snapshot to the user's history subcollection (capped at latest 5 snapshots)
  const saveCloudSnapshot = useCallback(async (userId: string, data: AppData) => {
    try {
      const historyColRef = collection(db, 'users', userId, 'history');
      const snapshotId = `rev-${Date.now()}`;
      const docRef = doc(historyColRef, snapshotId);
      await setDoc(docRef, {
        id: snapshotId,
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        projectCount: data.projects?.length || 0,
        taskCount: countTotalTasks(data.projects || []),
        lastLogDetails: data.activityLogs?.[0]?.details || null,
        data: JSON.parse(JSON.stringify(data)),
      });

      // Automatically prune snapshots older than the latest 5 to keep storage tidy
      const q = query(historyColRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (snap.docs.length > 5) {
        const excessDocs = snap.docs.slice(5);
        for (const excessDoc of excessDocs) {
          await deleteDoc(excessDoc.ref).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Failed to save cloud snapshot history:', e);
    }
  }, []);

  // 1. Local-first initialization: No automatic load from cloud on startup
  useEffect(() => {
    setIsInitialCloudLoaded(true);
    isInitialCloudLoadedRef.current = true;
    if (isDevBypass) {
      setSyncStatus('dev-preview');
    } else if (!currentUser) {
      setSyncStatus('offline');
    }
  }, [currentUser, isDevBypass]);

  // 2. Persist data: Local storage only (No automatic upload to cloud)
  const persistData = useCallback(
    (newData: AppData, options?: { localOnly?: boolean }) => {
      // 1. Immediate optimistic UI update with timestamp
      const stampedData: AppData = {
        ...newData,
        _lastModified: Date.now(),
      };

      setAppData(stampedData);
      appDataRef.current = stampedData;

      // 2. Persist to localStorage immediately for instant offline safety
      try {
        localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(stampedData));
        if (!options?.localOnly) {
          localStorage.setItem('struktur_has_unsynced', 'true');
        }
      } catch (err) {
        console.warn('LocalStorage quota warning:', err);
      }

      // If local-only change (e.g. tree expand/collapse UI state), skip marking unsynced
      if (options?.localOnly) {
        return;
      }

      // 3. Fallback to local server API if running in container dev
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stampedData),
      }).catch(() => {});

      // Mark that local changes exist waiting for manual sync
      hasUnsyncedLocalChangesRef.current = true;
      if (isDevBypass) {
        setSyncStatus('dev-preview');
      } else if (!currentUser) {
        setSyncStatus('offline');
      } else {
        setSyncStatus('unsynced');
      }
    },
    [currentUser, isDevBypass]
  );

  // 3. Manual Sync: Push local changes to cloud on explicit user demand
  const triggerManualSync = useCallback(async () => {
    if (!currentUser || isDevBypass) {
      setSyncStatus(isDevBypass ? 'dev-preview' : 'offline');
      return;
    }

    try {
      setSyncStatus('saving');
      const workspaceDocRef = doc(db, 'users', currentUser.uid, 'workspace', 'data');

      // User clicked sync to upload their local changes to cloud
      const currentData = appDataRef.current;
      const cleanData = JSON.parse(JSON.stringify(currentData));

      setDoc(
        doc(db, 'users', currentUser.uid),
        {
          email: currentUser.email || null,
          displayName: currentUser.displayName || null,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});

      await withTimeout(
        setDoc(workspaceDocRef, {
          ...cleanData,
          _updatedAt: serverTimestamp(),
          _ownerEmail: currentUser.email || null,
        }),
        25000,
        'Waktu habis saat menyimpan data lokal ke cloud.'
      );

      saveCloudSnapshot(currentUser.uid, cleanData).catch(() => {});

      hasUnsyncedLocalChangesRef.current = false;
      try {
        localStorage.removeItem('struktur_has_unsynced');
        const nowIso = new Date().toISOString();
        localStorage.setItem('struktur_last_synced_at', nowIso);
      } catch {}

      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      setSyncError(null);
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      hasUnsyncedLocalChangesRef.current = true;
      setSyncStatus('error');
      setSyncError(err?.message || 'Manual sync failed (koneksi lambat)');
    }
  }, [currentUser, isDevBypass, saveCloudSnapshot]);

  // 4. Inspect Cloud Document without modifying local state
  const fetchCloudSnapshotInfo = useCallback(async (): Promise<CloudSnapshotInfo> => {
    if (!currentUser || isDevBypass) {
      return {
        exists: false,
        error: isDevBypass
          ? 'Mode Dev Preview / Offline aktif. Data saat ini tidak terhubung ke Firestore Cloud.'
          : 'Belum login dengan akun Google.',
      };
    }

    try {
      const workspaceDocRef = doc(db, 'users', currentUser.uid, 'workspace', 'data');
      const snapshot = await getDoc(workspaceDocRef);

      if (!snapshot.exists()) {
        return {
          exists: false,
          userId: currentUser.uid,
          ownerEmail: currentUser.email || null,
        };
      }

      const remoteData = snapshot.data() as any;
      let updatedAtStr: string | null = null;
      if (remoteData._updatedAt?.toDate) {
        updatedAtStr = remoteData._updatedAt.toDate().toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'medium',
        });
      }

      const projectsCount = Array.isArray(remoteData.projects) ? remoteData.projects.length : 0;
      const activityLogs = Array.isArray(remoteData.activityLogs) ? remoteData.activityLogs : [];
      const latestLog = activityLogs.length > 0 ? activityLogs[0] : null;

      let lastLogTimestamp: string | null = null;
      if (latestLog?.timestamp) {
        try {
          lastLogTimestamp = new Date(latestLog.timestamp).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'medium',
          });
        } catch {
          lastLogTimestamp = latestLog.timestamp;
        }
      }

      return {
        exists: true,
        userId: currentUser.uid,
        ownerEmail: remoteData._ownerEmail || currentUser.email || null,
        updatedAt: updatedAtStr,
        projectsCount,
        activityLogsCount: activityLogs.length,
        lastLogTimestamp,
        lastLogDetails: latestLog?.details || null,
        rawJson: JSON.stringify(remoteData, null, 2),
      };
    } catch (err: any) {
      console.error('Error fetching cloud snapshot info:', err);
      return {
        exists: false,
        userId: currentUser.uid,
        error: err?.message || 'Gagal membaca dokumen Firestore.',
      };
    }
  }, [currentUser, isDevBypass]);

  // 5. Force Push: upload local state directly to Firestore
  const forcePushToCloud = useCallback(async () => {
    if (!currentUser || isDevBypass) {
      throw new Error('Harap login dengan akun Google untuk push ke cloud.');
    }

    setSyncStatus('saving');
    const workspaceDocRef = doc(db, 'users', currentUser.uid, 'workspace', 'data');
    const cleanData = JSON.parse(JSON.stringify(appDataRef.current));

    setDoc(
      doc(db, 'users', currentUser.uid),
      {
        email: currentUser.email || null,
        displayName: currentUser.displayName || null,
        lastActive: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});

    await withTimeout(
      setDoc(workspaceDocRef, {
        ...cleanData,
        _updatedAt: serverTimestamp(),
        _ownerEmail: currentUser.email || null,
      }),
      25000,
      'Waktu habis saat mengunggah data ke cloud.'
    );

    // Save snapshot to history subcollection
    saveCloudSnapshot(currentUser.uid, cleanData).catch(() => {});

    hasUnsyncedLocalChangesRef.current = false;
    setSyncStatus('synced');
    setLastSyncedAt(new Date());
    setSyncError(null);
  }, [currentUser, isDevBypass, saveCloudSnapshot]);

  // 6. Force Pull: overwrite local state with remote Firestore data
  const forcePullFromCloud = useCallback(async () => {
    if (!currentUser || isDevBypass) {
      throw new Error('Harap login dengan akun Google untuk pull dari cloud.');
    }

    setSyncStatus('saving');
    const workspaceDocRef = doc(db, 'users', currentUser.uid, 'workspace', 'data');
    const snapshot = await withTimeout(
      getDoc(workspaceDocRef),
      25000,
      'Waktu habis saat mengunduh data dari cloud.'
    );

    if (snapshot.exists()) {
      const remoteData = snapshot.data() as AppData;
      if (remoteData && Array.isArray(remoteData.projects)) {
        hasUnsyncedLocalChangesRef.current = false;
        try {
          localStorage.removeItem('struktur_has_unsynced');
          localStorage.setItem('struktur_last_synced_at', new Date().toISOString());
        } catch {}
        setAppData(remoteData);
        localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(remoteData));
        setSyncStatus('synced');
        setLastSyncedAt(new Date());
        setSyncError(null);
      }
    } else {
      throw new Error('Dokumen workspace di cloud belum ada.');
    }
  }, [currentUser, isDevBypass]);

  // 7. Fetch version history snapshots from Firestore subcollection
  const fetchCloudHistory = useCallback(async (): Promise<CloudHistoryItem[]> => {
    if (!currentUser || isDevBypass) return [];
    try {
      const historyColRef = collection(db, 'users', currentUser.uid, 'history');
      const q = query(historyColRef, orderBy('createdAt', 'desc'), limit(5));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const itemData = d.data();
        return {
          id: d.id,
          createdAt: itemData.createdAt || d.id,
          projectCount: itemData.projectCount || 0,
          taskCount: itemData.taskCount || 0,
          lastLogDetails: itemData.lastLogDetails,
          snapshotData: itemData.data as AppData,
        };
      });
    } catch (e) {
      console.warn('Failed to fetch cloud history:', e);
      return [];
    }
  }, [currentUser, isDevBypass]);

  // 8. Restore from a specific snapshot
  const restoreCloudSnapshot = useCallback(
    async (historyItem: CloudHistoryItem) => {
      if (!currentUser || isDevBypass) {
        throw new Error('Harap login dengan akun Google untuk restore snapshot.');
      }

      setSyncStatus('saving');
      let dataToRestore = historyItem.snapshotData;
      if (!dataToRestore) {
        const docRef = doc(db, 'users', currentUser.uid, 'history', historyItem.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error('Dokumen riwayat tidak ditemukan');
        dataToRestore = docSnap.data().data as AppData;
      }

      if (!dataToRestore || !Array.isArray(dataToRestore.projects)) {
        throw new Error('Format data riwayat tidak valid.');
      }

      const cleanRestored = JSON.parse(JSON.stringify(dataToRestore));
      setAppData(cleanRestored);
      localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(cleanRestored));

      const workspaceDocRef = doc(db, 'users', currentUser.uid, 'workspace', 'data');
      await setDoc(workspaceDocRef, {
        ...cleanRestored,
        _updatedAt: serverTimestamp(),
        _ownerEmail: currentUser.email || null,
      });

      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      setSyncError(null);
    },
    [currentUser, isDevBypass]
  );

  return {
    appData,
    setAppData,
    syncStatus,
    lastSyncedAt,
    isInitialCloudLoaded,
    syncError,
    persistData,
    triggerManualSync,
    fetchCloudSnapshotInfo,
    forcePushToCloud,
    forcePullFromCloud,
    fetchCloudHistory,
    restoreCloudSnapshot,
  };
}

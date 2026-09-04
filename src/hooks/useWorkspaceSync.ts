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

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    isDevBypass ? 'dev-preview' : 'synced'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isInitialCloudLoaded, setIsInitialCloudLoaded] = useState<boolean>(false);
  const isInitialCloudLoadedRef = useRef<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Keep a ref of current appData to avoid stale closure during remote sync
  const appDataRef = useRef<AppData>(appData);
  appDataRef.current = appData;

  // Track last saved projects JSON from local client to prevent redundant re-renders on remote echo
  const lastSavedProjectsJsonRef = useRef<string>('');

  // Debounce ref for Firestore write operations
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIncomingRemoteUpdateRef = useRef<boolean>(false);
  const lastHistorySnapshotTimeRef = useRef<number>(0);
  const hasUnsyncedLocalChangesRef = useRef<boolean>(false);

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
      lastHistorySnapshotTimeRef.current = Date.now();

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

  // 1. Setup Cloud Firestore real-time synchronization
  useEffect(() => {
    if (!currentUser || isDevBypass) {
      setSyncStatus(isDevBypass ? 'dev-preview' : 'offline');
      setIsInitialCloudLoaded(true);
      isInitialCloudLoadedRef.current = true;
      return;
    }

    const userId = currentUser.uid;
    const workspaceDocRef = doc(db, 'users', userId, 'workspace', 'data');
    setSyncStatus('saving');

    // Subscribe to real-time changes across devices
    const unsubscribe = onSnapshot(
      workspaceDocRef,
      { includeMetadataChanges: true },
      async (snapshot) => {
        try {
          if (!snapshot.exists()) {
            // First time login for this user account:
            // Migrate existing local workspace or template data to Firestore
            console.info('First-time user setup: Migrating initial workspace data to Firestore...');
            const dataToMigrate = appDataRef.current && appDataRef.current.projects?.length > 0
              ? appDataRef.current
              : initialAppData;

            // Sanitize JSON to prevent undefined values in Firestore
            const cleanData = JSON.parse(JSON.stringify(dataToMigrate));

            // Ensure parent user document exists with metadata to avoid phantom doc in Firebase Console
            setDoc(
              doc(db, 'users', userId),
              {
                email: currentUser.email || null,
                displayName: currentUser.displayName || null,
                lastActive: serverTimestamp(),
              },
              { merge: true }
            ).catch(() => {});

            await setDoc(workspaceDocRef, {
              ...cleanData,
              _updatedAt: serverTimestamp(),
              _ownerEmail: currentUser.email || null,
            });

            // Save initial snapshot to history
            saveCloudSnapshot(userId, cleanData).catch(() => {});

            setAppData(cleanData);
            localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(cleanData));
            setSyncStatus('synced');
            setLastSyncedAt(new Date());
            setIsInitialCloudLoaded(true);
            isInitialCloudLoadedRef.current = true;
            return;
          }

          // Remote document exists
          const remoteData = snapshot.data() as AppData;
          if (remoteData && Array.isArray(remoteData.projects)) {
            // If snapshot is from local write pending confirmation
            if (snapshot.metadata.hasPendingWrites) {
              setSyncStatus('saving');
            } else {
              // Remote update from another device or confirmed server write
              const remoteProjectsJson = JSON.stringify(remoteData.projects);
              const isLocalMatch = remoteProjectsJson === lastSavedProjectsJsonRef.current;
              const hasPendingLocalTimeout = saveTimeoutRef.current !== null;
              const hasUnsyncedChanges = hasUnsyncedLocalChangesRef.current;

              // If this snapshot is an echo of our local write or we have pending unsynced changes,
              // do NOT overwrite local appData to avoid losing user edits
              if (isLocalMatch || hasPendingLocalTimeout || hasUnsyncedChanges) {
                if (!hasUnsyncedChanges) {
                  setSyncStatus('synced');
                  setLastSyncedAt(new Date());
                  setSyncError(null);
                }
              } else {
                const localModified = appDataRef.current?._lastModified || 0;
                const remoteModified = remoteData._lastModified || 0;
                const localStats = computeDataStats(appDataRef.current);
                const remoteStats = computeDataStats(remoteData);

                const localHasUnsyncedWork =
                  localModified > remoteModified ||
                  localStats.sessionCount > remoteStats.sessionCount ||
                  localStats.totalLoggedSeconds > remoteStats.totalLoggedSeconds;

                if (localHasUnsyncedWork) {
                  console.info(
                    `Preserving local workspace: local (mod: ${localModified}, ${localStats.sessionCount} sessions) vs remote (mod: ${remoteModified}, ${remoteStats.sessionCount} sessions). Re-syncing local to cloud.`
                  );
                  // Retain local state and push to cloud to heal remote document
                  setSyncStatus('saving');
                  hasUnsyncedLocalChangesRef.current = true;
                  setTimeout(() => {
                    if (appDataRef.current) {
                      persistData(appDataRef.current);
                    }
                  }, 400);
                } else {
                  isIncomingRemoteUpdateRef.current = true;
                  setAppData(remoteData);
                  try {
                    localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(remoteData));
                  } catch {}
                  setSyncStatus('synced');
                  setLastSyncedAt(new Date());
                  setSyncError(null);
                }
              }
            }
          }
          setIsInitialCloudLoaded(true);
          isInitialCloudLoadedRef.current = true;
        } catch (err: any) {
          console.error('Error handling Firestore snapshot:', err);
          setSyncError(err?.message || 'Failed to sync with cloud');
          setSyncStatus('offline');
          setIsInitialCloudLoaded(true);
          isInitialCloudLoadedRef.current = true;
        }
      },
      (error) => {
        console.warn('Firestore subscription error (working offline/fallback):', error);
        setSyncStatus('offline');
        setSyncError(error.message);
        setIsInitialCloudLoaded(true);
        isInitialCloudLoadedRef.current = true;
      }
    );

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentUser?.uid, isDevBypass, saveCloudSnapshot]);

  // 2. Persist data: optimistic local update + debounced Firestore push
  const persistData = useCallback(
    (newData: AppData, options?: { localOnly?: boolean }) => {
      // 1. Immediate optimistic UI update with timestamp
      const stampedData: AppData = {
        ...newData,
        _lastModified: Date.now(),
      };

      setAppData(stampedData);
      appDataRef.current = stampedData;
      try {
        lastSavedProjectsJsonRef.current = JSON.stringify(stampedData.projects);
      } catch {}

      // 2. Persist to localStorage immediately for instant offline safety
      try {
        localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(stampedData));
      } catch (err) {
        console.warn('LocalStorage quota warning:', err);
      }

      // If local-only change (e.g. tree expand/collapse UI state), skip server/cloud write
      if (options?.localOnly) {
        return;
      }

      // 3. Fallback to local server API if running in container dev
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stampedData),
      }).catch(() => {});

      // 4. In dev bypass mode, local persistence is sufficient
      if (isDevBypass || !currentUser) {
        setSyncStatus(isDevBypass ? 'dev-preview' : 'offline');
        return;
      }

      // 4b. Guard against pushing stale local cache before cloud snapshot finishes loading
      if (!isInitialCloudLoadedRef.current) {
        console.warn('Blocked cloud write: Waiting for initial cloud snapshot first.');
        return;
      }

      // 5. Debounce push to Firestore (500ms debounce to prevent rapid consecutive writes)
      setSyncStatus('saving');
      hasUnsyncedLocalChangesRef.current = true;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const workspaceDocRef = doc(db, 'users', currentUser.uid, 'workspace', 'data');
          // Clean undefined values before writing to Firestore
          const cleanData = JSON.parse(JSON.stringify(stampedData));

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
            'Koneksi cloud lambat. Data aman di perangkat.'
          );

          // Throttle auto-snapshot to history subcollection (at most once every 5 minutes)
          if (Date.now() - lastHistorySnapshotTimeRef.current > 5 * 60 * 1000) {
            saveCloudSnapshot(currentUser.uid, cleanData).catch(() => {});
          }

          saveTimeoutRef.current = null;
          hasUnsyncedLocalChangesRef.current = false;
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
          setSyncError(null);
        } catch (err: any) {
          saveTimeoutRef.current = null;
          console.error('Failed to sync changes to Firestore:', err);
          hasUnsyncedLocalChangesRef.current = true;
          setSyncStatus('offline');
          setSyncError(err?.message || 'Koneksi cloud lambat. Data aman di penyimpanan lokal.');
        }
      }, 500);
    },
    [currentUser, isDevBypass, saveCloudSnapshot]
  );

  // 3. Manual Sync / Force Refresh
  const triggerManualSync = useCallback(async () => {
    if (!currentUser || isDevBypass) {
      setSyncStatus(isDevBypass ? 'dev-preview' : 'offline');
      return;
    }

    try {
      setSyncStatus('saving');
      const workspaceDocRef = doc(db, 'users', currentUser.uid, 'workspace', 'data');

      // User clicked sync to ensure their latest local changes are pushed and stored in cloud
      const currentData = appDataRef.current;
      const cleanData = JSON.parse(JSON.stringify(currentData));

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
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      setSyncError(null);
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      hasUnsyncedLocalChangesRef.current = true;
      setSyncStatus('offline');
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

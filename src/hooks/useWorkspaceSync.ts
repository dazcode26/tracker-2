import React, { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppData, AuthUser, SyncStatus } from '../types';
import { initialAppData } from '../defaultData';

const LOCAL_STORAGE_DATA_KEY = 'struktur_app_data';

export interface WorkspaceSyncReturn {
  appData: AppData;
  setAppData: Dispatch<SetStateAction<AppData>>;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  isInitialCloudLoaded: boolean;
  syncError: string | null;
  persistData: (newData: AppData) => void;
  triggerManualSync: () => Promise<void>;
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
  const [syncError, setSyncError] = useState<string | null>(null);

  // Keep a ref of current appData to avoid stale closure during remote sync
  const appDataRef = useRef<AppData>(appData);
  appDataRef.current = appData;

  // Debounce ref for Firestore write operations
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIncomingRemoteUpdateRef = useRef<boolean>(false);

  // 1. Setup Cloud Firestore real-time synchronization
  useEffect(() => {
    if (!currentUser || isDevBypass) {
      setSyncStatus(isDevBypass ? 'dev-preview' : 'offline');
      setIsInitialCloudLoaded(true);
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

            await setDoc(workspaceDocRef, {
              ...cleanData,
              _updatedAt: serverTimestamp(),
              _ownerEmail: currentUser.email || null,
            });

            setAppData(cleanData);
            localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(cleanData));
            setSyncStatus('synced');
            setLastSyncedAt(new Date());
            setIsInitialCloudLoaded(true);
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
          setIsInitialCloudLoaded(true);
        } catch (err: any) {
          console.error('Error handling Firestore snapshot:', err);
          setSyncError(err?.message || 'Failed to sync with cloud');
          setSyncStatus('error');
          setIsInitialCloudLoaded(true);
        }
      },
      (error) => {
        console.warn('Firestore subscription error (working offline/fallback):', error);
        setSyncStatus('offline');
        setSyncError(error.message);
        setIsInitialCloudLoaded(true);
      }
    );

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentUser?.uid, isDevBypass]);

  // 2. Persist data: optimistic local update + debounced Firestore push
  const persistData = useCallback(
    (newData: AppData) => {
      // 1. Immediate optimistic UI update
      setAppData(newData);
      appDataRef.current = newData;

      // 2. Persist to localStorage immediately for instant offline safety
      try {
        localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(newData));
      } catch (err) {
        console.warn('LocalStorage quota warning:', err);
      }

      // 3. Fallback to local server API if running in container dev
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      }).catch(() => {});

      // 4. In dev bypass mode, local persistence is sufficient
      if (isDevBypass || !currentUser) {
        setSyncStatus(isDevBypass ? 'dev-preview' : 'offline');
        return;
      }

      // 5. Debounce push to Firestore (500ms debounce to prevent rapid consecutive writes)
      setSyncStatus('saving');
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const workspaceDocRef = doc(db, 'users', currentUser.uid, 'workspace', 'data');
          // Clean undefined values before writing to Firestore
          const cleanData = JSON.parse(JSON.stringify(newData));

          await setDoc(workspaceDocRef, {
            ...cleanData,
            _updatedAt: serverTimestamp(),
            _ownerEmail: currentUser.email || null,
          });

          setSyncStatus('synced');
          setLastSyncedAt(new Date());
          setSyncError(null);
        } catch (err: any) {
          console.error('Failed to sync changes to Firestore:', err);
          setSyncStatus('offline');
          setSyncError(err?.message || 'Sync failed');
        }
      }, 500);
    },
    [currentUser, isDevBypass]
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
      const snapshot = await getDoc(workspaceDocRef);

      if (snapshot.exists()) {
        const remoteData = snapshot.data() as AppData;
        if (remoteData && Array.isArray(remoteData.projects)) {
          setAppData(remoteData);
          localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(remoteData));
        }
      } else {
        // Upload current state if not found
        const cleanData = JSON.parse(JSON.stringify(appDataRef.current));
        await setDoc(workspaceDocRef, {
          ...cleanData,
          _updatedAt: serverTimestamp(),
          _ownerEmail: currentUser.email || null,
        });
      }

      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      setSyncError(null);
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      setSyncStatus('error');
      setSyncError(err?.message || 'Manual sync failed');
    }
  }, [currentUser, isDevBypass]);

  return {
    appData,
    setAppData,
    syncStatus,
    lastSyncedAt,
    isInitialCloudLoaded,
    syncError,
    persistData,
    triggerManualSync,
  };
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { AuthUser } from '../types';

interface AuthContextType {
  currentUser: AuthUser | null;
  isLoading: boolean;
  isDevBypass: boolean;
  signInWithGoogle: () => Promise<void>;
  signInDevBypass: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_AUTH_KEY = 'tracker_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDevBypass, setIsDevBypass] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if there is an active dev-bypass session saved
    try {
      const savedUserStr = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed && parsed.uid && parsed.uid.startsWith('dev-')) {
          setCurrentUser(parsed);
          setIsDevBypass(true);
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Error reading dev session from localStorage:', e);
    }

    // 2. Listen to real Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        const userObj: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setCurrentUser(userObj);
        setIsDevBypass(false);
        try {
          localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(userObj));
        } catch (err) {
          console.warn('Failed to cache auth user:', err);
        }
      } else {
        // If not in dev bypass, set user to null
        const savedUserStr = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
        if (savedUserStr) {
          try {
            const parsed = JSON.parse(savedUserStr);
            if (parsed?.uid?.startsWith('dev-')) {
              setCurrentUser(parsed);
              setIsDevBypass(true);
              setIsLoading(false);
              return;
            }
          } catch {}
        }
        setCurrentUser(null);
        setIsDevBypass(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInDevBypass = () => {
    const devUser: AuthUser = {
      uid: 'dev-user-master',
      email: 'dev@preview.local',
      displayName: 'Project Lead (Dev)',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    };
    setCurrentUser(devUser);
    setIsDevBypass(true);
    try {
      localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(devUser));
    } catch (e) {
      console.error('Failed to persist dev user to localStorage:', e);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userObj: AuthUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };
      setCurrentUser(userObj);
      setIsDevBypass(false);
      try {
        localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(userObj));
      } catch (err) {
        console.warn('Failed to cache user session:', err);
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      // Helpful error guidance for iframe / popup environments
      if (error?.code === 'auth/popup-blocked') {
        throw new Error('Pop-up login diblokir browser. Harap izinkan pop-up atau buka aplikasi di tab baru.');
      }
      if (error?.code === 'auth/unauthorized-domain') {
        throw new Error('Domain ini belum didaftarkan di Firebase Console Authorized Domains.');
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase sign out error:', e);
    }
    setCurrentUser(null);
    setIsDevBypass(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
    } catch (e) {
      console.error('Failed to clear auth from localStorage:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        isDevBypass,
        signInWithGoogle,
        signInDevBypass,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

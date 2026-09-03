import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// In Vite, client env vars can be injected or fallback to the provided firebase config json
const firebaseConfig = {
  apiKey: (import.meta as any)?.env?.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: (import.meta as any)?.env?.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: (import.meta as any)?.env?.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: (import.meta as any)?.env?.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: (import.meta as any)?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: (import.meta as any)?.env?.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firestore
// Use firestoreDatabaseId if configured in project, otherwise default instance
export const db = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

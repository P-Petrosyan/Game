import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  type Auth,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

function createFirebaseConfig() {
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_FIREBASE_AUTH_DOMAIN ?? process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  } as const;

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(
      `Firebase configuration is incomplete. Missing: ${missing.join(', ')}. Double-check your environment variables.`,
    );
  }

  return config;
}

let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
let firestore: Firestore;

function ensureFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    const config = createFirebaseConfig();
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
  }

  return firebaseApp;
}

function ensureAuth(app: FirebaseApp): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  if (Platform.OS === 'web') {
    firebaseAuth = getAuth(app);
    return firebaseAuth;
  }

  try {
    firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // initializeAuth can only be called once per app instance. If it throws, fall back to the default auth instance.
    firebaseAuth = getAuth(app);
  }

  return firebaseAuth;
}

function ensureFirestore(app: FirebaseApp): Firestore {
  if (!firestore) {
    firestore = getFirestore(app);
  }

  return firestore;
}

const app = ensureFirebaseApp();
const auth = ensureAuth(app);
const db = ensureFirestore(app);

export { app, auth, db };

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  DeviceCheckProvider,
  PlayIntegrityProvider,
} from 'firebase/app-check';
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
    databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
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
  if (firebaseAuth) return firebaseAuth;

  if (Platform.OS === 'web') {
    firebaseAuth = getAuth(app);
    return firebaseAuth;
  }

  try {
    firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    firebaseAuth = getAuth(app);
  }

  return firebaseAuth;
}

function ensureFirestore(app: FirebaseApp): Firestore {
  if (!firestore) firestore = getFirestore(app);
  return firestore;
}

const app = ensureFirebaseApp();
const auth = ensureAuth(app);
const db = ensureFirestore(app);

// ✅ Initialize Firebase App Check correctly for native builds
if (!__DEV__ && Platform.OS !== 'web') {
  try {
    if (Platform.OS === 'ios') {
      // 🛡 Use DeviceCheck (native, no reCAPTCHA)
      initializeAppCheck(app, {
        provider: new DeviceCheckProvider(),
        isTokenAutoRefreshEnabled: true,
      });
      console.log('✅ App Check initialized with DeviceCheck');
    } else if (Platform.OS === 'android') {
      // 🛡 Use Play Integrity (native)
      initializeAppCheck(app, {
        provider: new PlayIntegrityProvider(),
        isTokenAutoRefreshEnabled: true,
      });
      console.log('✅ App Check initialized with Play Integrity');
    }
  } catch (err) {
    console.warn('⚠️ App Check init failed:', err);
  }
} else {
  console.log('🧩 App Check skipped (development or web)');
}

export { app, auth, db };
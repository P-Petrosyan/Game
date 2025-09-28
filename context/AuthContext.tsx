import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  type User,
} from 'firebase/auth';
// import * as Google from 'expo-auth-session/providers/google';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/services/firebase';

export type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  register: (params: { email: string; password: string; displayName?: string }) => Promise<User>;
  login: (params: { email: string; password: string }) => Promise<User>;
  loginWithGoogle: () => Promise<User | undefined>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [initializing, setInitializing] = useState<boolean>(true);

  // const [request, response, promptAsync] = Google.useAuthRequest({
  //   iosClientId: '344529006287-kuf2ed5q74qhfej5icucm1p94vhn4mjl.apps.googleusercontent.com',
  //   androidClientId: '344529006287-kuf2ed5q74qhfej5icucm1p94vhn4mjl.apps.googleusercontent.com',
  //   webClientId: '344529006287-kuf2ed5q74qhfej5icucm1p94vhn4mjl.apps.googleusercontent.com',
  // });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  const register = async ({ email, password, displayName }: { email: string; password: string; displayName?: string }) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }

    const profile = {
      uid: credential.user.uid,
      email: credential.user.email,
      displayName: credential.user.displayName ?? displayName ?? null,
      stats: {
        points: 0,
        level: 1,
        gamesPlayed: 0,
        wins: 0,
      },
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', credential.user.uid), profile, { merge: true });

    return credential.user;
  };

  const login = async ({ email, password }: { email: string; password: string }) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    await setDoc(
      doc(db, 'users', credential.user.uid),
      {
        email: credential.user.email,
        displayName: credential.user.displayName ?? null,
        lastLoginAt: serverTimestamp(),
      },
      { merge: true },
    );

    return credential.user;
  };

  const loginWithGoogle = async () => {
    const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    if (isWeb) {
      try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);

        // Your existing profile creation/update logic
        const profile = {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: userCredential.user.displayName,
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), profile, { merge: true });
        return userCredential.user;

      } catch (error: any) { // Type 'any' for error to handle different Firebase auth errors
        console.error("Google sign-in with popup failed:", error);
        // Handle specific errors like auth/popup-blocked, auth/popup-closed-by-user
        if (error.code === 'auth/popup-blocked') {
          alert('Popup blocked by browser. Please allow popups for this site.');
        } else if (error.code === 'auth/popup-closed-by-user') {
          console.log('Popup closed by user.');
        } else {
          throw new Error(`Google sign-in with popup failed: ${error.message}`);
        }
      }
    } else {
      throw new Error('Google sign-in not available on mobile yet');
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      register,
      login,
      loginWithGoogle,
      logout,
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/services/firebase';

export type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  register: (params: { email: string; password: string; displayName?: string }) => Promise<User>;
  login: (params: { email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [initializing, setInitializing] = useState<boolean>(true);

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

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      register,
      login,
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

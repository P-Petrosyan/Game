import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';

import { auth, db } from '@/services/firebase';

export type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  register: (params: { username: string; password: string }) => Promise<User>;
  login: (params: { username: string; password: string }) => Promise<User>;
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

  const register = async ({ username, password }: { username: string; password: string }) => {
    // Check if username already exists
    const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
    const usernameSnapshot = await getDocs(usernameQuery);
    
    if (!usernameSnapshot.empty) {
      throw new Error('Username already exists');
    }

    // Create internal email from username
    const internalEmail = `${username}@quoridor.local`;
    const credential = await createUserWithEmailAndPassword(auth, internalEmail, password);

    await updateProfile(credential.user, { displayName: username });

    const profile = {
      uid: credential.user.uid,
      username: username,
      email: internalEmail,
      displayName: username,
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

  const login = async ({ username, password }: { username: string; password: string }) => {
    // Convert username to internal email
    const internalEmail = `${username}@quoridor.local`;
    const credential = await signInWithEmailAndPassword(auth, internalEmail, password);

    await setDoc(
      doc(db, 'users', credential.user.uid),
      {
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

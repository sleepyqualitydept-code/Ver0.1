/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { checkDatabaseHealth, DatabaseHealthStatus } from '../services/databaseHealthCheck.ts';

interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  dbHealth: DatabaseHealthStatus | null;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  signOut: () => Promise<void>;
  checkHealth: () => Promise<DatabaseHealthStatus>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);
  const mountedRef = useRef(false);
  const profileRequestRef = useRef(0);

  const checkHealth = async () => {
    const health = await checkDatabaseHealth();
    if (mountedRef.current) setDbHealth(health);
    return health;
  };

  const fetchUserProfile = async (userId: string, email: string) => {
    if (!supabase) {
      if (mountedRef.current) {
        setUser(null);
        setLoading(false);
      }
      return;
    }

    const requestId = ++profileRequestRef.current;
    const applyIfCurrent = (callback: () => void) => {
      if (mountedRef.current && requestId === profileRequestRef.current) callback();
    };

    try {
      const health = await checkHealth();
      if (!health.hasCoreTables) {
        applyIfCurrent(() => setUser(null));
        return;
      }

      // profiles are created by the trusted auth.users trigger in the database.
      // The browser must not try to bypass that contract with a direct INSERT.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        console.error('[AUTH] Profile row is missing. Check the Supabase auth-profile trigger.');
        applyIfCurrent(() => setUser({
          id: userId,
          email,
          fullName: email.split('@')[0],
          role: 'Unassigned'
        }));
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) throw roleError;

      applyIfCurrent(() => setUser({
        id: userId,
        email,
        fullName: profile.full_name || email.split('@')[0],
        role: roleData?.role_name || 'Unassigned'
      }));
    } catch (err: unknown) {
      console.warn('Role resolution failed; access remains unassigned:', err);
      applyIfCurrent(() => setUser({
        id: userId,
        email,
        fullName: email.split('@')[0],
        role: 'Unassigned'
      }));
    } finally {
      applyIfCurrent(() => setLoading(false));
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let authSubscription: { unsubscribe: () => void } | undefined;

    const initializeAuth = async () => {
      try {
        await checkHealth();
        if (!mountedRef.current) return;

        if (!supabase) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mountedRef.current) return;

        setSession(data.session);
        if (data.session?.user) {
          void fetchUserProfile(data.session.user.id, data.session.user.email || '');
        } else {
          setUser(null);
          setLoading(false);
        }

        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (!mountedRef.current) return;
          setSession(nextSession);
          if (!nextSession) {
            profileRequestRef.current++;
            setUser(null);
            setLoading(false);
            return;
          }
          setLoading(true);
          // Defer Supabase queries until after the auth callback completes.
          queueMicrotask(() => {
            if (mountedRef.current) {
              void fetchUserProfile(nextSession.user.id, nextSession.user.email || '');
            }
          });
        });
        authSubscription = listener.subscription;
      } catch (error) {
        console.error('[AUTH INITIALIZATION ERROR]', error);
        if (mountedRef.current) {
          setUser(null);
          setSession(null);
          setLoading(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      mountedRef.current = false;
      profileRequestRef.current++;
      authSubscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase client is not initialized.');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Supabase client is not initialized.');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed');

      // The database trigger creates profiles from trusted Auth metadata.
      // Business role assignment remains a separate administrator-controlled operation.
      console.info('[AUTH] Account created without a business role; administrator assignment is required.');
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, dbHealth, signIn, signUp, signOut, checkHealth }}>
      {children}
    </AuthContext.Provider>
  );
};

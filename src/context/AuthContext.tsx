/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  signUp: (email: string, password: string, fullName: string, roleName: string) => Promise<any>;
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

  const checkHealth = async () => {
    const health = await checkDatabaseHealth();
    setDbHealth(health);
    return health;
  };

  const fetchUserProfile = async (userId: string, email: string) => {
    if (!supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const health = await checkHealth();
      if (!health.hasCoreTables) {
        console.warn('Database schema not deployed. Skipping profile fetch.');
        setLoading(false);
        return;
      }

      // 1. Fetch or ensure profile exists
      let { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profError && (profError.code === 'PGRST205' || profError.message?.includes('Could not find the table'))) {
        setDbHealth(prev => prev ? { ...prev, hasCoreTables: false } : null);
        setLoading(false);
        return;
      }

      if (!profile) {
        // Auto-create profile if missing
        const { data: newProf } = await supabase
          .from('profiles')
          .insert([{ id: userId, email, full_name: email.split('@')[0] }])
          .select()
          .maybeSingle();
        profile = newProf || { id: userId, email, full_name: email.split('@')[0] };
      }

      // 2. Fetch or ensure user role exists
      console.log('PROFILE', profile);
      
      let roleData = null;

      const roleResult = await supabase
        .from('user_roles')
        .select('role_name')
        .eq('user_id', userId)
        .single();

      console.log('ROLE', roleResult);
      console.log('USER ID', userId);
      console.log('EMAIL', email);

      if (roleResult.error) {
        console.error('[AUTH ROLE ERROR] No server-assigned role exists for this user.', roleResult.error);
        setUser({
          id: userId,
          email,
          fullName: profile?.full_name || email.split('@')[0],
          role: 'Unassigned'
        });
        setLoading(false);
        return;
      }

      roleData = roleResult.data;

      const userRole = roleData.role_name;

      console.log(
        '[AUTH SUCCESS]',
        {
          userId,
          email,
          role: userRole
        }
      );

      setUser({
        id: userId,
        email,
        fullName:
          profile?.full_name ||
          email.split('@')[0],
        role: userRole
      });
    } catch (err: any) {
      console.warn('Role resolution failed; access remains unassigned:', err);
      // HARDENED: Replace unsafe admin fallback with an unassigned role on failure
      setUser({
        id: userId,
        email,
        fullName: email.split('@')[0],
        role: 'Unassigned'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth().then((health) => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session?.user && health.hasCoreTables) {
          fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          setUser(null);
          setLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session?.user && health.hasCoreTables) {
          fetchUserProfile(session.user.id, session.user.email || '');
        } else {
          setUser(null);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    });
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

  const signUp = async (email: string, password: string, fullName: string, roleName: string) => {
    if (!supabase) throw new Error('Supabase client is not initialized.');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Sign up failed');

      if (dbHealth?.hasCoreTables) {
        await supabase.from('profiles').insert([{ id: data.user.id, email, full_name: fullName }]);
        // Role assignment is administrator-controlled. The client-selected role is intentionally ignored.
        console.info('[AUTH] New account created without a role. An Administrator must assign the role.');
      }

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


'use client';

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { User, StudentProfile, TeacherProfile } from '@/types';

interface AuthContextType {
  currentUser: SupabaseUser | null;
  userProfile: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (user: SupabaseUser): Promise<User | null> => {
    console.log('[AuthContext] fetchUserProfile called for user:', user.id);
    if (!supabase) {
      console.log('[AuthContext] Supabase not initialized');
      return null;
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
      return null;
    }

    if (data) {
      console.log('[AuthContext] Raw user profile data:', data);
      // Snake case to camel case conversion
      const profile: User = {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        role: data.role,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        ...(data.role === 'student' && {
          classId: data.grade_id, // grade_idをclassIdとして使用（後方互換性のため）
          gradeId: data.grade_id, // 新システム用
          schoolId: data.school_id, // 新システム用
          grade: data.grade,
          studentNumber: data.student_number,
        }),
        ...(data.role === 'teacher' && {
          managedClassIds: data.managed_class_ids || [],
          subject: data.subject,
        }),
      };
      console.log('[AuthContext] Processed user profile:', profile);
      return profile;
    }
    console.log('[AuthContext] No data returned from user_profiles');
    return null;
  }, []);

  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkUser = async () => {
      try {
        setLoading(true);
        
        // タイムアウト設定（5秒）
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('Auth check timeout - proceeding without profile');
            setLoading(false);
          }
        }, 5000);

        const { data: { session } } = await supabase.auth.getSession();

        if (isMounted) {
          clearTimeout(timeoutId);
          
          if (session?.user) {
            setCurrentUser(session.user);
            // プロフィール取得は非同期で実行（ブロックしない）
            fetchUserProfile(session.user).then(profile => {
              if (isMounted) {
                setUserProfile(profile);
              }
            }).catch(error => {
              console.warn('Failed to fetch user profile:', error);
              if (isMounted) {
                setUserProfile(null);
              }
            });
          } else {
            setCurrentUser(null);
            setUserProfile(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (isMounted) {
          clearTimeout(timeoutId);
          setCurrentUser(null);
          setUserProfile(null);
          setLoading(false);
        }
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      try {
        setLoading(true);
        
        if (session?.user) {
          setCurrentUser(session.user);
          // プロフィール取得は非同期で実行
          fetchUserProfile(session.user).then(profile => {
            if (isMounted) {
              setUserProfile(profile);
            }
          }).catch(error => {
            console.warn('Failed to fetch user profile on auth change:', error);
            if (isMounted) {
              setUserProfile(null);
            }
          });
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      } catch (error) {
        console.error('Auth state change error:', error);
        if (isMounted) {
          setCurrentUser(null);
          setUserProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase client not initialized');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      const profile = await fetchUserProfile(data.user);
      setCurrentUser(data.user);
      setUserProfile(profile);
    }
  };

  const logout = async () => {
    if (!supabase) throw new Error('Supabase client not initialized');
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUserProfile(null);
  };

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

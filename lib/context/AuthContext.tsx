
'use client';

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { clientLog } from '@/lib/utils/clientLogger';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { User, StudentProfile, TeacherProfile } from '@/types';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  currentUser: SupabaseUser | null;
  userProfile: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    profile: {
      displayName: string;
      role: 'student' | 'teacher';
      classId?: string | null;
      grade?: number | null;
      studentNumber?: string | null;
      subject?: string | null;
    }
  ) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialUserProfile?: User | null;
}

export function AuthProvider({ children, initialSession = null, initialUserProfile = null }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(initialUserProfile);
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
      .maybeSingle();

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

  const ensureUserProfileExists = useCallback(async (user: SupabaseUser) => {
    if (!supabase) return;
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (fetchErr) {
        console.warn('[AuthContext] ensureUserProfileExists: fetch error (ignored):', fetchErr);
      }
      if (existing) return;

      const md: any = user.user_metadata || {};
      const displayName = md.display_name || (user.email ? user.email.split('@')[0] : 'ユーザー');
      const role = md.role === 'teacher' ? 'teacher' : 'student';

      const { error: insertErr } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email || '',
          display_name: displayName,
          role,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      if (insertErr) {
        console.warn('[AuthContext] ensureUserProfileExists: insert/upsert error (ignored):', insertErr);
      }
    } catch (e) {
      console.warn('[AuthContext] ensureUserProfileExists: unexpected error (ignored):', e);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    // 直近プロフィールのローカルキャッシュを即座に反映（タイムアウト時の白画面回避）
    // ただし、これは一時的な表示用で、必ず最新データを再取得する
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('userProfileCache');
        if (cached) {
          const parsed = JSON.parse(cached);
          console.log('[AuthContext] Using cached profile temporarily:', parsed.id);
          setUserProfile(parsed);
        }
      }
    } catch {}

    const checkUser = async () => {
      try {
        setLoading(true);
        console.log('[AuthContext] Starting session check...');
        
        // タイムアウト設定（15秒）。超えたら refreshSession → 再試行してみる
        timeoutId = setTimeout(async () => {
          if (!isMounted) return;

          console.warn('[AuthContext] Auth check timeout (15s) - trying refreshSession');
          clientLog('[AuthContext] Timeout', null);

          try {
            const { data: refreshed, error: refreshErr } = await supabase!.auth.refreshSession();
            if (refreshed?.session) {
              console.log('[AuthContext] refreshSession succeeded, retrying getSession');
              clientLog('[AuthContext] refreshSession', { success: true });
              const { data: { session: retrySession } } = await supabase!.auth.getSession();
              if (retrySession?.user) {
                // 成功した場合は通常フローへ
                setCurrentUser(retrySession.user);
                await ensureUserProfileExists(retrySession.user);
                const profile = await fetchUserProfile(retrySession.user);
                if (profile) {
                  setUserProfile(profile);
                  try { localStorage.setItem('userProfileCache', JSON.stringify(profile)); } catch {}
                }
              }
            } else if (refreshErr) {
              console.warn('[AuthContext] refreshSession error:', refreshErr);
              clientLog('[AuthContext] refreshSession', { success: false, error: refreshErr.message });
            }
          } catch (e) {
            console.error('[AuthContext] refreshSession throw:', e);
          } finally {
            if (isMounted) setLoading(false);
          }
        }, 15000);

        // ---------- 計測開始 ----------
        if (typeof performance !== 'undefined') {
          clientLog('[AuthContext] cookies', { value: typeof document !== 'undefined' ? document.cookie : 'ssr' });
        }

        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const { data: { session }, error: sessionError } = await supabase!.auth.getSession();
        const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
        clientLog('[AuthContext] getSession', { ms: elapsed, hasSession: !!session, error: sessionError?.message });

        console.log(`[AuthContext] Session check completed in ${Math.round(elapsed)}ms`, { hasSession: !!session, error: sessionError });

        if (isMounted) {
          clearTimeout(timeoutId);
          
          if (session?.user) {
            setCurrentUser(session.user);
            // OAuth初回ログイン時など、プロフィールが未作成の可能性があるため先に作成を試行
            await ensureUserProfileExists(session.user);
            
            // プロフィール取得を同期的に待つ（データの整合性を保証）
            console.log('[AuthContext] Fetching user profile...');
            try {
              const profile = await fetchUserProfile(session.user);
              if (isMounted) {
                console.log('[AuthContext] Profile fetched successfully:', profile?.id);
                setUserProfile(profile);
                // 最新プロフィールをキャッシュに保存
                try { 
                  if (profile && typeof window !== 'undefined') {
                    localStorage.setItem('userProfileCache', JSON.stringify(profile));
                    console.log('[AuthContext] Profile cached to localStorage');
                  }
                } catch (e) {
                  console.warn('[AuthContext] Failed to cache profile:', e);
                }
              }
            } catch (error) {
              console.error('[AuthContext] Failed to fetch user profile:', error);
              if (isMounted) {
                setUserProfile(null);
                // エラー時はキャッシュもクリア
                try { if (typeof window !== 'undefined') localStorage.removeItem('userProfileCache'); } catch {}
              }
            }
          } else {
            setCurrentUser(null);
            setUserProfile(null);
            // ログアウト時はキャッシュをクリア
            try { if (typeof window !== 'undefined') localStorage.removeItem('userProfileCache'); } catch {}
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

    const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      try {
        setLoading(true);
        
        if (session?.user) {
          setCurrentUser(session.user);
          // OAuth初回ログイン時など、プロフィールが未作成の可能性があるため先に作成を試行
          await ensureUserProfileExists(session.user);
          // プロフィール取得は非同期で実行
          fetchUserProfile(session.user).then(profile => {
            if (isMounted) {
              setUserProfile(profile);
              try { if (profile && typeof window !== 'undefined') localStorage.setItem('userProfileCache', JSON.stringify(profile)); } catch {}
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
          try { if (typeof window !== 'undefined') localStorage.removeItem('userProfileCache'); } catch {}
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
      setCurrentUser(data.user);
      // 初回ログイン時にプロフィールがなければ作成
      await ensureUserProfileExists(data.user);
      const profile = await fetchUserProfile(data.user);
      setUserProfile(profile);
    }
  };

  const logout = async () => {
    if (!supabase) throw new Error('Supabase client not initialized');
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUserProfile(null);
    try { 
      if (typeof window !== 'undefined') {
        localStorage.removeItem('userProfileCache');
        localStorage.removeItem('selectedTestPeriodId');
        // 確実にログイン画面へ遷移（ルーター不調時のフォールバック）
        window.location.href = '/login';
      }
    } catch {}
  };

  const register = async (
    email: string,
    password: string,
    profile: {
      displayName: string;
      role: 'student' | 'teacher';
      classId?: string | null;
      grade?: number | null;
      studentNumber?: string | null;
      subject?: string | null;
    }
  ) => {
    if (!supabase) throw new Error('Supabase client not initialized');

    // サインアップ
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: profile.displayName,
          role: profile.role,
        },
      },
    });

    if (error) throw error;

    if (!data.user) throw new Error('Signup succeeded but user is undefined');

    // セッションがない環境（メール確認あり等）ではRLSで失敗するため、ここでのプロフィール作成はベストエフォートに留める
    try {
      const hasSession = !!data.session?.user;
      if (hasSession) {
        await supabase.from('user_profiles').upsert({
          id: data.user.id,
          email,
          display_name: profile.displayName,
          role: profile.role,
          // 後方互換: classId を grade_id に格納（現状未使用だが安全にnull可）
          grade_id: profile.role === 'student' ? (profile.classId || null) : null,
          grade: profile.role === 'student' ? (profile.grade ?? null) : null,
          student_number: profile.role === 'student' ? (profile.studentNumber || null) : null,
          subject: profile.role === 'teacher' ? (profile.subject || null) : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('[AuthContext] register: profile upsert skipped due to RLS or other error:', e);
    }

    // ログイン状態へ反映
    setCurrentUser(data.user);
    // セッションがある場合のみプロフィールを取得（ない場合は確認後の初回ログインで作成）
    if (data.session?.user) {
      await ensureUserProfileExists(data.user);
      const fetched = await fetchUserProfile(data.user);
      setUserProfile(fetched);
    } else {
      setUserProfile(null);
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    login,
    register,
    logout,
    signInWithGoogle,
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

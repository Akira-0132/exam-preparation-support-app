
'use client';

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
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
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(initialSession?.user || null);
  const [userProfile, setUserProfile] = useState<User | null>(initialUserProfile);
  // SSRでセッションがある場合は初期ローディングをfalseに
  const [loading, setLoading] = useState(!(initialSession && initialUserProfile));

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

  const authCheckedRef = React.useRef(false);
  
  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        return;
    }

    // SSRでinitialSessionとinitialUserProfileが渡されている場合
    // クライアント側でも軽量な検証を実行（セッションの整合性確認）
    if (initialSession && initialUserProfile) {
      console.log('[AuthContext] Using SSR initial session and profile, validating client session');
      setCurrentUser(initialSession.user);
      setUserProfile(initialUserProfile);
      setLoading(false);
      
      // バックグラウンドでセッションを検証（非ブロッキング）
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error && /Invalid Refresh Token|Refresh Token Not Found/i.test(error.message || '')) {
          console.warn('[AuthContext] SSR session invalidated, clearing state');
          setCurrentUser(null);
          setUserProfile(null);
          try { 
            if (typeof window !== 'undefined') {
              localStorage.removeItem('userProfileCache');
              localStorage.removeItem('dashboardDataCache');
            }
          } catch {}
        } else if (session?.user && session.user.id !== initialSession.user.id) {
          // セッションが変更されている場合は更新
          console.log('[AuthContext] Session updated, refreshing profile');
          setCurrentUser(session.user);
          fetchUserProfile(session.user).then(profile => {
            setUserProfile(profile);
          });
        }
      }).catch(() => {
        // エラーは無視（SSRデータを信頼）
      });

      // onAuthStateChange だけ購読して以降の変更を監視
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setCurrentUser(session.user);
          const profile = await fetchUserProfile(session.user);
          setUserProfile(profile);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
      });
      return () => {
        subscription.unsubscribe();
      };
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
      if (authCheckedRef.current) return; // avoid duplicate checks causing multiple timers
      authCheckedRef.current = true;
      try {
        setLoading(true);
        console.log('[AuthContext] Starting session check...');
        
        // タイムアウト設定（5秒）。ネットワーク遅延を考慮して延長
        timeoutId = setTimeout(async () => {
          if (!isMounted) return;

          console.warn('[AuthContext] Auth check timeout (5s) - trying refreshSession');
          clientLog('[AuthContext] Timeout', null);

          // タイムアウト時もキャッシュプロフィールがあればローディングを解除
          if (typeof window !== 'undefined') {
            const cachedProfile = localStorage.getItem('userProfileCache');
            if (cachedProfile) {
              try {
                const parsed = JSON.parse(cachedProfile);
                console.log('[AuthContext] Timeout but using cached profile:', parsed.id);
                setUserProfile(parsed);
                setLoading(false); // ローディングを解除
              } catch (e) {
                console.warn('[AuthContext] Failed to parse cached profile:', e);
              }
            }
          }

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
                setLoading(false);
              }
            } else if (refreshErr) {
              console.warn('[AuthContext] refreshSession error:', refreshErr);
              clientLog('[AuthContext] refreshSession', { success: false, error: refreshErr.message });
              // 無効なリフレッシュトークンの場合は強制サインアウトして復旧
              const isInvalid = /Invalid Refresh Token|Refresh Token Not Found/i.test(refreshErr.message || '');
              if (isInvalid) {
                try { await supabase!.auth.signOut(); } catch {}
                if (isMounted) {
                  setCurrentUser(null);
                  setUserProfile(null);
                  try { 
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('userProfileCache');
                      localStorage.removeItem('dashboardDataCache');
                    }
                  } catch {}
                  setLoading(false);
                }
              } else {
                // ネットワークエラーなど、リフレッシュトークンが無効でない場合はローディングを解除
                setLoading(false);
              }
            } else {
              // refreshSessionが成功しなかったが、エラーもない場合（セッションなし）
              setLoading(false);
            }
          } catch (e) {
            console.error('[AuthContext] refreshSession throw:', e);
            // エラー時もキャッシュがあればローディングを解除
            setLoading(false);
          }
        }, 5000); // 5秒に延長

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
         
          // 無効なリフレッシュトークン検出時はサインアウトして復旧
          const isInvalidRefresh = !!sessionError && /Invalid Refresh Token|Refresh Token Not Found/i.test(sessionError.message || '');
          if (!session && isInvalidRefresh) {
            try {
              console.warn('[AuthContext] Invalid refresh token detected. Signing out to recover.');
              await supabase!.auth.signOut();
            } catch {}
            setCurrentUser(null);
            setUserProfile(null);
            try { if (typeof window !== 'undefined') localStorage.removeItem('userProfileCache'); } catch {}
            setLoading(false);
            return;
          }

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
        // TOKEN_REFRESHEDイベントの失敗やSIGNED_OUTイベントを検出
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          if (!session && event === 'TOKEN_REFRESHED') {
            // トークンリフレッシュが失敗した場合（セッションがnull）
            console.warn('[AuthContext] Token refresh failed, clearing auth state');
            setCurrentUser(null);
            setUserProfile(null);
            try { 
              if (typeof window !== 'undefined') {
                localStorage.removeItem('userProfileCache');
                localStorage.removeItem('dashboardDataCache');
              }
            } catch {}
            setLoading(false);
            return;
          }
        }

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
      } catch (error: any) {
        console.error('Auth state change error:', error);
        // 無効なリフレッシュトークンのエラーを検出
        const isInvalidRefresh = error?.message && /Invalid Refresh Token|Refresh Token Not Found/i.test(error.message);
        if (isInvalidRefresh) {
          console.warn('[AuthContext] Invalid refresh token in auth state change, signing out');
          try {
            await supabase!.auth.signOut();
          } catch {}
        }
        if (isMounted) {
          setCurrentUser(null);
          setUserProfile(null);
          try { 
            if (typeof window !== 'undefined') {
              localStorage.removeItem('userProfileCache');
              localStorage.removeItem('dashboardDataCache');
            }
          } catch {}
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
    
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[AuthContext] Error during signOut:', error);
      // エラーが発生しても状態をクリアする
    }
    
    setCurrentUser(null);
    setUserProfile(null);
    
    try { 
      if (typeof window !== 'undefined') {
        localStorage.removeItem('userProfileCache');
        localStorage.removeItem('selectedTestPeriodId');
        // リダイレクトは呼び出し側で行う
      }
    } catch (error) {
      console.error('[AuthContext] Error clearing localStorage:', error);
    }
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

  // DEBUG: expose auth state
  if (typeof window !== 'undefined') {
    (window as any).currentUser = currentUser;
    (window as any).userProfile = userProfile;
  }

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

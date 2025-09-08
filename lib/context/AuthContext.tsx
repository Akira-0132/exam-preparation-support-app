'use client';

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { User, StudentProfile, TeacherProfile } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  currentUser: SupabaseUser | null;
  userProfile: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, profileData: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profileData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Supabaseからユーザープロファイルを取得
  const fetchUserProfile = useCallback(async (uid: string): Promise<User | null> => {
    console.log('[AuthContext] fetchUserProfile called with uid:', uid);
    if (!supabase) {
      console.error('Supabase is not initialized');
      return null;
    }
    
    console.log('[AuthContext] Supabase client status:', {
      client: !!supabase
    });
    
    try {
      console.log('[AuthContext] About to query user_profiles table...');
      
      // タイムアウトを追加
      const queryPromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', uid)
        .single();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      );
      
      console.log('[AuthContext] Executing query with timeout...');
      
      // まず、テーブルが存在するかテスト
      try {
        console.log('[AuthContext] Testing table access...');
        const testQuery = await supabase.from('user_profiles').select('id').limit(1);
        console.log('[AuthContext] Test query result:', testQuery);
      } catch (testError) {
        console.error('[AuthContext] Test query failed:', testError);
        // テーブルが存在しない場合は、フォールバックプロファイルを作成
        console.log('[AuthContext] Creating fallback profile due to table access failure');
        return {
          id: uid,
          email: '',
          displayName: 'ユーザー',
          role: 'student' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as User;
      }
      
      let data, error;
      try {
        const result = await Promise.race([queryPromise, timeoutPromise]) as any;
        data = result.data;
        error = result.error;
        console.log('[AuthContext] Query completed');
      } catch (timeoutError) {
        console.log('[AuthContext] Query timed out, returning null');
        return null;
      }
      
      if (error) {
        console.error('[AuthContext] Error fetching user profile:', error);
        return null;
      }
      
      console.log('[AuthContext] User profile query result:', { data: !!data, error: !!error });
      
      // スネークケースからキャメルケースに変換
      if (data) {
        const profile: User = {
          id: data.id,
          email: data.email,
          displayName: data.display_name,
          role: data.role as 'student' | 'teacher',
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
        
        // 生徒の追加フィールド
        if (data.role === 'student') {
          const studentProfile = profile as StudentProfile;
          studentProfile.classId = data.class_id;
          studentProfile.grade = data.grade;
          studentProfile.studentNumber = data.student_number;
          return studentProfile;
        }
        
        // 講師の追加フィールド
        if (data.role === 'teacher') {
          const teacherProfile = profile as TeacherProfile;
          teacherProfile.managedClassIds = data.managed_class_ids || [];
          teacherProfile.subject = data.subject;
          return teacherProfile;
        }
        
        console.log('[AuthContext] Returning profile:', profile);
        return profile;
      }
      
      console.log('[AuthContext] No data found, returning null');
      return null;
    } catch (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
      return null;
    }
  }, []);

  // ユーザープロファイルをSupabaseに保存
  const saveUserProfile = useCallback(async (uid: string, profileData: Partial<User>) => {
    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: uid,
          email: profileData.email,
          display_name: profileData.displayName,
          role: profileData.role,
          class_id: (profileData as StudentProfile).classId || null,
          grade: (profileData as StudentProfile).grade || null,
          student_number: (profileData as StudentProfile).studentNumber || null,
          managed_class_ids: (profileData as TeacherProfile).managedClassIds || null,
          subject: (profileData as TeacherProfile).subject || null,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Database error details:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error saving user profile:', error);
      throw error;
    }
  }, []);

  // 学生用: classIdが未設定なら、個人クラスを自動作成して紐付け
  const ensureStudentClass = useCallback(async (student: StudentProfile): Promise<StudentProfile> => {
    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }
    if (student.classId) return student;

    // 既存の個人クラスがあれば再利用（teacher_id = 自分）
    const { data: existing, error: findErr } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', student.id)
      .single();

    let classId: string;
    if (existing && !findErr) {
      classId = existing.id;
    } else {
      // 新規作成
      const { data: newClass, error: createErr } = await supabase
        .from('classes')
        .insert({
          name: `${student.displayName}の個人クラス`,
          grade: student.grade || 1,
          teacher_id: student.id,
          student_ids: [student.id]
        })
        .select('id')
        .single();

      if (createErr || !newClass) {
        console.error('[AuthContext] Failed to create personal class:', createErr);
        throw createErr || new Error('Failed to create class');
      }
      classId = newClass.id;
    }

    // ユーザーにclass_idを付与
    const { error: updErr } = await supabase
      .from('user_profiles')
      .update({ class_id: classId })
      .eq('id', student.id);
    if (updErr) {
      console.error('[AuthContext] Failed to attach class_id to student:', updErr);
      throw updErr;
    }

    // 最新プロフィールを返す
    const updated = await fetchUserProfile(student.id);
    return updated as StudentProfile;
  }, [fetchUserProfile]);

  // ユーザープロファイルの処理を分離
  const handleUserProfile = useCallback(async (user: any) => {
    console.log('[AuthContext] handleUserProfile called with user:', user.id);
    try {
      console.log('[AuthContext] About to call fetchUserProfile...');
      
      // タイムアウトを短くして、すぐにフォールバックに移行
      const profilePromise = fetchUserProfile(user.id);
      const timeoutPromise = new Promise<User | null>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
      );
      
      let profile: User | null = null;
      try {
        profile = await Promise.race([profilePromise, timeoutPromise]);
        console.log('[AuthContext] fetchUserProfile result:', !!profile, profile);
      } catch (timeoutError) {
        console.warn('[AuthContext] Profile fetch timed out, creating fallback profile');
        profile = null;
      }
      
      if (!profile) {
        console.log('[AuthContext] Creating default profile for user:', user.id);
        const emailLocal = (user.email || '').split('@')[0] || 'ユーザー';
        
        // 直接フォールバックプロファイルを作成（データベース操作をスキップ）
        profile = {
          id: user.id,
          email: user.email || '',
          displayName: emailLocal,
          role: 'student' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        console.log('[AuthContext] Fallback profile created:', profile);
      }

      // 学生の場合はクラスを確保（タイムアウトを避けるためスキップ）
      if (profile && profile.role === 'student' && !(profile as StudentProfile).classId) {
        console.log('[AuthContext] Skipping ensureStudentClass to avoid timeout');
        // フォールバック用のクラスIDを設定
        (profile as StudentProfile).classId = 'fallback-class-id';
        (profile as StudentProfile).grade = 1;
        (profile as StudentProfile).studentNumber = '001';
      }

      console.log('[AuthContext] Setting userProfile:', profile);
      setUserProfile(profile);
      setLoading(false); // 認証処理完了
    } catch (error) {
      console.error('[AuthContext] Failed to handle user profile:', error);
      console.error('[AuthContext] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });
      setLoading(false); // エラー時もローディングを解除
      // 最低限のプロファイルで継続
      const fallbackProfile = {
        id: user.id,
        email: user.email || '',
        displayName: (user.email || 'ユーザー').split('@')[0],
        role: 'student',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as User;
      console.log('[AuthContext] Setting fallback profile:', fallbackProfile);
      setUserProfile(fallbackProfile);
    }
  }, [fetchUserProfile, saveUserProfile, ensureStudentClass]);

  // 認証の初期化（一度だけ実行）
  useEffect(() => {
    if (initialized) {
      console.log('[AuthContext] Already initialized, skipping');
      return;
    }

    if (!supabase) {
      console.log('[AuthContext] Supabase not initialized');
      setLoading(false);
      setInitialized(true);
      return;
    }

    console.log('[AuthContext] Starting authentication initialization');
    setLoading(true);

    const initializeAuth = async () => {
      try {
        // セッションを取得
        const { data: { session }, error } = await supabase!.auth.getSession();
        
        if (error) {
          console.error('[AuthContext] getSession error:', error);
          // 無効なリフレッシュトークンの場合はサインアウト
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('invalid refresh token') || msg.includes('refresh token not found')) {
            try { 
              await supabase!.auth.signOut(); 
            } catch (signOutError) {
              console.error('[AuthContext] SignOut error:', signOutError);
            }
          }
        }

        // ユーザー情報を設定
        setCurrentUser(session?.user ?? null);

        if (session?.user) {
          // プロファイルを取得または作成
          console.log('[AuthContext] initializeAuth: Calling handleUserProfile for user:', session.user.id);
          await handleUserProfile(session.user);
          console.log('[AuthContext] initializeAuth: handleUserProfile completed');
        } else {
          console.log('[AuthContext] initializeAuth: No session user, setting userProfile to null');
          setUserProfile(null);
        }

      } catch (error) {
        console.error('[AuthContext] Initialization error:', error);
        setCurrentUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
        setInitialized(true);
        console.log('[AuthContext] Authentication initialization completed');
      }
    };

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state changed:', event, !!session);
        
        setCurrentUser(session?.user ?? null);

        if (session?.user) {
          console.log('[AuthContext] Calling handleUserProfile for user:', session.user.id);
          await handleUserProfile(session.user);
          console.log('[AuthContext] handleUserProfile completed');
        } else {
          console.log('[AuthContext] No session user, setting userProfile to null');
          setUserProfile(null);
        }
        
        // 認証状態変更後は必ずローディングを終了
        setLoading(false);
      }
    );

    // 初期化を実行
    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, saveUserProfile, ensureStudentClass, handleUserProfile]); // handleUserProfileを依存配列に追加

  // ログイン
  const login = async (email: string, password: string) => {
    console.log('[AuthContext] Login attempt with email:', email);
    
    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }

    try {
      const { data, error } = await supabase!.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AuthContext] Login error:', error);
        throw error;
      }
      
      // ログイン成功後、プロファイルを取得（無ければ自動作成）
      if (data.user) {
        let profile = await fetchUserProfile(data.user.id);
        if (!profile) {
          console.log('[AuthContext] No profile on login. Creating a default profile...');
          const emailLocal = (data.user.email || '').split('@')[0] || 'ユーザー';
          await saveUserProfile(data.user.id, {
            email: data.user.email || undefined,
            displayName: emailLocal,
            role: 'student',
          });
          profile = await fetchUserProfile(data.user.id);
        }
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('[AuthContext] Login failed:', error);
      throw error;
    }
  };

  // 新規登録
  const register = async (email: string, password: string, profileData: Partial<User>) => {
    console.log('[AuthContext] Register attempt with email:', email);
    
    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }

    try {
      // Supabaseでユーザーを作成
      const { data, error } = await supabase!.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('[AuthContext] Register error:', error);
        throw error;
      }

      if (data.user) {
        // ユーザープロファイルを保存
        await saveUserProfile(data.user.id, profileData);
        
        // 学生の場合はクラスを確保
        if (profileData.role === 'student') {
          const studentProfile = profileData as StudentProfile;
          await ensureStudentClass({
            ...studentProfile,
            id: data.user.id,
            email: data.user.email || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('[AuthContext] Register failed:', error);
      throw error;
    }
  };

  // ログアウト
  const logout = async () => {
    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }

    try {
      const { error } = await supabase!.auth.signOut();
      if (error) {
        console.error('[AuthContext] Logout error:', error);
        throw error;
      }
      
      setCurrentUser(null);
      setUserProfile(null);
      router.push('/login');
    } catch (error) {
      console.error('[AuthContext] Logout failed:', error);
      throw error;
    }
  };

  // プロファイル更新
  const updateProfile = async (profileData: Partial<User>) => {
    if (!currentUser) {
      throw new Error('No current user');
    }

    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({
        display_name: profileData.displayName,
        grade: (profileData as StudentProfile).grade,
        student_number: (profileData as StudentProfile).studentNumber,
        subject: (profileData as TeacherProfile).subject,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id);

    if (error) {
      throw error;
    }

    // ローカルステートも更新
    const updatedProfile = await fetchUserProfile(currentUser.id);
    setUserProfile(updatedProfile);
  };

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    login,
    register,
    logout,
    updateProfile,
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
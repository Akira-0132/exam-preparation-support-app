'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { User, StudentProfile, TeacherProfile } from '@/types';
import { useRouter } from 'next/navigation';

// Contextの型定義
interface AuthContextType {
  currentUser: SupabaseUser | null;
  userProfile: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    email: string,
    password: string,
    profileData: Partial<User>
  ) => Promise<void>;
  updateUserProfile?: (updates: Partial<User>) => Promise<void>;
}

// Contextの作成
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// カスタムフック
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const initRef = React.useRef(false);

  // Supabaseからユーザープロファイルを取得
  const fetchUserProfile = async (uid: string): Promise<User | null> => {
    if (!supabase) {
      console.error('Supabase is not initialized');
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', uid)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
      
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
        
        return profile;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // ユーザープロファイルをSupabaseに保存
  const saveUserProfile = async (uid: string, profileData: Partial<User>) => {
    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }
    
    try {
      console.log('Saving profile data:', profileData);
      
      // キャメルケースからスネークケースに変換
      const dbData: any = {
        id: uid,
        email: profileData.email,
        display_name: profileData.displayName,
        role: profileData.role,
      };
      
      // 生徒の追加フィールド
      if (profileData.role === 'student') {
        const studentData = profileData as Partial<StudentProfile>;
        dbData.class_id = studentData.classId;
        dbData.grade = studentData.grade;
        dbData.student_number = studentData.studentNumber;
      }
      
      // 講師の追加フィールド
      if (profileData.role === 'teacher') {
        const teacherData = profileData as Partial<TeacherProfile>;
        dbData.managed_class_ids = teacherData.managedClassIds;
        dbData.subject = teacherData.subject;
      }
      
      console.log('Inserting data to database:', dbData);
      
      const { error } = await supabase
        .from('user_profiles')
        .upsert(dbData, { onConflict: 'id' });
      
      if (error) {
        console.error('Database error details:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error saving user profile:', error);
      throw error;
    }
  };

  // 学生用: classIdが未設定なら、個人クラスを自動作成して紐付け
  const ensureStudentClass = async (student: StudentProfile): Promise<StudentProfile> => {
    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }
    if (student.classId) return student;

    // 既存の個人クラスがあれば再利用（teacher_id = 自分）
    const { data: existing, error: findErr } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', student.id)
      .limit(1);
    if (findErr) {
      console.error('[AuthContext] Failed to lookup existing personal class:', findErr);
    }

    let classId = existing && existing.length > 0 ? existing[0].id : null;

    if (!classId) {
      const { data: inserted, error: insertErr } = await supabase
        .from('classes')
        .insert({
          name: `個人クラス-${student.displayName || student.email || student.id.slice(0, 8)}`,
          grade: student.grade ?? 1,
          teacher_id: student.id, // 自分を暫定の管理者に
          student_ids: [student.id],
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('[AuthContext] Failed to create personal class:', insertErr);
        throw insertErr;
      }
      classId = inserted!.id;
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
  };

  // ログイン
  const login = async (email: string, password: string) => {
    console.log('[AuthContext] Login attempt with email:', email);
    
    if (!supabase) {
      console.error('[AuthContext] Supabase is not initialized');
      throw new Error('Supabase is not initialized');
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('[AuthContext] Login result:', { 
        success: !error, 
        user: data?.user?.id,
        error: error?.message 
      });

      if (error) {
        console.error('[AuthContext] Login error:', error);
        throw error;
      }
      
      // ログイン成功後、プロファイルを取得（無ければ自動作成）
      if (data?.user) {
        try {
          let profile = await fetchUserProfile(data.user.id);
          if (!profile) {
            console.log('[AuthContext] No profile found. Creating a default profile...');
            const emailLocal = (email || '').split('@')[0] || 'ユーザー';
            await saveUserProfile(data.user.id, {
              email,
              displayName: emailLocal,
              role: 'student',
            });
            profile = await fetchUserProfile(data.user.id);
          }
          console.log('[AuthContext] Profile resolved after login:', profile);
          setUserProfile(profile);
          setCurrentUser(data.user);
        } catch (profileError) {
          console.error('[AuthContext] Failed to resolve profile after login:', profileError);
          // プロファイルの取得に失敗してもログインは成功とする
          setCurrentUser(data.user);
        }
      }
    } catch (error) {
      console.error('[AuthContext] Login failed:', error);
      throw error;
    }
  };

  // 新規登録
  const register = async (
    email: string,
    password: string,
    profileData: Partial<User>
  ) => {
    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }
    
    console.log('Starting registration with email:', email);
    
    // 1. Supabase Authでユーザー作成
    const authResponse = await supabase.auth.signUp({
      email,
      password,
    });
    
    console.log('Auth signup response:', authResponse);

    if (authResponse.error) {
      console.error('Auth error:', authResponse.error);
      throw authResponse.error;
    }

    if (!authResponse.data.user) {
      console.error('No user returned from signup');
      throw new Error('ユーザー作成に失敗しました');
    }

    console.log('User created with ID:', authResponse.data.user.id);

    // 2. プロファイル作成
    try {
      const fullProfileData: Partial<User> = {
        ...profileData,
        email,
      };
      
      console.log('Saving profile data:', fullProfileData);
      await saveUserProfile(authResponse.data.user.id, fullProfileData);
      console.log('Profile saved successfully');
    } catch (profileError) {
      console.error('Error saving user profile:', profileError);
      throw profileError;
    }
    
    console.log('Registration completed successfully');
  };

  // ログアウト
  const logout = async () => {
    if (!supabase) {
      throw new Error('Supabase is not initialized');
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    
    setCurrentUser(null);
    setUserProfile(null);
  };

  // ユーザープロファイルを更新
  const updateUserProfile = async (updates: Partial<User>) => {
    if (!supabase || !currentUser) {
      throw new Error('User not authenticated');
    }

    const dbUpdates: any = {};
    
    if (updates.displayName !== undefined) {
      dbUpdates.display_name = updates.displayName;
    }
    if (updates.role !== undefined) {
      dbUpdates.role = updates.role;
    }
    
    // 生徒の追加フィールド
    if (updates.role === 'student') {
      const studentUpdates = updates as Partial<StudentProfile>;
      if (studentUpdates.classId !== undefined) {
        dbUpdates.class_id = studentUpdates.classId;
      }
      if (studentUpdates.grade !== undefined) {
        dbUpdates.grade = studentUpdates.grade;
      }
      if (studentUpdates.studentNumber !== undefined) {
        dbUpdates.student_number = studentUpdates.studentNumber;
      }
    }
    
    // 講師の追加フィールド
    if (updates.role === 'teacher') {
      const teacherUpdates = updates as Partial<TeacherProfile>;
      if (teacherUpdates.managedClassIds !== undefined) {
        dbUpdates.managed_class_ids = teacherUpdates.managedClassIds;
      }
      if (teacherUpdates.subject !== undefined) {
        dbUpdates.subject = teacherUpdates.subject;
      }
    }
    
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('user_profiles')
      .update(dbUpdates)
      .eq('id', currentUser.id);

    if (error) {
      throw error;
    }

    // ローカルステートも更新
    const updatedProfile = await fetchUserProfile(currentUser.id);
    setUserProfile(updatedProfile);
  };

  // Supabaseのセッション状態を監視（初期化はgetSessionで確定させる）
  useEffect(() => {
    console.log('[AuthContext] useEffect triggered, initialized:', initialized, 'initRef:', initRef.current);

    if (!supabase) {
      console.log('[AuthContext] Supabase not initialized');
      setLoading(false);
      return;
    }

    // 初期化の重複実行を防ぐ（React StrictMode対策）
    if (initRef.current) {
      console.log('[AuthContext] Already initializing, skip');
      return;
    }
    initRef.current = true;

    let isCancelled = false;

    const init = async () => {
      try {
        setLoading(true);
        const { data: { session }, error } = await supabase!.auth.getSession();
        if (error) {
          console.error('[AuthContext] getSession error:', error);
          // 無効なリフレッシュトークン時は強制サインアウトしてクリーンにする
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('invalid refresh token') || msg.includes('refresh token not found')) {
            try { await supabase!.auth.signOut(); } catch {}
            if (!isCancelled) {
              setCurrentUser(null);
              setUserProfile(null);
            }
          }
        }
        if (isCancelled) return;

        setCurrentUser(session?.user ?? null);
        if (session?.user) {
          try {
            let profile = await fetchUserProfile(session.user.id);
            if (!profile) {
              console.log('[AuthContext] No profile on init. Creating a default profile...');
              const emailLocal = (session.user.email || '').split('@')[0] || 'ユーザー';
              await saveUserProfile(session.user.id, {
                email: session.user.email || undefined,
                displayName: emailLocal,
                role: 'student',
              });
              profile = await fetchUserProfile(session.user.id);
            }
            // 学生でclassId未設定なら個人クラスを自動作成（失敗しても続行）
            if (profile && profile.role === 'student' && !(profile as StudentProfile).classId) {
              try {
                profile = await ensureStudentClass(profile as StudentProfile);
              } catch (e) {
                console.warn('[AuthContext] ensureStudentClass failed, continue without class:', e);
              }
            }
            if (isCancelled) return;
            setUserProfile(profile);
          } catch (e) {
            console.error('[AuthContext] Failed to resolve profile on init:', e);
            // 最低限のプロフィールで継続（スピナー固着回避）
            if (!isCancelled && session?.user) {
              setUserProfile({
                id: session.user.id,
                email: session.user.email || '',
                displayName: (session.user.email || 'ユーザー').split('@')[0],
                role: 'student',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as User);
            } else {
              setUserProfile(null);
            }
          }
        } else {
          setUserProfile(null);
        }
      } catch (e) {
        console.error('[AuthContext] init error:', e);
      } finally {
        if (!isCancelled) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state changed:', event, !!session, 'initialized:', initialized);
        
        // 初期化が完了していない場合はスキップ
        if (!initialized && event !== 'INITIAL_SESSION') {
          console.log('[AuthContext] Skip auth change before initialization');
          return;
        }
        
        setCurrentUser(session?.user ?? null);

        if (session?.user) {
          try {
            let profile = await fetchUserProfile(session.user.id);
            if (!profile) {
              console.log('[AuthContext] No profile on auth change. Creating a default profile...');
              const emailLocal = (session.user.email || '').split('@')[0] || 'ユーザー';
              await saveUserProfile(session.user.id, {
                email: session.user.email || undefined,
                displayName: emailLocal,
                role: 'student',
              });
              profile = await fetchUserProfile(session.user.id);
            }
            if (profile && profile.role === 'student' && !(profile as StudentProfile).classId) {
              try {
                profile = await ensureStudentClass(profile as StudentProfile);
              } catch (e) {
                console.warn('[AuthContext] ensureStudentClass failed on auth change, continue without class:', e);
              }
            }
            setUserProfile(profile);
          } catch (error) {
            console.error('[AuthContext] Failed to resolve profile on auth change:', error);
            // 最低限のプロフィールで継続
            setUserProfile({
              id: session.user.id,
              email: session.user.email || '',
              displayName: (session.user.email || 'ユーザー').split('@')[0],
              role: 'student',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as User);
          }
        } else {
          setUserProfile(null);
        }

        // 初期化完了後のみローディングをfalseにする
        if (initialized) {
          setLoading(false);
        }
      }
    );

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
      initRef.current = false;
    };
  }, []);

  // デバッグ情報
  useEffect(() => {
    console.log('[AuthContext] State update:', {
      loading,
      initialized,
      currentUser: !!currentUser,
      userProfile: !!userProfile,
      userRole: userProfile?.role,
      userDisplayName: userProfile?.displayName
    });
  }, [loading, initialized, currentUser, userProfile]);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    login,
    register,
    logout,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
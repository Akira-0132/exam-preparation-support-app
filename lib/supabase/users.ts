import { supabase } from '@/lib/supabase';
import { User, StudentProfile, TeacherProfile } from '@/types';

// ユーザー作成
export async function createUser(
  userId: string,
  userData: Partial<User> & Partial<StudentProfile> & Partial<TeacherProfile>
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const payload: any = {
    id: userId,
    email: userData.email,
    display_name: userData.displayName,
    role: userData.role,
    class_id: userData.classId,
    grade: userData.grade,
    student_number: userData.studentNumber,
    managed_class_ids: userData.managedClassIds || [],
    subject: userData.subject,
  };

  const { error } = await supabase.from('user_profiles').insert(payload);

  if (error) {
    throw error;
  }
}

// ユーザー取得
export async function getUser(userId: string): Promise<User | null> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Not found
      return null;
    }
    throw error;
  }

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    classId: data.class_id,
    grade: data.grade,
    studentNumber: data.student_number,
    managedClassIds: data.managed_class_ids || [],
    subject: data.subject,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } as User;
}

// ユーザー更新
export async function updateUser(
  userId: string,
  updates: Partial<User> & Partial<StudentProfile> & Partial<TeacherProfile>
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const updateData: any = {};
  
  if (updates.email) updateData.email = updates.email;
  if (updates.displayName) updateData.display_name = updates.displayName;
  if (updates.role) updateData.role = updates.role;
  if (updates.classId) updateData.class_id = updates.classId;
  if (updates.grade) updateData.grade = updates.grade;
  if (updates.studentNumber) updateData.student_number = updates.studentNumber;
  if (updates.managedClassIds) updateData.managed_class_ids = updates.managedClassIds;
  if (updates.subject) updateData.subject = updates.subject;

  const { error } = await supabase
    .from('user_profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

// ユーザー削除
export async function deleteUser(userId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

// クラスの生徒一覧取得
export async function getStudentsByClassId(classId: string): Promise<StudentProfile[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('role', 'student')
    .eq('class_id', classId)
    .order('student_number');

  if (error) {
    throw error;
  }

  return data.map(item => ({
    id: item.id,
    email: item.email,
    displayName: item.display_name,
    role: 'student' as const,
    classId: item.class_id,
    grade: item.grade,
    studentNumber: item.student_number,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  })) as StudentProfile[];
}

// 講師一覧取得
export async function getTeachers(): Promise<TeacherProfile[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('role', 'teacher')
    .order('display_name');

  if (error) {
    throw error;
  }

  return data.map(item => ({
    id: item.id,
    email: item.email,
    displayName: item.display_name,
    role: 'teacher' as const,
    managedClassIds: item.managed_class_ids || [],
    subject: item.subject,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  })) as TeacherProfile[];
}

// メールアドレスでユーザー検索
export async function getUserByEmail(email: string): Promise<User | null> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Not found
      return null;
    }
    throw error;
  }

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    classId: data.class_id,
    grade: data.grade,
    studentNumber: data.student_number,
    managedClassIds: data.managed_class_ids || [],
    subject: data.subject,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } as User;
}

// 生徒番号でユーザー検索
export async function getStudentByStudentNumber(studentNumber: string): Promise<StudentProfile | null> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('role', 'student')
    .eq('student_number', studentNumber)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Not found
      return null;
    }
    throw error;
  }

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: 'student' as const,
    classId: data.class_id,
    grade: data.grade,
    studentNumber: data.student_number,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } as StudentProfile;
}

// 講師IDに紐づく生徒一覧を取得
export async function getStudentsByTeacherId(teacherId: string): Promise<User[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // ここでは仮に、同じ学校に所属する生徒を返すロジックとします
  // 本来は teacher_manages_students のような中間テーブルを介して取得するのが望ましい
  const { data: teacherProfile, error: teacherError } = await supabase
    .from('user_profiles')
    .select('school_id')
    .eq('id', teacherId)
    .single();

  if (teacherError || !teacherProfile?.school_id) {
    console.error('Error fetching teacher school or school_id not set:', teacherError);
    return [];
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('school_id', teacherProfile.school_id)
    .eq('role', 'student');

  if (error) {
    console.error('Error fetching students by teacher:', error);
    return [];
  }

  return data as User[];
}
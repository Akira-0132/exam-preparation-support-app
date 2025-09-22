import supabase from '@/lib/supabase';

export type ClassItem = {
  id: string;
  name: string;
  grade: number | null;
  teacher_id: string | null;
  student_ids: string[] | null;
};

export async function createClass(name: string, grade: number, teacherId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase client is not initialized');
  const { data, error } = await supabase
    .from('classes')
    .insert({ name, grade, teacher_id: teacherId })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id as string;
}

export async function fetchAllClasses(): Promise<ClassItem[]> {
  if (!supabase) throw new Error('Supabase client is not initialized');
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, grade, teacher_id, student_ids')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchClassesForTeacher(teacherId: string, managedIds: string[]): Promise<ClassItem[]> {
  console.log('[DEBUG] fetchClassesForTeacher called with:', { teacherId, managedIds });

  if (!supabase) {
    console.error('[DEBUG] Supabase client is not initialized');
    throw new Error('Supabase client is not initialized');
  }

  // teacher 担任 or managed クラスのみ取得（RLSに優しい最小クエリ）
  const conditions: string[] = [];
  if (teacherId) conditions.push(`teacher_id.eq.${teacherId}`);
  if (managedIds && managedIds.length > 0) conditions.push(`id.in.(${managedIds.join(',')})`);
  
  console.log('[DEBUG] Constructed conditions:', conditions);

  if (conditions.length === 0) {
    console.log('[DEBUG] No conditions provided, returning empty array.');
    return [];
  }

  const { data, error } = await supabase
    .from('classes')
    .select('id, name, grade, teacher_id, student_ids')
    .or(conditions.join(','));

  console.log('[DEBUG] Supabase query result:', { data, error });

  if (error) {
    console.error('[DEBUG] Error from Supabase:', error);
    throw error;
  }

  console.log(`[DEBUG] fetchClassesForTeacher returning ${data?.length ?? 0} items.`);
  return data ?? [];
}

export async function setHomeroomTeacher(classId: string, teacherId: string | null): Promise<void> {
  if (!supabase) throw new Error('Supabase client is not initialized');
  const { error } = await supabase
    .from('classes')
    .update({ teacher_id: teacherId })
    .eq('id', classId);
  if (error) throw error;
}

export async function addManagedClass(userId: string, classId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase client is not initialized');
  const { data, error } = await supabase
    .from('user_profiles')
    .select('managed_class_ids')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const current: string[] = Array.isArray(data?.managed_class_ids) ? data!.managed_class_ids : [];
  if (current.includes(classId)) return;
  const updated = [...current, classId];
  const { error: upErr } = await supabase
    .from('user_profiles')
    .update({ managed_class_ids: updated })
    .eq('id', userId);
  if (upErr) throw upErr;
}

export async function removeManagedClass(userId: string, classId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase client is not initialized');
  const { data, error } = await supabase
    .from('user_profiles')
    .select('managed_class_ids')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const current: string[] = Array.isArray(data?.managed_class_ids) ? data!.managed_class_ids : [];
  const updated = current.filter((id) => id !== classId);
  const { error: upErr } = await supabase
    .from('user_profiles')
    .update({ managed_class_ids: updated })
    .eq('id', userId);
  if (upErr) throw upErr;
}

export function getSuggestedTitle(semester: 'first'|'second'|'third', testType: 'midterm'|'final'|'other', custom?: string) {
  const semesterLabel = semester === 'first' ? '1学期' : semester === 'second' ? '2学期' : '3学期';
  const typeLabel = testType === 'midterm' ? '中間' : testType === 'final' ? '期末' : (custom || 'その他');
  return `${semesterLabel} ${typeLabel}テスト`;
}



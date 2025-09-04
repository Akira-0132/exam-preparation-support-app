import { supabase } from '@/lib/supabase';
import { TestPeriod } from '@/types';

const isValidUuid = (value?: string): boolean => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

// テスト期間作成
export async function createTestPeriod(testPeriodData: Omit<TestPeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // Convert dates to ISO strings
  const startDateStr = ((): string => {
    const v: any = testPeriodData.startDate as any;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof v.toISOString === 'function') return v.toISOString();
    return String(v);
  })();
  const endDateStr = ((): string => {
    const v: any = testPeriodData.endDate as any;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof v.toISOString === 'function') return v.toISOString();
    return String(v);
  })();

  console.log('Creating test period with data:', {
    title: testPeriodData.title,
    start_date: startDateStr,
    end_date: endDateStr,
    class_id: testPeriodData.classId,
    subjects: testPeriodData.subjects,
    created_by: testPeriodData.createdBy,
  });

  // 前提チェック: class_id が有効なUUIDであること
  if (!isValidUuid(testPeriodData.classId)) {
    console.error('[createTestPeriod] Invalid class_id format:', testPeriodData.classId);
    throw new Error('クラスIDが正しい形式ではありません。');
  }

  // クラスの存在確認
  const { data: classRow, error: classErr } = await supabase
    .from('classes')
    .select('id')
    .eq('id', testPeriodData.classId)
    .single();

  if (classErr || !classRow) {
    console.error('[createTestPeriod] Class not found:', testPeriodData.classId, classErr);
    throw new Error('指定されたクラスが見つかりません。');
  }

  const { data, error } = await supabase
    .from('test_periods')
    .insert({
      title: testPeriodData.title,
      start_date: startDateStr,
      end_date: endDateStr,
      class_id: testPeriodData.classId,
      subjects: testPeriodData.subjects,
      created_by: testPeriodData.createdBy,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating test period:', error);
    throw error;
  }

  console.log('Test period created successfully with ID:', data.id);
  return data.id;
}

// テスト期間取得
export async function getTestPeriod(testPeriodId: string): Promise<TestPeriod | null> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('test_periods')
    .select('*')
    .eq('id', testPeriodId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Not found
      return null;
    }
    throw error;
  }

  return {
    id: data.id,
    title: data.title,
    startDate: data.start_date,
    endDate: data.end_date,
    classId: data.class_id,
    subjects: data.subjects,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } as TestPeriod;
}

// テスト期間更新
export async function updateTestPeriod(testPeriodId: string, updates: Partial<Omit<TestPeriod, 'id' | 'createdAt'>>): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const updateData: any = {};
  
  if (updates.title) updateData.title = updates.title;
  if (updates.startDate) updateData.start_date = updates.startDate;
  if (updates.endDate) updateData.end_date = updates.endDate;
  if (updates.classId) updateData.class_id = updates.classId;
  if (updates.subjects) updateData.subjects = updates.subjects;
  if (updates.createdBy) updateData.created_by = updates.createdBy;

  const { error } = await supabase
    .from('test_periods')
    .update(updateData)
    .eq('id', testPeriodId);

  if (error) {
    throw error;
  }
}

// テスト期間削除
export async function deleteTestPeriod(testPeriodId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { error } = await supabase
    .from('test_periods')
    .delete()
    .eq('id', testPeriodId);

  if (error) {
    throw error;
  }
}

// クラス別テスト期間一覧取得
export async function getTestPeriodsByClassId(classId: string): Promise<TestPeriod[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  console.log('[getTestPeriodsByClassId] Fetching test periods for classId:', classId);

  // 有効なUUIDでない場合は空配列を返す
  if (!isValidUuid(classId)) {
    console.warn('[getTestPeriodsByClassId] Invalid class_id format:', classId, '- returning empty array');
    return [];
  }

  const { data, error } = await supabase
    .from('test_periods')
    .select('*')
    .eq('class_id', classId)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('[getTestPeriodsByClassId] Error:', error);
    throw error;
  }

  console.log('[getTestPeriodsByClassId] Found', data?.length || 0, 'test periods');
  if (data && data.length > 0) {
    console.log('[getTestPeriodsByClassId] First period:', {
      id: data[0].id,
      title: data[0].title,
      class_id: data[0].class_id
    });
  }

  if (!data) return [];

  return data.map(item => ({
    id: item.id,
    title: item.title,
    startDate: item.start_date,
    endDate: item.end_date,
    classId: item.class_id,
    subjects: item.subjects,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  })) as TestPeriod[];
}

// 現在進行中のテスト期間取得
export async function getCurrentTestPeriod(classId: string): Promise<TestPeriod | null> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // 有効なUUIDでない場合はnullを返す
  if (!isValidUuid(classId)) {
    console.warn('[getCurrentTestPeriod] Invalid class_id format:', classId);
    return null;
  }

  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('test_periods')
    .select('*')
    .eq('class_id', classId)
    .lte('start_date', now)
    .gte('end_date', now)
    .order('start_date', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  if (data.length === 0) {
    return null;
  }

  const item = data[0];
  return {
    id: item.id,
    title: item.title,
    startDate: item.start_date,
    endDate: item.end_date,
    classId: item.class_id,
    subjects: item.subjects,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  } as TestPeriod;
}

// 次のテスト期間取得
export async function getUpcomingTestPeriod(classId: string): Promise<TestPeriod | null> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('test_periods')
    .select('*')
    .eq('class_id', classId)
    .gt('start_date', now)
    .order('start_date', { ascending: true })
    .limit(1);

  if (error) {
    throw error;
  }

  if (data.length === 0) {
    return null;
  }

  const item = data[0];
  return {
    id: item.id,
    title: item.title,
    startDate: item.start_date,
    endDate: item.end_date,
    classId: item.class_id,
    subjects: item.subjects,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  } as TestPeriod;
}

// 講師が作成したテスト期間一覧取得
export async function getTestPeriodsByTeacherId(teacherId: string): Promise<TestPeriod[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('test_periods')
    .select('*')
    .eq('created_by', teacherId)
    .order('start_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(item => ({
    id: item.id,
    title: item.title,
    startDate: item.start_date,
    endDate: item.end_date,
    classId: item.class_id,
    subjects: item.subjects,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  })) as TestPeriod[];
}
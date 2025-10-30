import { supabase } from '@/lib/supabase';
import { TestPeriod } from '@/types';

const isValidUuid = (value?: string): boolean => {
  if (!value) return false;
  // UUID v1-v5の形式を許可（バージョン0も許可）
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  // Creating test period

  // 前提チェック: class_id が有効なUUIDであること（学年IDとして使用）
  if (!isValidUuid(testPeriodData.classId)) {
    console.warn('[createTestPeriod] Invalid class_id format:', testPeriodData.classId, '- but continuing anyway for debugging');
    // throw new Error('学年IDが正しい形式ではありません。'); // 一時的にコメントアウト
  }

  // 学年の存在確認（クラスシステムの代わりに学年システムを使用）
  console.log('[createTestPeriod] Checking grade existence for classId:', testPeriodData.classId);
  
  const { data: gradeRow, error: gradeErr } = await supabase
    .from('grades')
    .select('id')
    .eq('id', testPeriodData.classId)
    .single();

  if (gradeErr || !gradeRow) {
    console.error('[createTestPeriod] Grade not found:', testPeriodData.classId, gradeErr);
    throw new Error('指定された学年が見つかりません。');
  }
  
  console.log('[createTestPeriod] Grade found:', gradeRow);

  const insertData = {
    title: testPeriodData.title,
    start_date: startDateStr,
    end_date: endDateStr,
    grade_id: testPeriodData.classId, // 学年システム用
    subjects: testPeriodData.subjects,
    created_by: testPeriodData.createdBy,
  };
  
  console.log('[createTestPeriod] Inserting test period with data:', insertData);
  
  const { data, error } = await supabase
    .from('test_periods')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    console.error('[createTestPeriod] Error creating test period:', error);
    throw error;
  }
  
  console.log('[createTestPeriod] Test period created successfully with ID:', data.id);

  // Test period created successfully
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
    classId: data.grade_id,
    subjects: data.subjects,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    deletedAt: data.deleted_at,
    deletedBy: data.deleted_by,
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
  if (updates.classId) updateData.grade_id = updates.classId;
  if (updates.subjects) updateData.subjects = updates.subjects;
  if (updates.createdBy) updateData.created_by = updates.createdBy;
  if (updates.deletedAt !== undefined) updateData.deleted_at = updates.deletedAt;
  if (updates.deletedBy !== undefined) updateData.deleted_by = updates.deletedBy;

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

// ソフトデリート（削除扱いだがデータ保持）
export async function softDeleteTestPeriod(testPeriodId: string, deletedByUserId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not initialized');
  
  console.log('[softDeleteTestPeriod] Deleting test period:', testPeriodId, 'by user:', deletedByUserId);
  
  const { error } = await supabase
    .from('test_periods')
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedByUserId })
    .eq('id', testPeriodId);
    
  if (error) {
    console.error('[softDeleteTestPeriod] Error:', error);
    throw error;
  }
  
  console.log('[softDeleteTestPeriod] Successfully soft deleted test period:', testPeriodId);
}

// 復元
export async function restoreTestPeriod(testPeriodId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not initialized');
  const { error } = await supabase
    .from('test_periods')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', testPeriodId);
  if (error) throw error;
}

// 削除済み一覧（管理者向け）
export async function listDeletedTestPeriods(classId?: string): Promise<TestPeriod[]> {
  if (!supabase) throw new Error('Supabase is not initialized');
  let query = supabase.from('test_periods').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
  if (classId) query = query.eq('grade_id', classId);
  const { data, error } = await query as any;
  if (error) throw error;
  return (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    startDate: item.start_date,
    endDate: item.end_date,
    classId: item.grade_id,
    subjects: item.subjects,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    deletedAt: item.deleted_at,
    deletedBy: item.deleted_by,
  }));
}

// 完全削除（注意: 外部キー整合性に配慮し、事前にタスク移行または削除を実施）
export async function hardDeleteTestPeriod(testPeriodId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not initialized');
  const { error } = await supabase
    .from('test_periods')
    .delete()
    .eq('id', testPeriodId);
  if (error) throw error;
}

// 学年別テスト期間一覧取得（クラスシステムの代わりに学年システムを使用）
export async function getTestPeriodsByClassId(gradeId: string): Promise<TestPeriod[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  console.log('[getTestPeriodsByClassId] Received gradeId:', gradeId, 'Type:', typeof gradeId);

  // Fetching test periods for grade

  // 有効なUUIDでない場合は空配列を返す
  if (!isValidUuid(gradeId)) {
    console.warn('[getTestPeriodsByClassId] Invalid grade_id format:', gradeId, '- returning empty array');
    return [];
  }

  // 学年IDでテスト期間を取得（新しいシステム）
  const { data, error } = await supabase
    .from('test_periods')
    .select('*')
    .eq('grade_id', gradeId)
    .is('deleted_at', null)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('[getTestPeriodsByClassId] Error:', error);
    throw error;
  }

  // Test periods retrieved successfully

  if (!data) return [];

  return data.map(item => ({
    id: item.id,
    title: item.title,
    startDate: item.start_date,
    endDate: item.end_date,
    classId: item.grade_id, // 学年IDを使用
    subjects: item.subjects,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  })) as TestPeriod[];
}

// 学年番号（1/2/3）でテスト期間一覧を取得
export async function getTestPeriodsByGradeNumber(gradeNumber: number): Promise<TestPeriod[]> {
  if (!supabase) throw new Error('Supabase is not initialized');

  // 対象学年のgrade_idを取得
  const { data: grades, error: gErr } = await supabase
    .from('grades')
    .select('id')
    .eq('grade_number', gradeNumber);

  if (gErr) throw gErr;
  const ids = (grades || []).map((g: any) => g.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('test_periods')
    .select('*')
    .in('grade_id', ids)
    .is('deleted_at', null)
    .order('start_date', { ascending: false });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    startDate: item.start_date,
    endDate: item.end_date,
    classId: item.grade_id,
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

  // 有効なUUIDでない場合はnullを返す（一時的に無効化）
  if (!isValidUuid(classId)) {
    console.warn('[getCurrentTestPeriod] Invalid class_id format:', classId, '- but continuing anyway for debugging');
    // return null; // 一時的にコメントアウト
  }

  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('test_periods')
    .select('*')
    .eq('grade_id', classId)
    .is('deleted_at', null)
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
    classId: item.grade_id,
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
    .eq('grade_id', classId)
    .is('deleted_at', null)
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
    classId: item.grade_id,
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
    .is('deleted_at', null)
    .order('start_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(item => ({
    id: item.id,
    title: item.title,
    startDate: item.start_date,
    endDate: item.end_date,
    classId: item.grade_id,
    subjects: item.subjects,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  })) as TestPeriod[];
}

export async function getAllTestPeriodsForTeacher(): Promise<TestPeriod[]> {
  if (!supabase) throw new Error('Supabase is not initialized');
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const res = await fetch('/api/test-periods/groups', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch test periods (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return (rows || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    startDate: item.startDate,
    endDate: undefined as any,
    classId: item.classId,
    subjects: undefined as any,
    createdBy: undefined as any,
    createdAt: undefined as any,
    updatedAt: undefined as any,
  })) as TestPeriod[];
}

export async function getTestPeriodsByStudent(): Promise<TestPeriod[]> {
  if (!supabase) throw new Error('Supabase is not initialized');
  
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      console.error('[getTestPeriodsByStudent] No access token');
      throw new Error('Not authenticated');
    }

    console.log('[getTestPeriodsByStudent] Fetching test periods from API');
    
    // タイムアウト処理（10秒）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000);
    });
    
    const fetchPromise = fetch('/api/test-periods/by-student', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[getTestPeriodsByStudent] API error:', res.status, text);
      throw new Error(`Failed to fetch student periods (${res.status}): ${text}`);
    }
    
    const rows = await res.json();
    console.log('[getTestPeriodsByStudent] Received periods:', rows?.length || 0, rows);
    
    return (rows || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      startDate: item.startDate,
      endDate: item.endDate,
      classId: item.classId,
      subjects: undefined as any,
      createdBy: undefined as any,
      createdAt: undefined as any,
      updatedAt: undefined as any,
    })) as TestPeriod[];
  } catch (error) {
    console.error('[getTestPeriodsByStudent] Error:', error);
    throw error;
  }
}
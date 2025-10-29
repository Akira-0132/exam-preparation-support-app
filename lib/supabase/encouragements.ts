import { supabase } from '@/lib/supabase';
import { User } from '@/types';

// 励ましスタンプの型定義
export interface Encouragement {
  id: string;
  teacherId: string;
  studentId: string;
  stampType: string;
  message?: string;
  createdAt: string;
  isRead: boolean;
}

// 先生がスタンプを送信する
export async function sendStamp(teacherId: string, studentId: string, stampType: string, message?: string): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { error } = await supabase
    .from('encouragements')
    .insert({
      teacher_id: teacherId,
      student_id: studentId,
      stamp_type: stampType,
      message: message,
    });
  
  if (error) {
    console.error('Error sending stamp:', error);
    throw error;
  }
}

// 生徒が自分宛のスタンプを取得する
export async function getStampsForStudent(studentId: string): Promise<Encouragement[]> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await supabase
    .from('encouragements')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching stamps:', error);
    return [];
  }

  return data.map(item => ({
    id: item.id,
    teacherId: item.teacher_id,
    studentId: item.student_id,
    stampType: item.stamp_type,
    message: item.message,
    createdAt: item.created_at,
    isRead: item.is_read,
  }));
}

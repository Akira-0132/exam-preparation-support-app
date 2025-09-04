import { supabase } from '../supabase';
import { Task } from '@/types';

// 間違い記録を保存
export async function recordTaskMistakes(
  taskId: string,
  mistakePages: number[],
  cycleNumber: number
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // 間違い記録を保存
  const mistakeRecords = mistakePages.map(page => ({
    task_id: taskId,
    page_number: page,
    problem_numbers: [], // 今はページ単位のみ
    cycle_number: cycleNumber
  }));

  const { error } = await supabase
    .from('task_mistakes')
    .insert(mistakeRecords);

  if (error) {
    throw error;
  }
}

// 間違い直しタスクを生成
export async function createMistakeReviewTasks(
  parentTaskId: string,
  mistakePages: number[],
  userId: string,
  testPeriodId: string
): Promise<Task[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // 親タスクの情報を取得
  const { data: parentTask, error: parentError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', parentTaskId)
    .single();

  if (parentError || !parentTask) {
    throw new Error('親タスクが見つかりません');
  }

  // 間違い直しタスクを作成
  const reviewTasks = mistakePages.map(page => ({
    title: `${parentTask.title}（2周目：間違い直し）p.${page}`,
    description: `1周目で間違えた問題の解き直し（p.${page}）`,
    subject: parentTask.subject,
    priority: parentTask.priority,
    status: 'not_started' as const,
    due_date: calculateDueDate(page, mistakePages.length), // 日割り計算
    estimated_time: Math.ceil(parentTask.estimated_time / mistakePages.length),
    test_period_id: testPeriodId,
    assigned_to: userId,
    created_by: userId,
    task_type: 'single' as const,
    cycle_number: 2,
    learning_stage: 'review' as const
  }));

  const { data: newTasks, error: insertError } = await supabase
    .from('tasks')
    .insert(reviewTasks)
    .select('*');

  if (insertError) {
    throw insertError;
  }

  // タスクの関連性を記録
  const relationships = newTasks.map((task, index) => ({
    parent_task_id: parentTaskId,
    child_task_id: task.id,
    cycle_number: 2,
    page_number: mistakePages[index]
  }));

  const { error: relationshipError } = await supabase
    .from('task_relationships')
    .insert(relationships);

  if (relationshipError) {
    throw relationshipError;
  }

  // Task型に変換して返す
  return newTasks.map(mapTaskFromDB);
}

// 日割り計算（1日3ページペース）
function calculateDueDate(pageIndex: number, totalPages: number): string {
  const dailyPages = 3; // 1日3ページペース
  const daysFromNow = Math.ceil((pageIndex + 1) / dailyPages);
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysFromNow);
  
  return dueDate.toISOString();
}

// 間違い直しタスクをグループ化（1日3ページペース）
export async function groupMistakeReviewTasks(
  userId: string,
  testPeriodId: string,
  dailyPages: number = 3
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // 未完了の間違い直しタスクを取得
  const { data: reviewTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .eq('test_period_id', testPeriodId)
    .eq('learning_stage', 'review')
    .eq('status', 'not_started')
    .order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  // グループ化して期限を調整
  const groups = [];
  for (let i = 0; i < reviewTasks.length; i += dailyPages) {
    const group = reviewTasks.slice(i, i + dailyPages);
    const groupDueDate = new Date();
    groupDueDate.setDate(groupDueDate.getDate() + Math.floor(i / dailyPages) + 1);
    
    groups.push({
      tasks: group,
      dueDate: groupDueDate.toISOString()
    });
  }

  // 期限を更新
  for (const group of groups) {
    const taskIds = group.tasks.map(t => t.id);
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ due_date: group.dueDate })
      .in('id', taskIds);

    if (updateError) {
      throw updateError;
    }
  }
}

// データベースのタスクをTask型に変換
function mapTaskFromDB(dbTask: any): Task {
  return {
    id: dbTask.id,
    title: dbTask.title,
    description: dbTask.description || '',
    subject: dbTask.subject,
    priority: dbTask.priority,
    status: dbTask.status,
    dueDate: dbTask.due_date,
    estimatedTime: dbTask.estimated_time,
    actualTime: dbTask.actual_time,
    testPeriodId: dbTask.test_period_id,
    assignedTo: dbTask.assigned_to,
    createdBy: dbTask.created_by,
    createdAt: dbTask.created_at,
    updatedAt: dbTask.updated_at,
    completedAt: dbTask.completed_at,
    parentTaskId: dbTask.parent_task_id,
    taskType: dbTask.task_type,
    totalUnits: dbTask.total_units,
    completedUnits: dbTask.completed_units,
    unitType: dbTask.unit_type,
    cycleNumber: dbTask.cycle_number,
    learningStage: dbTask.learning_stage
  };
}

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

  // その科目の1周目タスクの最後の日付を取得
  const lastFirstCycleDueDate = await getLastFirstCycleDueDate(
    userId, 
    testPeriodId, 
    parentTask.subject
  );

  // 間違い直しタスクを作成
  const reviewTasks = mistakePages.map((page, index) => ({
    title: `${parentTask.title} p.${page} [復習]`,
    description: `復習（p.${page}）`,
    subject: parentTask.subject,
    priority: parentTask.priority,
    status: 'not_started' as const,
    due_date: calculateReviewTaskDueDate(lastFirstCycleDueDate, index, mistakePages.length), // 科目の1周目完了後
    estimated_time: Math.ceil(parentTask.estimated_time / mistakePages.length),
    test_period_id: testPeriodId,
    assigned_to: userId,
    created_by: userId,
    parent_task_id: parentTaskId, // 親タスクのIDを設定
    task_type: 'subtask' as const, // サブタスクとして追加
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

// 指定科目の1周目タスクの最後の日付を取得
async function getLastFirstCycleDueDate(
  userId: string,
  testPeriodId: string,
  subject: string
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // その科目の1周目タスクを取得（期限順で降順）
  const { data: firstCycleTasks, error } = await supabase
    .from('tasks')
    .select('due_date')
    .eq('assigned_to', userId)
    .eq('test_period_id', testPeriodId)
    .eq('subject', subject)
    .eq('cycle_number', 1)
    .order('due_date', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  // 1周目タスクがない場合は、現在日時から1週間後を返す
  if (!firstCycleTasks || firstCycleTasks.length === 0) {
    const fallbackDate = new Date();
    fallbackDate.setDate(fallbackDate.getDate() + 7);
    return fallbackDate.toISOString();
  }

  return firstCycleTasks[0].due_date;
}

// 1周目のタスク完了日を基準とした間違い直しタスクの日付計算
function calculateReviewTaskDueDate(lastFirstCycleDate: string, pageIndex: number, totalPages: number): string {
  const dailyPages = 3; // 1日3ページペース
  const daysFromLast = Math.ceil((pageIndex + 1) / dailyPages) + 1; // 1周目完了の翌日から開始
  
  const dueDate = new Date(lastFirstCycleDate);
  dueDate.setDate(dueDate.getDate() + daysFromLast);
  
  return dueDate.toISOString();
}

// 日割り計算（1日3ページペース） - 既存の関数は残しておく（他の用途で使用される可能性がある）
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
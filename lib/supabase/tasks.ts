import { supabase } from '@/lib/supabase';
import { Task } from '@/types';

// タスク作成
export async function createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // Convert date-like value to ISO string
  const dueDateStr = ((): string => {
    const v: any = taskData.dueDate as any;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof v.toISOString === 'function') return v.toISOString();
    return String(v);
  })();

  // start_date
  const startDateStr = ((): string => {
    const v: any = (taskData as any).startDate as any;
    if (!v) return new Date().toISOString();
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof v.toISOString === 'function') return v.toISOString();
    return String(v);
  })();

  console.log('Creating task with data:', {
    title: taskData.title,
    subject: taskData.subject,
    due_date: dueDateStr,
    test_period_id: taskData.testPeriodId,
    assigned_to: taskData.assignedTo,
    task_type: taskData.taskType,
    start_date: startDateStr,
  });

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: taskData.title,
      description: taskData.description,
      subject: taskData.subject,
      priority: taskData.priority,
      status: taskData.status,
      due_date: dueDateStr,
      start_date: startDateStr,
      estimated_time: taskData.estimatedTime,
      actual_time: taskData.actualTime,
      test_period_id: taskData.testPeriodId,
      assigned_to: taskData.assignedTo,
      created_by: taskData.createdBy,
      parent_task_id: taskData.parentTaskId,
      task_type: taskData.taskType || 'single',
      total_units: taskData.totalUnits,
      completed_units: taskData.completedUnits || 0,
      unit_type: taskData.unitType,
      is_shared: taskData.isShared ?? false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }

  console.log('Task created successfully with ID:', data.id);
  return data.id;
}

// 分割タスクの自動生成
export async function createSplitTask(
  parentTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>,
  totalUnits: number,
  unitType: 'pages' | 'problems' | 'hours' | 'sections',
  dailyUnits: number,
  rangeStart?: number,
  rangeEnd?: number
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // メインタスクを作成
  const parentTask = {
    ...parentTaskData,
    taskType: 'parent' as const,
    totalUnits,
    unitType,
    completedUnits: 0,
  };

  const parentTaskId = await createTask(parentTask);

  // サブタスクを生成（開始日から開始）
  const startDate = parentTaskData.startDate ? new Date(parentTaskData.startDate) : new Date();
  startDate.setHours(0, 0, 0, 0);
  const totalDays = Math.ceil(totalUnits / dailyUnits);
  
  const subtasks = [] as Array<Parameters<typeof createTask>[0]>;
  for (let i = 0; i < totalDays; i++) {
    const currentUnits = Math.min(dailyUnits, totalUnits - (i * dailyUnits));
    const subtaskDate = new Date(startDate);
    subtaskDate.setDate(startDate.getDate() + i);

    // 範囲が指定されている場合は、その日の開始/終了を計算
    let rangePart = '';
    if ((unitType === 'pages' || unitType === 'problems') && typeof rangeStart === 'number' && typeof rangeEnd === 'number') {
      const overallStart = rangeStart;
      const chunkStart = overallStart + i * dailyUnits;
      const chunkEnd = Math.min(overallStart + totalUnits - 1, chunkStart + currentUnits - 1);
      const unitLabel = unitType === 'pages' ? 'ページ' : '問';
      rangePart = `${chunkStart}〜${chunkEnd}${unitLabel}`;
    }

    subtasks.push({
      title: rangePart ? `${parentTaskData.title}（${i + 1}日目: ${rangePart}）` : `${parentTaskData.title}（${i + 1}日目）`,
      description: `${currentUnits}${unitType === 'pages' ? 'ページ' : unitType === 'problems' ? '問題' : unitType === 'hours' ? '分' : 'セクション'}分`,
      subject: parentTaskData.subject,
      priority: parentTaskData.priority,
      status: 'not_started' as const,
      dueDate: subtaskDate.toISOString(),
      startDate: subtaskDate.toISOString(),
      estimatedTime: Math.ceil((parentTaskData.estimatedTime * currentUnits) / totalUnits),
      testPeriodId: parentTaskData.testPeriodId,
      assignedTo: parentTaskData.assignedTo,
      createdBy: parentTaskData.createdBy,
      parentTaskId,
      taskType: 'subtask' as const,
      totalUnits: currentUnits,
      completedUnits: 0,
      unitType,
      isShared: parentTaskData.isShared || false,
    });
  }

  // サブタスクを一括作成
  for (const subtask of subtasks) {
    await createTask(subtask);
  }

  return parentTaskId;
}

// サブタスク作成（親タスク配下に追加）
export async function createSubtask(params: {
  parentTaskId: string,
  title: string,
  description?: string,
  subject: string,
  assignedTo: string,
  createdBy: string,
  testPeriodId: string,
  dueDate: string,
  totalUnits?: number,
  unitType?: 'pages' | 'problems' | 'hours' | 'sections',
}): Promise<string> {
  const subtask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'> = {
    title: params.title,
    description: params.description || '',
    subject: params.subject,
    priority: 'medium',
    status: 'not_started',
    dueDate: params.dueDate,
    estimatedTime: 30,
    testPeriodId: params.testPeriodId,
    assignedTo: params.assignedTo,
    createdBy: params.createdBy,
    taskType: 'subtask',
    parentTaskId: params.parentTaskId,
    totalUnits: params.totalUnits,
    completedUnits: 0,
    unitType: params.unitType,
  };

  return await createTask(subtask);
}

// タスク取得
export async function getTask(taskId: string): Promise<Task | null> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
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
    description: data.description,
    subject: data.subject,
    priority: data.priority,
    status: data.status,
    dueDate: data.due_date,
    // 開始日
    startDate: data.start_date,
    estimatedTime: data.estimated_time,
    actualTime: data.actual_time,
    testPeriodId: data.test_period_id,
    assignedTo: data.assigned_to,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
  } as Task;
}

// タスク更新
export async function updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const updateData: any = {};
  
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.subject !== undefined) updateData.subject = updates.subject;
  if (updates.priority !== undefined) updateData.priority = updates.priority;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
  if ((updates as any).startDate !== undefined) updateData.start_date = (updates as any).startDate;
  if (updates.estimatedTime !== undefined) updateData.estimated_time = updates.estimatedTime;
  if (updates.actualTime !== undefined) updateData.actual_time = updates.actualTime;
  if (updates.testPeriodId !== undefined) updateData.test_period_id = updates.testPeriodId;
  if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo;
  if (updates.createdBy !== undefined) updateData.created_by = updates.createdBy;
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
  // 階層/分割関連
  if ((updates as any).parentTaskId !== undefined) updateData.parent_task_id = (updates as any).parentTaskId;
  if ((updates as any).taskType !== undefined) updateData.task_type = (updates as any).taskType;
  if ((updates as any).totalUnits !== undefined) updateData.total_units = (updates as any).totalUnits;
  if ((updates as any).completedUnits !== undefined) updateData.completed_units = (updates as any).completedUnits;
  if ((updates as any).unitType !== undefined) updateData.unit_type = (updates as any).unitType;

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId);

  if (error) {
    throw error;
  }
}

// タスクの状態を切り替える便利な関数
export async function toggleTaskStatus(taskId: string, currentStatus: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // 状態の遷移ルール
  let newStatus: string;
  let completedAt: string | null = null;

  switch (currentStatus) {
    case 'not_started':
      newStatus = 'in_progress';
      break;
    case 'in_progress':
      newStatus = 'completed';
      completedAt = new Date().toISOString();
      break;
    case 'completed':
      newStatus = 'not_started';
      break;
    default:
      newStatus = 'not_started';
  }

  await updateTask(taskId, { 
    status: newStatus as Task['status'],
    completedAt: completedAt || undefined
  });

  return newStatus;
}

// タスク完了
export async function completeTask(taskId: string, actualTime?: number): Promise<void> {
  console.log('[completeTask] Starting task completion for taskId:', taskId);
  
  if (!supabase) {
    console.error('[completeTask] Supabase is not initialized');
    throw new Error('Supabase is not initialized');
  }

  const updateData: any = {
    status: 'completed',
    completed_at: new Date().toISOString(),
  };
  
  if (actualTime !== undefined) {
    updateData.actual_time = actualTime;
  }

  console.log('[completeTask] Updating task with data:', updateData);
  
  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId);

  if (error) {
    console.error('[completeTask] Error updating task:', error);
    throw error;
  }

  console.log('[completeTask] Task updated successfully');

  // 完了したタスクの情報を取得
  const { data: completedTask, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (taskError || !completedTask) {
    console.error('[completeTask] Failed to fetch completed task:', taskError);
    // タスクの取得に失敗しても、更新は成功しているので、エラーを投げずに続行
    // ただし、checkAndCreatePerfectTaskは実行しない
    console.warn('[completeTask] Skipping perfect task check due to fetch error');
    return;
  }

  console.log('[completeTask] Completed task fetched:', {
    id: completedTask.id,
    title: completedTask.title,
    cycleNumber: completedTask.cycle_number,
    learningStage: completedTask.learning_stage,
  });

  // 3周目タスク完了時の特別処理
  if (completedTask.cycle_number === 3 && completedTask.learning_stage === 'perfect') {
    // 3周目タスクの場合は特別な完了処理（間違いチェックは行わない）
    console.log('[completeTask] 3周目タスクが完了しました。特別な完了処理を実行します。');
    return; // 通常の完璧タスク生成チェックは行わない
  }

  // 完璧タスク生成チェック（エラーが発生しても、タスク完了自体は成功とする）
  try {
    console.log('[completeTask] Checking for perfect task creation...');
    await checkAndCreatePerfectTask(taskId);
    console.log('[completeTask] Perfect task check completed');
  } catch (perfectTaskError) {
    console.error('[completeTask] Error in checkAndCreatePerfectTask:', perfectTaskError);
    // 完璧タスク生成チェックのエラーは無視して続行（タスク完了自体は成功）
    console.warn('[completeTask] Continuing despite perfect task check error');
  }
  
  console.log('[completeTask] Task completion process completed successfully');
}

// タスク削除
export async function deleteTask(taskId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    throw error;
  }
}

// テスト期間に紐づくタスクをすべて移行
export async function reassignTasksTestPeriod(fromTestPeriodId: string, toTestPeriodId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }
  const { error } = await supabase
    .from('tasks')
    .update({ test_period_id: toTestPeriodId })
    .eq('test_period_id', fromTestPeriodId);
  if (error) throw error;
}

// テスト期間に紐づくタスクを一括削除
export async function deleteTasksByTestPeriod(testPeriodId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('test_period_id', testPeriodId);
  if (error) throw error;
}

// タスクとそのサブタスクを一括削除
export async function deleteTaskWithSubtasks(taskId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // まずサブタスクを削除
  const { error: subtaskError } = await supabase
    .from('tasks')
    .delete()
    .eq('parent_task_id', taskId);

  if (subtaskError) {
    throw subtaskError;
  }

  // メインタスクを削除
  const { error: mainTaskError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (mainTaskError) {
    throw mainTaskError;
  }
}

// 単一タスクを削除（サブタスクを持つ親に対しては非推奨。親は deleteTaskWithSubtasks を使用）
// 重複定義を削除（上に実装済み）

// ユーザーのタスク一覧取得
export async function getTasksByUserId(userId: string): Promise<Task[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(mapTaskFromDB);
}

// テスト期間のタスク一覧取得
export async function getTasksByTestPeriodId(testPeriodId: string): Promise<Task[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('test_period_id', testPeriodId)
    .order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(mapTaskFromDB);
}

// ユーザー・テスト期間別タスク一覧取得
export async function getTasksByUserAndTestPeriod(userId: string, testPeriodId: string): Promise<Task[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .eq('test_period_id', testPeriodId)
    .order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(mapTaskFromDB);
}

// 科目別タスク取得
export async function getTasksBySubject(userId: string, subject: string, testPeriodId?: string, isTeacher: boolean = false): Promise<Task[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  console.log('[getTasksBySubject] Querying with:', {
    userId,
    subject,
    testPeriodId,
    isTeacher
  });

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('subject', subject);

  // 講師の場合は作成者かつ割り当て先でフィルタリング、生徒の場合は割り当て先でフィルタリング
  if (isTeacher) {
    query = query.eq('created_by', userId).eq('assigned_to', userId).eq('is_shared', true);
    console.log('[getTasksBySubject] Added created_by, assigned_to and is_shared filter for teacher');
  } else {
    query = query.eq('assigned_to', userId);
    console.log('[getTasksBySubject] Added assigned_to filter for student');
  }

  // テスト期間IDが指定されている場合は、その期間のタスクのみを取得
  if (testPeriodId) {
    query = query.eq('test_period_id', testPeriodId);
    console.log('[getTasksBySubject] Added test_period_id filter:', testPeriodId);
  }

  const { data, error } = await query.order('due_date', { ascending: true });

  if (error) {
    console.error('[getTasksBySubject] Database error:', error);
    throw error;
  }

  console.log('[getTasksBySubject] Raw data from DB:', data);
  const mappedTasks = data.map(mapTaskFromDB);
  console.log('[getTasksBySubject] Mapped tasks:', mappedTasks);

  return mappedTasks;
}

// 今日のタスク取得（サブタスク優先、メインタスクは除外）
export async function getTodayTasks(userId: string, testPeriodId?: string): Promise<Task[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .gte('due_date', today.toISOString())
    .lt('due_date', tomorrow.toISOString())
    .neq('task_type', 'parent'); // メインタスクは除外
  // 開始日が今日以前のもののみ（今日から着手可能）
  query = query.lte('start_date', tomorrow.toISOString());

  // テスト期間IDが指定されている場合は、その期間のタスクのみを取得
  if (testPeriodId) {
    query = query.eq('test_period_id', testPeriodId);
  }

  const { data, error } = await query
    .order('task_type', { ascending: false }) // サブタスクを先に
    .order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(mapTaskFromDB);
}

// 未完了タスク取得（テスト期間IDでフィルター可能）
export async function getIncompleTasks(userId: string, testPeriodId?: string): Promise<Task[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .in('status', ['not_started', 'in_progress'])
    .neq('task_type', 'parent'); // メインタスクは除外
  
  // testPeriodIdが指定されていればフィルターを追加
  if (testPeriodId) {
    query = query.eq('test_period_id', testPeriodId);
  }
  
  // 明日以降の一覧では、開始日が明日以降のタスクも含める（ここでは全体取得し、呼び出し側で今日分を除外）
  const { data, error } = await query.order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(mapTaskFromDB);
}

// 期限切れタスク取得
export async function getOverdueTasks(userId: string): Promise<Task[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .in('status', ['not_started', 'in_progress'])
    .lt('due_date', now)
    .order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(mapTaskFromDB);
}

// 高優先度タスク取得
export async function getHighPriorityTasks(userId: string): Promise<Task[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .eq('priority', 'high')
    .in('status', ['not_started', 'in_progress'])
    .order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(mapTaskFromDB);
}

// DB結果をTaskオブジェクトにマップ
function mapTaskFromDB(data: any): Task {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    subject: data.subject,
    priority: data.priority,
    status: data.status,
    dueDate: data.due_date,
    estimatedTime: data.estimated_time,
    actualTime: data.actual_time,
    testPeriodId: data.test_period_id,
    assignedTo: data.assigned_to,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
    // 階層構造フィールド
    parentTaskId: data.parent_task_id,
    taskType: (data.task_type || 'single') as 'single' | 'parent' | 'subtask',
    totalUnits: data.total_units,
    completedUnits: data.completed_units || 0,
    unitType: (data.unit_type || 'pages') as 'pages' | 'problems' | 'hours' | 'sections',
    // 周回学習フィールド
    cycleNumber: data.cycle_number,
    learningStage: data.learning_stage,
    // 共有タスクフィールド
    isShared: data.is_shared || false,
  } as Task;
}

// タスク統計取得
export async function getTaskStatistics(userId: string, testPeriodId?: string): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  completionRate: number;
}> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId);
  
  if (testPeriodId) {
    query = query.eq('test_period_id', testPeriodId);
  }

  const { data: tasks, error } = await query;

  if (error) {
    throw error;
  }

  const now = new Date();
  
  // メインタスクは除外し、サブタスクとシングルタスクのみをカウント
  const actionableTasks = tasks.filter(t => t.task_type !== 'parent');
  
  const stats = {
    total: actionableTasks.length,
    completed: actionableTasks.filter(t => t.status === 'completed').length,
    inProgress: actionableTasks.filter(t => t.status === 'in_progress').length,
    notStarted: actionableTasks.filter(t => t.status === 'not_started').length,
    overdue: actionableTasks.filter(t => 
      t.status !== 'completed' && 
      new Date(t.due_date) < now
    ).length,
    completionRate: 0,
  };
  
  if (stats.total > 0) {
    stats.completionRate = Math.round((stats.completed / stats.total) * 100);
  }
  
  return stats;
}

// 教師が生徒の統計を取得（RLS回避のためAPI経由）
export async function getTaskStatisticsForTeacher(studentId: string, periodId?: string): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  completionRate: number;
}> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const qs = new URLSearchParams({ student_id: studentId });
  if (periodId) qs.set('period_id', periodId);
  const res = await fetch(`/api/stats/student?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch stats (${res.status}): ${text}`);
  }
  return await res.json();
}

// 完璧タスク生成チェック
async function checkAndCreatePerfectTask(completedTaskId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // 完了したタスクの情報を取得
  const { data: completedTask, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', completedTaskId)
    .single();

  if (taskError || !completedTask) {
    console.error('完了したタスクの取得に失敗:', taskError);
    return;
  }

  let parentTaskId: string | null = null;

  // 完了したタスクがサブタスクの場合、親タスクのIDを取得
  if (completedTask.task_type === 'subtask' && completedTask.parent_task_id) {
    parentTaskId = completedTask.parent_task_id;
  }
  // 完了したタスクがメインタスクの場合、そのIDを使用
  else if (completedTask.task_type === 'parent') {
    parentTaskId = completedTaskId;
  }
  // その他の場合は何もしない
  else {
    return;
  }

  // 親タスクの情報を取得
  const { data: parentTask, error: parentError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', parentTaskId)
    .single();

  if (parentError || !parentTask) {
    console.error('親タスクの取得に失敗:', parentError);
    return;
  }

  // 親タスクのすべてのサブタスクが完了しているかチェック
  const { data: allSubtasks, error: allSubtasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_task_id', parentTaskId)
    .in('status', ['not_started', 'in_progress']);

  if (allSubtasksError) {
    console.error('サブタスクの取得に失敗:', allSubtasksError);
    return;
  }

  // 未完了のサブタスクがある場合は何もしない
  if (allSubtasks && allSubtasks.length > 0) {
    console.log(`親タスク ${parentTask.title} にはまだ未完了のサブタスクが ${allSubtasks.length} 件あります`);
    return;
  }

  // すべてのサブタスクが完了している場合、最終チェック（完璧）タスクを生成
  console.log(`親タスク ${parentTask.title} のすべてのサブタスクが完了しました。最終チェックタスクを生成します。`);
  await createPerfectTask(parentTask);
}

// 完璧タスク作成
async function createPerfectTask(parentTask: any): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // 既に完璧タスクが存在するかチェック
  const { data: existingPerfectTask, error: checkError } = await supabase
    .from('tasks')
    .select('id')
    .eq('parent_task_id', parentTask.id)
    .eq('cycle_number', 3)
    .eq('learning_stage', 'perfect')
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('完璧タスクの重複チェックに失敗:', checkError);
    return;
  }

  if (existingPerfectTask) {
    // 既に完璧タスクが存在する場合は何もしない
    return;
  }

  // 完璧タスクの期日を計算（親タスクの期日の2日後）
  const parentDueDate = new Date(parentTask.due_date);
  const perfectTaskDueDate = new Date(parentDueDate);
  perfectTaskDueDate.setDate(perfectTaskDueDate.getDate() + 2);

  // 完璧タスクを作成
  const perfectTask = {
    title: `✨ ${parentTask.title} [完璧チェック]`,
    description: `すべての問題の解き方・答え方・間違えたポイントの最終確認`,
    subject: parentTask.subject,
    priority: parentTask.priority,
    status: 'not_started' as const,
    due_date: perfectTaskDueDate.toISOString(),
    estimated_time: Math.ceil(parentTask.estimated_time * 0.5), // 親タスクの半分の時間
    test_period_id: parentTask.test_period_id,
    assigned_to: parentTask.assigned_to,
    created_by: parentTask.created_by,
    parent_task_id: parentTask.id,
    task_type: 'subtask' as const,
    cycle_number: 3,
    learning_stage: 'perfect' as const
  };

  const { error: insertError } = await supabase
    .from('tasks')
    .insert(perfectTask);

  if (insertError) {
    console.error('完璧タスクの作成に失敗:', insertError);
  } else {
    console.log('完璧タスクが作成されました:', perfectTask.title);
  }
}

// 学年の全生徒を取得
export async function getStudentsByGrade(gradeId: string, periodId?: string): Promise<{ id: string; displayName: string; studentNumber?: string }[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const qs = new URLSearchParams({ grade_id: gradeId });
  if (periodId) qs.set('period_id', periodId);

  const res = await fetch(`/api/students/by-grade?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch students (${res.status}): ${text}`);
  }

  const students = await res.json();
  return students as { id: string; displayName: string; studentNumber?: string }[];
}

// 期間に紐づく全生徒を取得（教師向け）
export async function getStudentsByPeriod(periodId: string): Promise<{
  id: string;
  displayName: string;
  gradeId?: string | null;
  gradeNumber?: number | null;
  schoolId?: string | null;
  schoolName?: string | null;
}[]> {
  if (!supabase) throw new Error('Supabase is not initialized');
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');
  const qs = new URLSearchParams({ period_id: periodId });
  const res = await fetch(`/api/students/by-period?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch students by period (${res.status}): ${text}`);
  }
  return await res.json();
}

// 先生が生徒にタスクを一括配布（既存のタスクをそのまま配布）
export async function distributeTaskToStudents(params: {
  taskId: string;
  gradeId: string;
  targetStudents?: { id: string; displayName: string }[];
}): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }

  // 対象生徒（明示指定があればそれ、なければ学年全体）
  const students = params.targetStudents && params.targetStudents.length > 0
    ? params.targetStudents
    : await getStudentsByGrade(params.gradeId);
  
  if (students.length === 0) {
    return { successCount: 0, errorCount: 0, errors: ['指定された学年に生徒が見つかりません'] };
  }

  // 元のタスクとそのサブタスクを取得
  const { data: originalTask, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', params.taskId)
    .single();

  if (taskError || !originalTask) {
    return { successCount: 0, errorCount: 0, errors: ['元のタスクが見つかりません'] };
  }

  // サブタスクを取得
  const { data: subtasks, error: subtasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_task_id', params.taskId)
    .order('due_date', { ascending: true });

  if (subtasksError) {
    return { successCount: 0, errorCount: 0, errors: ['サブタスクの取得に失敗しました'] };
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // 各生徒にタスクを配布
  for (const student of students) {
    try {
      // メインタスクを作成
      const { data: newParentTask, error: parentError } = await supabase
        .from('tasks')
        .insert({
          title: originalTask.title,
          description: originalTask.description,
          subject: originalTask.subject,
          priority: originalTask.priority,
          status: 'not_started',
          due_date: originalTask.due_date,
          start_date: originalTask.start_date || new Date().toISOString(),
          estimated_time: originalTask.estimated_time,
          test_period_id: originalTask.test_period_id,
          assigned_to: student.id,
          created_by: originalTask.created_by,
          task_type: originalTask.task_type,
          total_units: originalTask.total_units,
          completed_units: 0,
          unit_type: originalTask.unit_type,
          is_shared: true,
          grade_id: params.gradeId,
        })
        .select('id')
        .single();

      if (parentError) {
        throw parentError;
      }

      // サブタスクを作成
      for (const subtask of subtasks || []) {
        await supabase
          .from('tasks')
          .insert({
            title: subtask.title,
            description: subtask.description,
            subject: subtask.subject,
            priority: subtask.priority,
            status: 'not_started',
            due_date: subtask.due_date,
            start_date: subtask.start_date || new Date().toISOString(),
            estimated_time: subtask.estimated_time,
            test_period_id: subtask.test_period_id,
            assigned_to: student.id,
            created_by: subtask.created_by,
            parent_task_id: newParentTask.id,
            task_type: subtask.task_type,
            total_units: subtask.total_units,
            completed_units: 0,
            unit_type: subtask.unit_type,
            is_shared: true,
            grade_id: params.gradeId,
          });
      }

      successCount++;
    } catch (error) {
      errorCount++;
      errors.push(`${student.displayName}: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  return { successCount, errorCount, errors };
}

export async function getSubjectStatsForTeacher(studentId: string, periodId?: string): Promise<{
  subject: string;
  total: number;
  completed: number;
  completionRate: number;
}[]> {
  if (!supabase) {
    throw new Error('Supabase is not initialized');
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const qs = new URLSearchParams({ student_id: studentId });
  if (periodId) qs.set('period_id', periodId);

  const res = await fetch(`/api/stats/student/subjects?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch subject stats (${res.status}): ${text}`);
  }
  return await res.json();
}
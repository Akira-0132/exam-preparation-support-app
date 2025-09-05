'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Task } from '@/types';
import { updateTask, completeTask, deleteTaskWithSubtasks } from '@/lib/supabase/tasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface TaskListProps {
  tasks: Task[];
  title?: string;
  showActions?: boolean;
  onTaskUpdate?: () => void;
}

export default function TaskList({ 
  tasks, 
  title = 'タスク一覧', 
  showActions = true,
  onTaskUpdate
}: TaskListProps) {
  const router = useRouter();
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 時刻表示は不要: 日付のみ
    const dateStr = date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric'
    });
    
    if (diffDays < 0) {
      return `${dateStr} (${Math.abs(diffDays)}日前)`;
    } else if (diffDays === 0) {
      return `${dateStr} (今日)`;
    } else if (diffDays === 1) {
      return `${dateStr} (明日)`;
    } else {
      return `${dateStr} (${diffDays}日後)`;
    }
  };

  // 科目バッジの色分け
  const getSubjectBadgeClass = (subject: string) => {
    const map: Record<string, string> = {
      '国語': 'bg-red-50 text-red-700',
      '数学': 'bg-indigo-50 text-indigo-700',
      '英語': 'bg-blue-50 text-blue-700',
      '理科': 'bg-green-50 text-green-700',
      '社会': 'bg-yellow-50 text-yellow-700',
      '音楽': 'bg-pink-50 text-pink-700',
      '美術': 'bg-purple-50 text-purple-700',
      '技術': 'bg-teal-50 text-teal-700',
      '家庭': 'bg-rose-50 text-rose-700',
      '保健': 'bg-lime-50 text-lime-700',
      '体育': 'bg-orange-50 text-orange-700',
    };
    return map[subject] || 'bg-gray-100 text-gray-700';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'not_started':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '完了';
      case 'in_progress':
        return '進行中';
      case 'not_started':
        return '未開始';
      default:
        return '';
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    setUpdatingTasks(prev => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    
    try {
      if (newStatus === 'completed') {
        await completeTask(taskId);
      } else {
        await updateTask(taskId, { status: newStatus });
      }
      onTaskUpdate?.();
    } catch (error) {
      console.error('タスクの更新に失敗しました:', error);
    } finally {
      setUpdatingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };


  // 期限切れ判定: 本来やるべき日(=dueDate の日付)を過ぎて未完了のもの
  const isOverdue = (task: Task) => {
    if (task.status === 'completed') return false;
    const due = new Date(task.dueDate);
    const today = new Date();
    // 日付のみ比較（00:00の基準で判定）
    due.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    return due < today;
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('このタスクを削除しますか？サブタスクがある場合は、それらも一緒に削除されます。')) {
      return;
    }

    setDeletingTasks(prev => new Set(prev).add(taskId));
    
    try {
      await deleteTaskWithSubtasks(taskId);
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error('タスクの削除に失敗しました:', error);
      alert('タスクの削除に失敗しました。');
    } finally {
      setDeletingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  // 科目ごとにグループ化（条件分岐の前に移動）
  const grouped = useMemo(() => {
    const g: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!g[t.subject]) g[t.subject] = [];
      g[t.subject].push(t);
    }
    return g;
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <Card variant="outlined">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-gray-500">タスクがありません</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <span className="text-sm font-normal text-gray-500">
            {tasks.length}件
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(grouped).map(([subject, subjectTasks]) => (
            <div key={subject}>
              <div className="px-4 py-2 bg-gray-50 rounded flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSubjectBadgeClass(subject)}`}>{subject}</span>
                  <span className="text-xs text-gray-500">{subjectTasks.length}件</span>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
          {subjectTasks.map((task) => (
            <div
              key={task.id}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                isOverdue(task) ? 'bg-red-50 border-l-4 border-red-400' : ''
              } ${
                task.status === 'completed' ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    {/* 科目バッジを先頭に */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSubjectBadgeClass(task.subject)}`}>{task.subject}</span>
                    <h3 className={`text-sm font-medium truncate ${
                      task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
                    }`}>
                      {task.title}
                    </h3>
                  </div>
                  
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                    {task.description}
                  </p>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>{formatDate(task.dueDate)}</span>
                    {/* 進捗比率の表示は削除（不要） */}
                    {isOverdue(task) && task.status !== 'completed' && (
                      <span className="text-red-600 font-medium">期限切れ</span>
                    )}
                  </div>
                </div>

                {showActions && (
                  <div className="flex items-center space-x-2 ml-4">
                    {/* ステータスチップは非表示 */}
                    
                    <div className="flex space-x-1">
                                   {task.status === 'not_started' && (
               <Button
                 size="sm"
                 variant="primary"
                 onClick={() => handleStatusChange(task.id, 'completed')}
                 disabled={updatingTasks.has(task.id)}
               >
                 完了
               </Button>
             )}
                      
                      {task.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleStatusChange(task.id, 'completed')}
                          disabled={updatingTasks.has(task.id)}
                        >
                          完了
                        </Button>
                      )}
                      {/* 完了後の"やり直す"ボタンは表示しない */}
             
             {/* ダッシュボードでは削除ボタンを非表示 */}
                      {/* 小さなリンク: 押し間違い時はこちら → 科目詳細へ */}
                      {task.status === 'completed' && (
                        <button
                          className="ml-2 text-[11px] text-gray-400 underline underline-offset-2 hover:text-gray-600"
                          onClick={() => router.push(`/dashboard/subjects/${encodeURIComponent(task.subject)}`)}
                          title="押し間違えた？こちらから科目詳細でやり直せます"
                        >
                          押し間違えた？こちら
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {task.status === 'completed' && task.completedAt && (
                <div className="mt-2 text-xs text-green-600">
                  ✅ 完了日時: {new Date(task.completedAt).toLocaleString('ja-JP')}
                  {task.actualTime && ` (実際の時間: ${task.actualTime}分)`}
                </div>
              )}
            </div>
          ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
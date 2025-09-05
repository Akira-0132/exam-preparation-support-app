'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Task } from '@/types';
import { updateTask, completeTask, deleteTaskWithSubtasks } from '@/lib/supabase/tasks';
import { recordTaskMistakes, createMistakeReviewTasks, groupMistakeReviewTasks } from '@/lib/supabase/mistake-tracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import MistakeTrackingModal from './MistakeTrackingModal';
import CompletionCelebration from '@/components/ui/CompletionCelebration';

interface UpcomingTaskAccordionProps {
  tasks: Task[];
  title: string;
  onTaskUpdate?: () => void;
  showActions?: boolean;
  totalTaskCount?: number; // 全タスク数（表示用）
}

export default function UpcomingTaskAccordion({ 
  tasks, 
  title, 
  onTaskUpdate,
  showActions = true,
  totalTaskCount
}: UpcomingTaskAccordionProps) {
  const router = useRouter();
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [visibleTasksPerSubject, setVisibleTasksPerSubject] = useState<Record<string, number>>({});
  const [mistakeModalTask, setMistakeModalTask] = useState<Task | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completedTaskTitle, setCompletedTaskTitle] = useState<string>('');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
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

  const getStageInfo = (cycle: number, stage: string) => {
    const stages: Record<string, { label: string; icon: string; color: string }> = {
      'overview': { label: '全体確認', icon: '🔍', color: 'text-blue-600' },
      'review': { label: '間違い直し', icon: '🔧', color: 'text-orange-600' },
      'mastery': { label: '総復習', icon: '🎯', color: 'text-green-600' }
    };
    return stages[stage] || stages['overview'];
  };

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    if (newStatus === 'completed') {
      // 完了時は間違い追跡モーダルを表示
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setMistakeModalTask(task);
      }
      return;
    }

    setUpdatingTasks(prev => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    
    try {
      await updateTask(taskId, { status: newStatus });
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

  const handleMistakeTrackingComplete = async (mistakePages: number[]) => {
    if (!mistakeModalTask) return;

    setUpdatingTasks(prev => {
      const next = new Set(prev);
      next.add(mistakeModalTask.id);
      return next;
    });

    try {
      console.log('[MistakeTracking] 開始:', { 
        taskId: mistakeModalTask.id, 
        mistakePages, 
        cycleNumber: mistakeModalTask.cycleNumber 
      });

      // タスクを完了として記録
      await completeTask(mistakeModalTask.id);
      console.log('[MistakeTracking] タスク完了記録完了');

      // 間違い記録を保存
      if (mistakePages.length > 0) {
        console.log('[MistakeTracking] 間違い記録を保存中...');
        await recordTaskMistakes(
          mistakeModalTask.id,
          mistakePages,
          mistakeModalTask.cycleNumber || 1
        );
        console.log('[MistakeTracking] 間違い記録保存完了');

        // 間違い直しタスクを生成
        console.log('[MistakeTracking] 間違い直しタスクを生成中...');
        const newTasks = await createMistakeReviewTasks(
          mistakeModalTask.id,
          mistakePages,
          mistakeModalTask.assignedTo,
          mistakeModalTask.testPeriodId
        );
        console.log('[MistakeTracking] 間違い直しタスク生成完了:', newTasks.length, '件');

        // 間違い直しタスクをグループ化
        console.log('[MistakeTracking] タスクグループ化中...');
        await groupMistakeReviewTasks(
          mistakeModalTask.assignedTo,
          mistakeModalTask.testPeriodId
        );
        console.log('[MistakeTracking] タスクグループ化完了');
      }

      // 完了エフェクトを表示（onTaskUpdateの前に実行）
      console.log('[UpcomingTaskAccordion] Setting celebration for task:', mistakeModalTask.title);
      setCompletedTaskTitle(mistakeModalTask.title);
      setShowCelebration(true);
      
      console.log('[MistakeTracking] 処理完了');
      
      // エフェクト表示完了後にonTaskUpdateを呼ぶ（4秒後）
      setTimeout(() => {
        onTaskUpdate?.();
      }, 4000);
    } catch (error) {
      console.error('タスクの完了処理に失敗しました:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      alert(`エラーが発生しました: ${errorMessage}`);
    } finally {
      setUpdatingTasks(prev => {
        const next = new Set(prev);
        next.delete(mistakeModalTask.id);
        return next;
      });
      setMistakeModalTask(null);
    }
  };

  const isOverdue = (task: Task) => {
    if (task.status === 'completed') return false;
    const due = new Date(task.dueDate);
    const today = new Date();
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

  const toggleSubjectExpanded = (subject: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }
      return next;
    });
  };

  const showMoreTasks = (subject: string) => {
    setVisibleTasksPerSubject(prev => ({
      ...prev,
      [subject]: (prev[subject] || 3) + 3
    }));
  };

  // 科目ごとにグループ化
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
            {totalTaskCount !== undefined ? totalTaskCount : tasks.length}件
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(grouped).map(([subject, subjectTasks]) => {
            const isExpanded = expandedSubjects.has(subject);
            const visibleCount = visibleTasksPerSubject[subject] || 3;
            const visibleTasks = subjectTasks.slice(0, visibleCount);
            const hasMoreTasks = subjectTasks.length > visibleCount;

            return (
              <div key={subject}>
                {/* 科目カード */}
                <div 
                  className="p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSubjectExpanded(subject)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSubjectBadgeClass(subject)}`}>
                        {subject}
                      </span>
                      <span className="text-sm text-gray-600">
                        {subjectTasks.length}件
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transform transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* 展開時のタスク一覧 */}
                {isExpanded && (
                  <div className="mt-2 space-y-2">
                    {visibleTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`p-3 bg-white border rounded-lg ${
                          isOverdue(task) ? 'border-red-200 bg-red-50' : 'border-gray-200'
                        } ${
                          task.status === 'completed' ? 'bg-green-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSubjectBadgeClass(task.subject)}`}>
                                {task.subject}
                              </span>
                              {(task.cycleNumber && task.cycleNumber > 1) && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStageInfo(task.cycleNumber, task.learningStage || 'overview').color}`}>
                                  {getStageInfo(task.cycleNumber, task.learningStage || 'overview').icon} {task.cycleNumber}周目
                                </span>
                              )}
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
                              {isOverdue(task) && task.status !== 'completed' && (
                                <span className="text-red-600 font-medium">期限切れ</span>
                              )}
                            </div>
                          </div>

                          {showActions && (
                            <div className="flex items-center space-x-2 ml-4">
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

                    {/* さらに表示するボタン */}
                    {hasMoreTasks && (
                      <div className="text-center pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => showMoreTasks(subject)}
                        >
                          さらに表示する ({subjectTasks.length - visibleCount}件)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* 間違い追跡モーダル */}
      <MistakeTrackingModal
        task={mistakeModalTask}
        isOpen={!!mistakeModalTask}
        onClose={() => setMistakeModalTask(null)}
        onComplete={handleMistakeTrackingComplete}
      />

      {/* 完了エフェクト */}
      <CompletionCelebration
        isVisible={showCelebration}
        onComplete={() => setShowCelebration(false)}
        taskTitle={completedTaskTitle}
      />
    </Card>
  );
}

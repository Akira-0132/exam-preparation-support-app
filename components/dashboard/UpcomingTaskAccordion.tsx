'use client';

import { useState, useEffect } from 'react';
import { Task } from '@/types';
import { completeTask, deleteTask } from '@/lib/supabase/tasks';
import { recordTaskMistakes, createMistakeReviewTasks, groupMistakeReviewTasks } from '@/lib/supabase/mistake-tracking';
import Button from '@/components/ui/Button';
import CompletionCelebration from '@/components/ui/CompletionCelebration';
import PerfectTaskCompletion from '@/components/ui/PerfectTaskCompletion';
import MistakeTrackingModal from '@/components/dashboard/MistakeTrackingModal';

interface UpcomingTaskAccordionProps {
  tasks: Task[];
  title: string;
  onTaskUpdate?: () => void;
  showActions?: boolean;
  totalTaskCount?: number;
}

export default function UpcomingTaskAccordion({ 
  tasks, 
  title, 
  onTaskUpdate,
  showActions = true,
  totalTaskCount
}: UpcomingTaskAccordionProps) {
  
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showMistakeModal, setShowMistakeModal] = useState(false);
  const [mistakeModalTask, setMistakeModalTask] = useState<Task | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completedTaskTitle, setCompletedTaskTitle] = useState<string>('');
  const [showPerfectCompletion, setShowPerfectCompletion] = useState(false);
  const [perfectTaskTitle, setPerfectTaskTitle] = useState('');
  const [perfectTaskSubject, setPerfectTaskSubject] = useState('');

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

  const isOverdue = (task: Task) => {
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    return dueDate < now && task.status !== 'completed';
  };

  const isPerfectTask = (task: Task) => {
    return task.cycleNumber === 3 && task.learningStage === 'perfect';
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

  const getStageInfo = (cycleNumber: number, learningStage: string) => {
    if (cycleNumber === 3 && learningStage === 'perfect') {
      return {
        icon: '✨',
        color: 'bg-purple-100 text-purple-800 border-2 border-purple-300 shadow-lg'
      };
    }
    
    if (cycleNumber === 2 && learningStage === 'review') {
      return {
        icon: '🔄',
        color: 'bg-orange-100 text-orange-800'
      };
    }
    
    if (cycleNumber > 1) {
      return {
        icon: '🔄',
        color: 'bg-orange-100 text-orange-800'
      };
    }
    
    switch (learningStage) {
      case 'overview':
        return {
          icon: '📖',
          color: 'bg-blue-100 text-blue-800'
        };
      case 'practice':
        return {
          icon: '✏️',
          color: 'bg-green-100 text-green-800'
        };
      case 'review':
        return {
          icon: '🔄',
          color: 'bg-orange-100 text-orange-800'
        };
      default:
        return {
          icon: '📖',
          color: 'bg-blue-100 text-blue-800'
        };
    }
  };

  const handleStatusChange = async (taskId: string) => {
    setUpdatingTasks(prev => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    try {
      // 完了するタスクの情報を取得
      const taskToComplete = tasks.find(task => task.id === taskId);
      
      await completeTask(taskId);
      console.log('[UpcomingTaskAccordion] Task completed:', taskId);
      
      // 3周目タスクの場合は特別なポップアップを表示
      if (taskToComplete && taskToComplete.cycleNumber === 3 && taskToComplete.learningStage === 'perfect') {
        setPerfectTaskTitle(taskToComplete.title);
        setPerfectTaskSubject(taskToComplete.subject);
        setShowPerfectCompletion(true);
      } else {
        // 通常のタスクの場合は完了エフェクトを表示
        if (taskToComplete) {
          setCompletedTaskTitle(taskToComplete.title);
          setShowCelebration(true);
        }
      }
      
      // 完了エフェクトが表示されている間はタスク一覧を更新しない
      // エフェクトが完了してから手動で更新
    } catch (error) {
      console.error('タスクの完了に失敗しました:', error);
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
      console.log('[UpcomingTaskAccordion] Task details:', {
        title: mistakeModalTask.title,
        cycleNumber: mistakeModalTask.cycleNumber,
        learningStage: mistakeModalTask.learningStage,
        isPerfect: mistakeModalTask.cycleNumber === 3 && mistakeModalTask.learningStage === 'perfect'
      });
      
      // 3周目タスクの場合は特別なポップアップを表示
      if (mistakeModalTask.cycleNumber === 3 && mistakeModalTask.learningStage === 'perfect') {
        console.log('[UpcomingTaskAccordion] Showing perfect task completion popup');
        setPerfectTaskTitle(mistakeModalTask.title);
        setPerfectTaskSubject(mistakeModalTask.subject);
        setShowPerfectCompletion(true);
      } else {
        // 通常のタスクの場合は完了エフェクトを表示
        console.log('[UpcomingTaskAccordion] Setting celebration for task:', mistakeModalTask.title);
        setCompletedTaskTitle(mistakeModalTask.title);
        setShowCelebration(true);
      }
      
      console.log('[MistakeTracking] 処理完了');
      
      // モーダルを閉じる
      setShowMistakeModal(false);
      setMistakeModalTask(null);
      
      // 完了エフェクトが表示されている間はタスク一覧を更新しない
      // エフェクトが完了してから手動で更新
      
    } catch (error) {
      console.error('[MistakeTracking] エラー:', error);
    } finally {
      setUpdatingTasks(prev => {
        const next = new Set(prev);
        next.delete(mistakeModalTask.id);
        return next;
      });
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('このタスクを削除しますか？')) return;
    
    setDeletingTasks(prev => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    try {
      await deleteTask(taskId);
      onTaskUpdate?.();
    } catch (error) {
      console.error('タスクの削除に失敗しました:', error);
    } finally {
      setDeletingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleCompleteWithMistakeTracking = async (task: Task) => {
    // 3周目タスクの場合は直接完了処理
    if (isPerfectTask(task)) {
      await handleStatusChange(task.id);
      return;
    }
    
    // その他のタスクは間違い記録モーダルを表示
    setMistakeModalTask(task);
    setShowMistakeModal(true);
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // タスクをグループ化（科目別）
  const grouped = tasks.reduce((acc, task) => {
    if (!acc[task.subject]) {
      acc[task.subject] = [];
    }
    acc[task.subject].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // 各科目のタスクをソート（期限順）
  Object.keys(grouped).forEach(subject => {
    grouped[subject].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  });

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 text-center">
          <p className="text-gray-500 text-sm">タスクがありません</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {tasks.length}件のタスク{totalTaskCount && totalTaskCount > tasks.length ? `（全${totalTaskCount}件中）` : ''}
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {Object.entries(grouped).map(([subject, subjectTasks]) => {
            const isExpanded = expandedTasks.has(subject);
            const completedCount = subjectTasks.filter(task => task.status === 'completed').length;
            const totalCount = subjectTasks.length;
            
            // 表示するタスク数を制限（最初の5件）
            const visibleTasks = isExpanded ? subjectTasks : subjectTasks.slice(0, 5);
            const hasMore = subjectTasks.length > 5;
            
            return (
              <div key={subject}>
                <button
                  onClick={() => toggleExpanded(subject)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSubjectBadgeClass(subject)}`}>
                        {subject}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {totalCount}件
                      </span>
                      {completedCount > 0 && (
                        <span className="text-xs text-green-600">
                          ({completedCount}件完了)
                        </span>
                      )}
                      {hasMore && !isExpanded && (
                        <span className="text-xs text-gray-500">
                          (+{totalCount - 5}件)
                        </span>
                      )}
                    </div>
                    <svg 
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* 展開時のタスク一覧 */}
                {isExpanded && (
                  <div className="mt-2 space-y-2">
                    {visibleTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`p-3 border rounded-lg ${
                          isOverdue(task) ? 'border-red-200 bg-red-50' : 
                          task.cycleNumber === 3 && task.learningStage === 'perfect' ? 'bg-purple-50 border-purple-300 shadow-lg' :
                          task.cycleNumber && task.cycleNumber > 1 ? 'bg-orange-50 border-orange-200' :
                          task.status === 'completed' ? 'bg-green-50 border-gray-200' : 
                          'bg-white border-gray-200'
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
                              {task.status !== 'completed' ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    console.log('[UpcomingTaskAccordion] 完了ボタンがクリックされました:', {
                                      taskId: task.id,
                                      title: task.title,
                                      status: task.status,
                                      cycleNumber: task.cycleNumber,
                                      learningStage: task.learningStage
                                    });
                                    handleCompleteWithMistakeTracking(task);
                                  }}
                                  disabled={updatingTasks.has(task.id)}
                                  className="text-xs"
                                >
                                  {updatingTasks.has(task.id) ? '処理中...' : '完了'}
                                </Button>
                              ) : (
                                <span className="text-xs text-green-600 font-medium">完了済み</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 間違い記録モーダル */}
      {showMistakeModal && mistakeModalTask && (
        <MistakeTrackingModal
          task={mistakeModalTask}
          isOpen={showMistakeModal}
          onClose={() => {
            setShowMistakeModal(false);
            setMistakeModalTask(null);
          }}
          onComplete={handleMistakeTrackingComplete}
        />
      )}

      {/* 完了エフェクト */}
      <CompletionCelebration
        isVisible={showCelebration}
        onComplete={() => {
          setShowCelebration(false);
          onTaskUpdate?.(); // エフェクト完了後にタスク一覧を更新
        }}
        taskTitle={completedTaskTitle}
      />
      
      {/* 3周目タスク完了時のねぎらいポップアップ */}
      <PerfectTaskCompletion
        isVisible={showPerfectCompletion}
        onComplete={() => {
          setShowPerfectCompletion(false);
          onTaskUpdate?.(); // エフェクト完了後にタスク一覧を更新
        }}
        taskTitle={perfectTaskTitle}
        subject={perfectTaskSubject}
      />
    </>
  );
}
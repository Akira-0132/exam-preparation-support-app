'use client';

import { useState } from 'react';
import { Task } from '@/types';
import { updateTask, completeTask, deleteTaskWithSubtasks } from '@/lib/supabase/tasks';
import PerfectTaskCompletion from '@/components/ui/PerfectTaskCompletion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EditTaskModal from '@/components/subject/EditTaskModal';

interface TaskSectionProps {
  title: string;
  tasks: Task[];
  onTaskUpdate?: () => void;
  allowAddTask?: boolean;
  onAddTask?: () => void;
}

export default function TaskSection({ 
  title, 
  tasks, 
  onTaskUpdate,
  allowAddTask = false,
  onAddTask
}: TaskSectionProps) {
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());
  const [showPerfectCompletion, setShowPerfectCompletion] = useState(false);
  const [perfectTaskTitle, setPerfectTaskTitle] = useState('');
  const [perfectTaskSubject, setPerfectTaskSubject] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const dateStr = date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '';
    }
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
      case 'completed': return '完了';
      case 'in_progress': return '進行中';
      case 'not_started': return '未開始';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'in_progress':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 12a1 1 0 102 0V9a1 1 0 00-2 0v3zm2-5a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
          </svg>
        );
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
        // 完了するタスクの情報を取得
        const taskToComplete = tasks.find(task => task.id === taskId);
        
        await completeTask(taskId);
        
        // 3周目タスクの場合は特別なポップアップを表示
        if (taskToComplete && taskToComplete.cycleNumber === 3 && taskToComplete.learningStage === 'perfect') {
          setPerfectTaskTitle(taskToComplete.title);
          setPerfectTaskSubject(taskToComplete.subject);
          setShowPerfectCompletion(true);
        }
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

  const toggleTaskExpanded = (taskId: string) => {
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

  // 期限切れ判定は日付ベース（時刻は無視）
  const isOverdue = (task: Task) => {
    if (task.status === 'completed') return false;
    const due = new Date(task.dueDate);
    const today = new Date();
    due.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    return due < today;
  };

  const isPerfectTask = (task: Task) => {
    return task.cycleNumber === 3 && task.learningStage === 'perfect';
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

  const sortedTasks = [...tasks].sort((a, b) => {
    // 完了済みを最後に
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    
    // 期限切れを最初に
    const aOverdue = isOverdue(a);
    const bOverdue = isOverdue(b);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // 周回数でソート（1周目 → 2周目 → 3周目）
    const aCycle = a.cycleNumber || 1;
    const bCycle = b.cycleNumber || 1;
    if (aCycle !== bCycle) {
      return aCycle - bCycle;
    }
    
    // 優先度順
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority];
    const bPriority = priorityOrder[b.priority];
    if (aPriority !== bPriority) return bPriority - aPriority;
    
    // 期限順
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  // トップレベル表示はメイン/シングルのみ（サブタスクは親の下に表示）
  const topLevelTasks = sortedTasks.filter(t => t.taskType !== 'subtask');

  if (tasks.length === 0) {
    return (
      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {title}
            {allowAddTask && (
              <Button size="sm" onClick={onAddTask}>
                タスク追加
              </Button>
            )}
          </CardTitle>
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
            <p className="text-gray-500 mb-4">タスクがありません</p>
            {allowAddTask && (
              <Button variant="outline" onClick={onAddTask}>
                最初のタスクを追加
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card variant="outlined">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>{title}</span>
            <span className="text-sm font-normal text-gray-500">
              ({tasks.filter(t => t.status === 'completed' && t.taskType !== 'parent').length}/{tasks.filter(t => t.taskType !== 'parent').length})
            </span>
          </div>
          {allowAddTask && (
            <Button size="sm" onClick={onAddTask}>
              タスク追加
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-gray-200">
          {topLevelTasks.map((task) => {
            const isExpanded = expandedTasks.has(task.id);
            const overdue = isOverdue(task);
            
            return (
              <div
                key={task.id}
                className={`transition-colors ${
                  overdue ? 'bg-red-50 border-l-4 border-red-400' : 
                  task.cycleNumber === 3 && task.learningStage === 'perfect' ? 'bg-purple-50 border-l-4 border-purple-400 hover:bg-purple-100 shadow-lg' :
                  task.cycleNumber && task.cycleNumber > 1 ? 'bg-orange-50 border-l-4 border-orange-400 hover:bg-orange-100' :
                  'hover:bg-gray-50'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      {/* ステータスアイコン */}
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(task.status)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {task.title}
                          </h3>
                          {(task.cycleNumber && task.cycleNumber > 1) && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStageInfo(task.cycleNumber, task.learningStage || 'overview').color}`}>
                              {getStageInfo(task.cycleNumber, task.learningStage || 'overview').icon} {task.cycleNumber}周目
                            </span>
                          )}
                          {/* 優先度バッジは非表示 */}
                        </div>
                        
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {task.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{formatDate(task.dueDate)}</span>
                          {/* 進捗比率表示は不要のため非表示 */}
                          {overdue && (
                            <span className="text-red-600 font-medium">期限切れ</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* アクションボタン */}
                    <div className="flex items-center space-x-2 ml-4">
                      {/* ステータスチップは不要のため非表示 */}
                      <div className="flex space-x-1">
                        {/* 完了ボタンは詳細ページでは非表示。完了済みのみ「やり直す」を提供 */}
                        {task.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStatusChange(task.id, 'not_started')}
                            disabled={updatingTasks.has(task.id)}
                          >
                            やり直す
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteTask(task.id)}
                          disabled={deletingTasks.has(task.id)}
                        >
                          {deletingTasks.has(task.id) ? '削除中...' : '削除'}
                        </Button>
                        {task.taskType === 'parent' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTask(task)}
                          >
                            編集
                          </Button>
                        )}
                      </div>
                      
                      {/* 展開ボタン */}
                      <button
                        onClick={() => toggleTaskExpanded(task.id)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <svg
                          className={`w-4 h-4 transform transition-transform ${
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
                      </button>
                    </div>
                  </div>
                  
                  {/* 展開時の詳細情報 */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">作成日:</span>
                          <span className="ml-2 text-gray-600">
                            {new Date(task.createdAt).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">更新日:</span>
                          <span className="ml-2 text-gray-600">
                            {new Date(task.updatedAt).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                        {task.status === 'completed' && task.completedAt && (
                          <>
                            <div>
                              <span className="font-medium text-gray-700">完了日:</span>
                              <span className="ml-2 text-gray-600">
                                {new Date(task.completedAt).toLocaleDateString('ja-JP')}
                              </span>
                            </div>
                            {task.actualTime && (
                              <div>
                                <span className="font-medium text-gray-700">実際の時間:</span>
                                <span className="ml-2 text-gray-600">
                                  {task.actualTime}分
                                  {task.estimatedTime && (
                                    <span className={`ml-1 ${
                                      task.actualTime <= task.estimatedTime 
                                        ? 'text-green-600' 
                                        : 'text-orange-600'
                                    }`}>
                                      ({task.actualTime <= task.estimatedTime ? '-' : '+'}
                                      {Math.abs(task.actualTime - task.estimatedTime)}分)
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* サブタスクのネスト表示（親タスクの直下） */}
                  {task.taskType === 'parent' && (
                    <div className="mt-3 space-y-2">
                      {tasks
                        .filter(st => st.parentTaskId === task.id)
                        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                        .map(st => (
                          <div key={st.id} className={`ml-6 pl-4 border-l-2 border-gray-200 py-2 flex items-center justify-between ${st.status === 'completed' ? 'bg-green-50 rounded' : ''}`}>
                            <div className="flex items-center space-x-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">サブ</span>
                              <span className={`text-sm ${st.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{st.title}</span>
                              {st.status === 'completed' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  完了
                                </span>
                              )}
                              {/* サブタスクの進捗比率表示は不要のため非表示 */}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center space-x-2">
                              <span>{formatDate(st.dueDate)}</span>
                              {isOverdue(st) && st.status !== 'completed' && (
                                <span className="text-red-600">期限切れ</span>
                              )}
                              {st.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => { try { await updateTask(st.id, { status: 'not_started', completedAt: undefined }); onTaskUpdate?.(); } catch(e){ console.error(e); } }}
                                >
                                  やり直す
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {editingTask && (
          <EditTaskModal
            isOpen={!!editingTask}
            onClose={() => setEditingTask(null)}
            onSuccess={onTaskUpdate || (() => {})}
            parentTask={editingTask}
            existingSubtasks={tasks.filter(t => t.parentTaskId === editingTask.id)}
          />
        )}
      </CardContent>
      </Card>
      
      {/* 3周目タスク完了時のねぎらいポップアップ */}
      <PerfectTaskCompletion
        isVisible={showPerfectCompletion}
        onComplete={() => setShowPerfectCompletion(false)}
        taskTitle={perfectTaskTitle}
        subject={perfectTaskSubject}
      />
    </>
  );
}
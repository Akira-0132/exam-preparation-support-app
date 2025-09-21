'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDashboard } from '@/lib/context/DashboardContext';
import { getTasksBySubject, updateTask, completeTask } from '@/lib/supabase/tasks';
import { getTestPeriod } from '@/lib/supabase/test-periods';
import { Task, TestPeriod } from '@/types';
import ProgressGauge from '@/components/subject/ProgressGauge';
import TaskSection from '@/components/subject/TaskSection';
import AddTaskModal from '@/components/subject/AddTaskModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface SubjectDetailPageProps {
  params: {
    subject: string;
  };
}

export default function SubjectDetailPage({ params }: SubjectDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  const { currentTestPeriod } = useDashboard();
  const subjectName = decodeURIComponent(params.subject);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [testPeriod, setTestPeriod] = useState<TestPeriod | null>(null);
  const [subjectData, setSubjectData] = useState({
    completedTasks: 0,
    totalTasks: 0,
    completionRate: 0,
    confidence: 3,
    priority: 'medium' as 'high' | 'medium' | 'low',
    estimatedStudyTime: 0,
    actualStudyTime: 0,
  });

  // テスト期間を取得
  useEffect(() => {
    const loadTestPeriod = async () => {
      const periodId = searchParams.get('period');
      if (periodId) {
        try {
          const period = await getTestPeriod(periodId);
          setTestPeriod(period);
        } catch (error) {
          console.error('テスト期間の取得に失敗:', error);
        }
      } else if (currentTestPeriod) {
        setTestPeriod(currentTestPeriod);
      }
    };
    
    loadTestPeriod();
  }, [searchParams, currentTestPeriod]);

  const loadSubjectData = useCallback(async () => {
    if (!userProfile || !testPeriod) return;

    setLoading(true);
    try {
      // 科目別のタスクを取得（現在のテスト期間のタスクのみ）
      console.log('[SubjectPage] Loading tasks for:', {
        userId: userProfile.id,
        subject: subjectName,
        testPeriodId: testPeriod.id,
        isTeacher: userProfile.role === 'teacher'
      });
      const subjectTasks = await getTasksBySubject(userProfile.id, subjectName, testPeriod.id, userProfile.role === 'teacher');
      console.log('[SubjectPage] Retrieved tasks:', subjectTasks);
      setTasks(subjectTasks);

      // 統計データを計算（メインタスクは除外）
      const actionableTasks = subjectTasks.filter(t => t.taskType !== 'parent');
      const completedTasks = actionableTasks.filter(t => t.status === 'completed').length;
      const totalTasks = actionableTasks.length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      const estimatedStudyTime = subjectTasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
      const actualStudyTime = subjectTasks
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + (t.actualTime || 0), 0);

      // タスクの優先度から科目の優先度を推定（メインタスクは除外）
      const highPriorityCount = actionableTasks.filter(t => t.priority === 'high').length;
      const priority: 'high' | 'medium' | 'low' = highPriorityCount > totalTasks / 2 ? 'high' : 
                      highPriorityCount > totalTasks / 4 ? 'medium' : 'low';

      setSubjectData({
        completedTasks,
        totalTasks,
        completionRate,
        confidence: 3, // これは本来Step3で設定した値を取得すべき
        priority,
        estimatedStudyTime,
        actualStudyTime,
      });
    } catch (error) {
      console.error('科目データの取得に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile, testPeriod, subjectName]);

  useEffect(() => {
    if (userProfile && testPeriod) {
      loadSubjectData();
    }
  }, [userProfile, testPeriod, loadSubjectData]);

  const handleTaskStatusChange = async (taskId: string, newStatus: Task['status']) => {
    try {
      if (newStatus === 'completed') {
        await completeTask(taskId);
      } else {
        await updateTask(taskId, { status: newStatus });
      }
      await loadSubjectData(); // データを再読み込み
    } catch (error) {
      console.error('タスクの更新に失敗しました:', error);
    }
  };

  if (loading || !testPeriod) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
          <div className="mt-6 h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-2"
          >
            ← 戻る
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {subjectName}の詳細
          </h1>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              try {
                if (currentTestPeriod?.id) {
                  localStorage.setItem('selectedTestPeriodId', currentTestPeriod.id);
                }
              } catch {}
              router.push(needsRefresh ? '/dashboard?refresh=1' : '/dashboard');
            }}
          >
            {needsRefresh ? 'ダッシュボードで更新表示' : 'ダッシュボード'}
          </Button>
          <Button
            onClick={() => setShowAddTaskModal(true)}
          >
            タスクを追加
          </Button>
          {/* 設定ページ導線は維持 */}
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/subjects/${params.subject}/edit`)}
          >
            設定を変更
          </Button>
        </div>
      </div>

      {/* 進捗概要 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <ProgressGauge
            title={`${subjectName}の進捗`}
            progress={subjectData.completionRate}
            total={subjectData.totalTasks}
            completed={subjectData.completedTasks}
          />
        </div>
        
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>学習統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">予定学習時間</span>
                <span className="font-medium">{subjectData.estimatedStudyTime}分</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">実際の学習時間</span>
                <span className="font-medium">{subjectData.actualStudyTime}分</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">時間効率</span>
                <span className="font-medium">
                  {subjectData.estimatedStudyTime > 0 
                    ? `${Math.round((subjectData.actualStudyTime / subjectData.estimatedStudyTime) * 100)}%`
                    : '-'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* タスクセクション */}
      <TaskSection
        title="タスク"
        tasks={tasks}
        onTaskUpdate={async () => { await loadSubjectData(); setNeedsRefresh(true); }}
        allowAddTask={true}
        onAddTask={() => setShowAddTaskModal(true)}
      />

      {/* 学習アドバイス（状況に応じて切替） */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>学習アドバイス</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 期限切れや未完が多い場合 */}
            {tasks.some(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()) && (
              <div className="p-3 bg-red-50 border-l-4 border-red-400 text-red-800">
                <p className="font-medium">進捗が遅れています</p>
                <p className="text-sm mt-1">期限が近い/過ぎたタスクを優先して処理しましょう。</p>
              </div>
            )}

            {/* 進行中が多い場合 */}
            {!tasks.some(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()) &&
             tasks.filter(t => t.status === 'in_progress').length >= tasks.length / 3 && (
              <div className="p-3 bg-blue-50 border-l-4 border-blue-400 text-blue-800">
                <p className="font-medium">良いペースです</p>
                <p className="text-sm mt-1">この勢いで今日の分+αを目指しましょう。</p>
              </div>
            )}

            {/* 高完了率のとき */}
            {subjectData.completionRate >= 80 && (
              <div className="p-3 bg-green-50 border-l-4 border-green-400 text-green-800">
                <p className="font-medium">順調に進んでいます！</p>
                <p className="text-sm mt-1">仕上げとして復習問題に取り組みましょう。</p>
              </div>
            )}

            {/* デフォルトメッセージ */}
            {subjectData.completionRate < 80 && tasks.filter(t => t.status === 'in_progress').length < tasks.length / 3 && !tasks.some(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()) && (
              <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
                <p className="font-medium">計画的に進めましょう</p>
                <p className="text-sm mt-1">毎日少しずつ、ページ/問題を積み上げましょう。</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* タスク追加モーダル */}
      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onSuccess={async () => { await loadSubjectData(); setNeedsRefresh(true); }}
        subject={subjectName}
        testPeriod={testPeriod}
      />
    </div>
  );
}
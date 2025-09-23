'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getTasksBySubject, getTaskStatistics } from '@/lib/supabase/tasks';
import { getCurrentTestPeriod } from '@/lib/supabase/test-periods';
import { Task, TestPeriod, StudentProfile } from '@/types';
import ProgressGauge from '@/components/subject/ProgressGauge';
import TaskSection from '@/components/subject/TaskSection';
import AddTaskModal from '@/components/subject/AddTaskModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function SubjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { userProfile } = useAuth();
  const [subject, setSubject] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTestPeriod, setCurrentTestPeriod] = useState<TestPeriod | null>(null);
  const [statistics, setStatistics] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    overdue: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const loadSubjectData = useCallback(async (subjectName: string) => {
    if (!userProfile || userProfile.role !== 'student') return;

    setLoading(true);
    const studentProfile = userProfile as StudentProfile;

    try {
      // 現在のテスト期間を取得
      const testPeriod = await getCurrentTestPeriod(studentProfile.classId);
      setCurrentTestPeriod(testPeriod);

      // 科目のタスクを取得（現在のテスト期間のタスクのみ）
      const subjectTasks = await getTasksBySubject(userProfile.id, subjectName, testPeriod?.id);
      setTasks(subjectTasks);

      // 統計データを計算
      const stats = await getTaskStatistics(userProfile.id, testPeriod?.id);
      setStatistics(stats);

    } catch (error) {
      console.error('科目データの取得に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    if (params.id && userProfile && userProfile.role === 'student') {
      const subjectName = decodeURIComponent(params.id as string);
      setSubject(subjectName);
      loadSubjectData(subjectName);
    }
  }, [params.id, userProfile, loadSubjectData]);

  const handleTaskUpdate = () => {
    loadSubjectData(subject);
    setNeedsRefresh(true);
  };

  const handleAddTaskSuccess = () => {
    // タスク追加成功後、データを再読み込み
    loadSubjectData(subject);
    setShowAddTaskModal(false);
    setNeedsRefresh(true);
    
    // ダッシュボードと同じテスト期間を選択するため保存
    if (currentTestPeriod?.id) {
      try {
        localStorage.setItem('selectedTestPeriodId', currentTestPeriod.id);
      } catch {}
    }

    // ダッシュボードに戻る（強制リロードフラグ付き）
    router.push('/dashboard?refresh=1');
  };

  const getSubjectIcon = (subjectName: string) => {
    switch (subjectName) {
      case '国語':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case '数学':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
      case '英語':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd" />
          </svg>
        );
      case '理科':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
          </svg>
        );
      case '社会':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getSubjectColor = (subjectName: string): 'blue' | 'green' | 'purple' | 'orange' => {
    switch (subjectName) {
      case '国語': return 'purple';
      case '数学': return 'blue';
      case '英語': return 'green';
      case '理科': return 'orange';
      case '社会': return 'purple';
      default: return 'blue';
    }
  };

  // タスクをカテゴリ別に分類
  const notStartedTasks = tasks.filter(task => task.status === 'not_started');
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress');
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const overdueTasks = tasks.filter(task => 
    task.status !== 'completed' && new Date(task.dueDate) < new Date()
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-6">
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile || userProfile.role !== 'student') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card variant="elevated">
          <CardContent className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">アクセスできません</h2>
            <p className="text-gray-600 mb-4">この機能は生徒アカウントでのみ利用できます。</p>
            <Button onClick={() => router.push('/dashboard')}>
              ダッシュボードに戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="p-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-${getSubjectColor(subject)}-100 text-${getSubjectColor(subject)}-600`}>
              {getSubjectIcon(subject)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{subject}</h1>
              {currentTestPeriod && (
                <p className="text-gray-600">{currentTestPeriod.title}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
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
        </div>
      </div>

      {/* 進捗概要 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ProgressGauge
          title="全体進捗"
          progress={statistics.completionRate}
          total={statistics.total}
          completed={statistics.completed}
          color={getSubjectColor(subject)}
          icon={getSubjectIcon(subject)}
        />
        
        <Card variant="outlined" className="bg-blue-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center space-x-2">
              <span className="text-blue-600">📋</span>
              <span>未開始</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{notStartedTasks.length}</div>
            <div className="text-sm text-gray-600">個のタスク</div>
          </CardContent>
        </Card>

        <Card variant="outlined" className="bg-orange-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center space-x-2">
              <span className="text-orange-600">⏳</span>
              <span>進行中</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{inProgressTasks.length}</div>
            <div className="text-sm text-gray-600">個のタスク</div>
          </CardContent>
        </Card>

        <Card variant="outlined" className={overdueTasks.length > 0 ? 'bg-red-50' : 'bg-green-50'}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center space-x-2">
              <span className={overdueTasks.length > 0 ? 'text-red-600' : 'text-green-600'}>
                {overdueTasks.length > 0 ? '⚠️' : '✅'}
              </span>
              <span>{overdueTasks.length > 0 ? '期限切れ' : '順調'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {overdueTasks.length > 0 ? overdueTasks.length : '✓'}
            </div>
            <div className="text-sm text-gray-600">
              {overdueTasks.length > 0 ? '個のタスク' : '問題なし'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 期限切れタスク（優先表示） */}
      {overdueTasks.length > 0 && (
        <TaskSection
          title="⚠️ 期限切れタスク"
          tasks={overdueTasks}
          onTaskUpdate={handleTaskUpdate}
        />
      )}

      {/* 進行中タスク */}
      {inProgressTasks.length > 0 && (
        <TaskSection
          title="進行中のタスク"
          tasks={inProgressTasks}
          onTaskUpdate={handleTaskUpdate}
        />
      )}

      {/* 未開始タスク */}
      <TaskSection
        title="未開始のタスク"
        tasks={notStartedTasks}
        onTaskUpdate={handleTaskUpdate}
        allowAddTask={true}
        onAddTask={() => setShowAddTaskModal(true)}
      />

      {/* 完了済みタスク */}
      {completedTasks.length > 0 && (
        <TaskSection
          title="完了済みタスク"
          tasks={completedTasks}
          onTaskUpdate={handleTaskUpdate}
        />
      )}

      {/* 学習のヒント */}
      <Card variant="outlined" className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>💡</span>
            <span>学習のヒント</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">効果的な学習方法</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 毎日少しずつでも継続する</li>
                <li>• 理解できない部分は先生に質問する</li>
                <li>• 過去問で実践的な練習をする</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">時間管理のコツ</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 集中できる時間帯を見つける</li>
                <li>• 25分勉強、5分休憩のリズムで</li>
                <li>• 難しい内容は朝の時間帯に</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* タスク追加モーダル */}
      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onSuccess={handleAddTaskSuccess}
        subject={subject}
        testPeriod={currentTestPeriod}
        onOptimisticAdd={(t) => {
          // 即時に未開始リストへ先頭追加してユーザーに見せる
          setTasks(prev => [{ ...(t as any), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any, ...prev]);
          setNeedsRefresh(true);
        }}
      />
    </div>
  );
}
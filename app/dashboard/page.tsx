'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useDashboard } from '@/lib/context/DashboardContext';
import { Task, Statistics, TestPeriod } from '@/types';
import TaskList from '@/components/dashboard/TaskList';
import SubjectTaskAccordion from '@/components/dashboard/SubjectTaskAccordion';
import UpcomingTaskAccordion from '@/components/dashboard/UpcomingTaskAccordion';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface DashboardPageProps {
  dashboardData: {
    todayTasks: Task[];
    upcomingTasks: Task[];
    statistics: Statistics;
    totalUpcomingTasksCount: number;
  } | null;
  currentTestPeriod: TestPeriod | null;
  isLoading: boolean;
  onTaskUpdate: () => void;
}

export default function DashboardPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { 
    dashboardData,
    currentTestPeriod,
    isLoading,
    onTaskUpdate
  } = useDashboard();
  
  // Dashboard page render

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    // 教師（管理者）の初期表示: 管理メニューを提示
    if (userProfile?.role === 'teacher') {
      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
            <h1 className="text-2xl font-bold mb-2">管理者ダッシュボード</h1>
            <p className="text-blue-100">よく使う管理メニューにアクセスできます。</p>
            {currentTestPeriod && (
              <div className="mt-4 p-4 bg-white/20 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">現在のテスト期間</h3>
                <p className="text-blue-100">{currentTestPeriod.title}</p>
                <p className="text-sm text-blue-200">
                  {new Date(currentTestPeriod.startDate).toLocaleDateString('ja-JP')} ～ {new Date(currentTestPeriod.endDate).toLocaleDateString('ja-JP')}
                </p>
                {currentTestPeriod.subjects && currentTestPeriod.subjects.length > 0 && (
                  <p className="text-sm text-blue-200 mt-1">
                    科目: {currentTestPeriod.subjects.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold">テスト期間の新規作成</div>
                <p className="text-sm text-gray-600">クラスのテスト期間を作成します。</p>
                <Button onClick={() => router.push('/dashboard/test-setup')}>新しいテスト期間を設定</Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold">科目別管理</div>
                <p className="text-sm text-gray-600">各科目のタスクを管理します。</p>
          <Button variant="secondary" onClick={() => router.push('/dashboard/test-setup')}>科目別管理へ</Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold">削除済みテスト期間の管理</div>
                <p className="text-sm text-gray-600">復元や完全削除（移行選択）を行います。</p>
                <Button variant="outline" onClick={() => router.push('/dashboard/test-setup/deleted')}>削除済みを管理</Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold">ページ更新</div>
                <p className="text-sm text-gray-600">表示が更新されない場合に使用します。</p>
                <Button variant="outline" onClick={() => window.location.reload()}>ページを再読み込み</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    // 学生の初期表示（従来の案内）
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-700">データを読み込んでいます...</h2>
        <p className="text-gray-500 mt-2">しばらくお待ちください。</p>
        <div className="mt-4">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
          >
            ページを再読み込み
          </Button>
        </div>
        <div className="mt-8">
          <Button
            onClick={() => router.push('/dashboard/test-setup')}
          >
            新しいテスト期間を設定する
          </Button>
        </div>
      </div>
    );
  }

  const { todayTasks, upcomingTasks, statistics, totalUpcomingTasksCount } = dashboardData;

  const quickStats = [
    {
      title: '今日のタスク',
      value: todayTasks.length,
      subtitle: `${todayTasks.filter(t => t.status === 'completed').length}件完了`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: '総タスク数',
      value: statistics.totalTasks,
      subtitle: `${statistics.completedTasks}件完了`,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: '完了率',
      value: `${statistics.completionRate}%`,
      subtitle: currentTestPeriod ? currentTestPeriod.title : 'テスト期間未設定',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ウェルカムメッセージ */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          おかえりなさい、{userProfile?.displayName}さん！
        </h1>
        <p className="text-blue-100">
          {currentTestPeriod 
            ? `${currentTestPeriod.title}の準備を頑張りましょう！` 
            : 'テスト期間を設定して学習を開始しましょう。'
          }
        </p>
        {!currentTestPeriod && (
          <Button
            variant="secondary"
            onClick={() => router.push('/dashboard/test-setup')}
            className="mt-4"
          >
            テスト期間を設定する
          </Button>
        )}
      </div>

      {/* クイック統計 - モバイルでは横並び */}
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        {quickStats.map((stat, index) => (
          <Card key={index} variant="elevated">
            <CardContent className={`${stat.bgColor} rounded-lg`}>
              <div className="text-center p-2 sm:p-4">
                <div className={`text-lg sm:text-2xl font-bold ${stat.color} mb-1`}>
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm font-medium text-gray-800 mb-1">
                  {stat.title}
                </div>
                <div className="text-xs text-gray-600 hidden sm:block">
                  {stat.subtitle}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 今日のタスク（科目別アコーディオン形式） */}
      <div>
        <SubjectTaskAccordion
          tasks={todayTasks}
          title="今日のタスク"
          onTaskUpdate={onTaskUpdate}
        />
      </div>

      {/* 明日以降のタスク（2段階アコーディオン形式） */}
      {upcomingTasks.length > 0 && (
        <UpcomingTaskAccordion
          tasks={upcomingTasks}
          title="明日以降のタスク"
          onTaskUpdate={onTaskUpdate}
          totalTaskCount={totalUpcomingTasksCount}
        />
      )}

      {/* アクションカードはサイドバーに移動 */}
    </div>
  );
}

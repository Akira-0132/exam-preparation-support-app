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
  
  console.log('[DashboardPage] Using context:', {
    hasDashboardData: !!dashboardData,
    hasCurrentTestPeriod: !!currentTestPeriod,
    isLoading
  });

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
    )
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

      {/* クイック統計 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <Card key={index} variant="elevated">
            <CardContent className={`${stat.bgColor} rounded-lg`}>
              <div className="text-center p-4">
                <div className={`text-2xl font-bold ${stat.color} mb-1`}>
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-gray-800 mb-1">
                  {stat.title}
                </div>
                <div className="text-xs text-gray-600">
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

      {/* アクション（不要カードを削除） */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="outlined" className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push('/dashboard/subjects')}>
          <CardContent className="text-center p-6">
            <div className="w-12 h-12 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 mb-1">科目別管理</h3>
            <p className="text-sm text-gray-600">科目ごとにタスクを管理</p>
          </CardContent>
        </Card>

        <Card variant="outlined" className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push('/dashboard/test-setup')}>
          <CardContent className="text-center p-6">
            <div className="w-12 h-12 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 mb-1">テスト設定</h3>
            <p className="text-sm text-gray-600">テスト期間の設定・変更</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getTestPeriodsByClassId, getCurrentTestPeriod } from '@/lib/supabase/test-periods';
import { getTodayTasks, getTaskStatistics, getIncompleTasks } from '@/lib/supabase/tasks';
import { TestPeriod, StudentProfile, Task, Statistics } from '@/types';
import Header from '@/components/dashboard/Header';
import { DashboardProvider } from '@/lib/context/DashboardContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile: user, currentUser, loading: authLoading } = useAuth();
  
  const [testPeriods, setTestPeriods] = useState<TestPeriod[]>([]);
  const [selectedTestPeriodId, setSelectedTestPeriodId] = useState<string>('');
  const [dashboardData, setDashboardData] = useState<{
    todayTasks: Task[];
    upcomingTasks: Task[];
    statistics: Statistics;
    totalUpcomingTasksCount: number; // 全明日以降タスク数
  } | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // ログイン状態を監視し、未ログインならリダイレクト
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  // ユーザー情報が読み込めたら、テスト期間のリストを取得
  useEffect(() => {
    if (user && user.role === 'student') {
      const studentProfile = user as StudentProfile;
      console.log('[DashboardLayout] User profile loaded:', {
        userId: user.id,
        displayName: user.displayName,
        classId: studentProfile.classId
      });
      if (studentProfile.classId) {
        loadTestPeriods(studentProfile.classId);
      } else {
        console.warn('[DashboardLayout] User has no classId');
        setIsDataLoading(false);
      }
    }
  }, [user]);
  
  // setup=complete で戻ってきたとき最新のテスト期間リストを再取得
  useEffect(() => {
    const setup = searchParams?.get('setup');
    if (setup === 'complete' && user && user.role === 'student' && (user as StudentProfile).classId) {
      loadTestPeriods((user as StudentProfile).classId);
    }
  }, [searchParams, user]);


  const loadTestPeriods = async (classId: string) => {
    console.log('[DashboardLayout] Loading test periods for classId:', classId);
    try {
      const periods = await getTestPeriodsByClassId(classId);
      console.log('[DashboardLayout] Loaded test periods:', periods.length, 'items');
      setTestPeriods(periods);
      
      if (periods.length > 0) {
        // ローカルストレージから保存された選択を復元
        const savedPeriodId = localStorage.getItem('selectedTestPeriodId');
        const current = await getCurrentTestPeriod(classId);
        const defaultPeriodId = savedPeriodId && periods.find(p => p.id === savedPeriodId) 
          ? savedPeriodId 
          : current?.id || periods[0].id;
        console.log('[DashboardLayout] Setting selected test period:', defaultPeriodId);
        setSelectedTestPeriodId(defaultPeriodId);
        // 選択をローカルストレージに保存
        localStorage.setItem('selectedTestPeriodId', defaultPeriodId);
      } else {
        console.log('[DashboardLayout] No test periods found');
        setIsDataLoading(false);
      }
    } catch (error) {
      console.error('テスト期間の取得に失敗しました:', error);
      setIsDataLoading(false);
    }
  };

  // 選択中のテスト期間が変更されたら、ダッシュボードのデータを再取得
  const loadDashboardData = useCallback(async () => {
    console.log('[loadDashboardData] Called with:', {
      user: !!user,
      role: user?.role,
      selectedTestPeriodId
    });
    
    if (!user || user.role !== 'student' || !selectedTestPeriodId) {
      console.log('[loadDashboardData] Early return due to missing data');
      return;
    }

    setIsDataLoading(true);
    console.log('[loadDashboardData] Starting to load dashboard data...');
    try {
      const [todayTasksData, incompleteTasksData, statsData] = await Promise.all([
        getTodayTasks(user.id, selectedTestPeriodId), // テスト期間IDを追加
        getIncompleTasks(user.id, selectedTestPeriodId),
        getTaskStatistics(user.id, selectedTestPeriodId)
      ]);

      console.log('[loadDashboardData] Data loaded:', {
        todayTasks: todayTasksData?.length || 0,
        incompleteTasks: incompleteTasksData?.length || 0,
        stats: statsData
      });

      const allUpcomingTasks = incompleteTasksData
        .filter(task => !todayTasksData.some(todayTask => todayTask.id === task.id));
      
      const filteredUpcomingTasks = allUpcomingTasks.slice(0, 5);
      
      const weeklyProgress = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toISOString().split('T')[0],
          completed: Math.floor(Math.random() * 5) + 1,
          total: Math.floor(Math.random() * 8) + 3,
        };
      });

      const mappedStats: Statistics = {
        totalTasks: statsData.total,
        completedTasks: statsData.completed,
        completionRate: statsData.completionRate,
        averageTimePerTask: 0,
        productivityScore: Math.min(100, Math.floor(statsData.completionRate * 1.2)),
        weeklyProgress,
      };

      const newDashboardData = {
        todayTasks: todayTasksData,
        upcomingTasks: allUpcomingTasks, // 全タスクを渡す
        statistics: mappedStats,
        totalUpcomingTasksCount: allUpcomingTasks.length,
      };
      
      console.log('[loadDashboardData] Setting dashboard data:', {
        todayTasksCount: newDashboardData.todayTasks.length,
        upcomingTasksCount: newDashboardData.upcomingTasks.length,
        completionRate: newDashboardData.statistics.completionRate
      });
      
      setDashboardData(newDashboardData);
    } catch (error) {
      console.error('ダッシュボードデータの取得に失敗しました:', error);
      
      // ネットワークエラーの場合でも、空のデータで表示する
      if (!dashboardData) {
        setDashboardData({
          todayTasks: [],
          upcomingTasks: [],
          statistics: {
            totalTasks: 0,
            completedTasks: 0,
            completionRate: 0,
            averageTimePerTask: 0,
            productivityScore: 0,
            weeklyProgress: [],
          },
          totalUpcomingTasksCount: 0,
        });
      }
    } finally {
      setIsDataLoading(false);
    }
  }, [user, selectedTestPeriodId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleTestPeriodChange = (testPeriodId: string) => {
    setSelectedTestPeriodId(testPeriodId);
    // 選択をローカルストレージに保存
    localStorage.setItem('selectedTestPeriodId', testPeriodId);
  };

  const currentTestPeriod = testPeriods.find(p => p.id === selectedTestPeriodId) || null;
  
  console.log('[DashboardLayout] Render state:', {
    authLoading,
    isDataLoading,
    hasDashboardData: !!dashboardData,
    testPeriodsCount: testPeriods.length,
    selectedTestPeriodId
  });

  if (authLoading || (isDataLoading && !dashboardData)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header isLoading={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </div>
    );
  }

  if (!user) {
    return null; // リダイレクト処理中に何も表示しない
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        testPeriods={testPeriods}
        selectedTestPeriod={selectedTestPeriodId}
        onTestPeriodChange={handleTestPeriodChange}
      />
      
      <DashboardProvider value={{
        dashboardData,
        currentTestPeriod,
        isLoading: isDataLoading,
        onTaskUpdate: loadDashboardData,
        testPeriods,
        selectedTestPeriodId,
        onTestPeriodChange: handleTestPeriodChange
      }}>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {children}
          </div>
        </main>
      </DashboardProvider>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-4 py-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center py-2 px-1 text-gray-600 hover:text-blue-600"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
            <span className="text-xs">ホーム</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/tasks')}
            className="flex flex-col items-center py-2 px-1 text-gray-600 hover:text-blue-600"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            <span className="text-xs">タスク</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/progress')}
            className="flex flex-col items-center py-2 px-1 text-gray-600 hover:text-blue-600"
          >
            <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
            <span className="text-xs">進捗</span>
          </button>
          {user?.role === 'student' && (
            <button
              onClick={() => router.push('/dashboard/test-setup')}
              className="flex flex-col items-center py-2 px-1 text-gray-600 hover:text-blue-600"
            >
              <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
              <span className="text-xs">設定</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

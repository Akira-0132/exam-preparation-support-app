'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getTestPeriodsByClassId, getCurrentTestPeriod } from '@/lib/supabase/test-periods';
import { getTodayTasks, getTaskStatistics, getIncompleTasks } from '@/lib/supabase/tasks';
import { TestPeriod, StudentProfile, Task, Statistics } from '@/types';
import Header from '@/components/dashboard/Header';
import MobileNavigation from '@/components/dashboard/MobileNavigation';
import Sidebar from '@/components/dashboard/Sidebar';
import MainContent from '@/components/dashboard/MainContent';
import { DashboardProvider } from '@/lib/context/DashboardContext';
import { SidebarProvider } from '@/lib/context/SidebarContext';

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile, currentUser, loading: authLoading } = useAuth();
  
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
    if (userProfile && userProfile.role === 'student') {
      const studentProfile = userProfile as StudentProfile;
      console.log('[DashboardLayout] User profile loaded:', {
        userId: userProfile.id,
        displayName: userProfile.displayName,
        classId: studentProfile.classId
      });
      if (studentProfile.classId) {
        loadTestPeriods(studentProfile.classId);
      } else {
        console.warn('[DashboardLayout] User has no classId');
        setIsDataLoading(false);
      }
    }
  }, [userProfile]);
  
  // setup=complete で戻ってきたとき最新のテスト期間リストを再取得
  useEffect(() => {
    const setup = searchParams?.get('setup');
    if (setup === 'complete' && userProfile && userProfile.role === 'student' && (userProfile as StudentProfile).classId) {
      loadTestPeriods((userProfile as StudentProfile).classId);
    }
  }, [searchParams, userProfile]);


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
      userProfile: !!userProfile,
      role: userProfile?.role,
      selectedTestPeriodId
    });
    
    // ユーザープロファイルが設定されていることを確認
    if (!userProfile || userProfile.role !== 'student' || !selectedTestPeriodId) {
      console.log('[loadDashboardData] Early return due to missing data:', {
        hasUserProfile: !!userProfile,
        userRole: userProfile?.role,
        hasSelectedTestPeriod: !!selectedTestPeriodId
      });
      return;
    }

    setIsDataLoading(true);
    console.log('[loadDashboardData] Starting to load dashboard data...');
    try {
      const [todayTasksData, incompleteTasksData, statsData] = await Promise.all([
        getTodayTasks(userProfile.id, selectedTestPeriodId), // テスト期間IDを追加
        getIncompleTasks(userProfile.id, selectedTestPeriodId),
        getTaskStatistics(userProfile.id, selectedTestPeriodId)
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
  }, [userProfile, selectedTestPeriodId]); // userProfileを依存配列に追加

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
        <SidebarProvider>
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
        </SidebarProvider>
      </div>
    );
  }

  if (!userProfile) {
    return null; // リダイレクト処理中に何も表示しない
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SidebarProvider>
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
          <MainContent>
            {children}
          </MainContent>
          
          {/* モバイルナビゲーション */}
          <MobileNavigation />
          
          {/* デスクトップサイドバー */}
          <Sidebar />
        </DashboardProvider>
      </SidebarProvider>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
